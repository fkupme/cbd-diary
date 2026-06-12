<template>
	<div class="chat-page diary-theme" ref="chatPageRef">
		<header class="chat-header">
			<button class="icon-btn" @click="$router.go(-1)" aria-label="Назад">
				<q-icon name="arrow_back" />
			</button>
			<h1 class="chat-title">Разбор</h1>
			<span class="header-spacer"></span>
		</header>
		<div v-if="loading" class="chat-loading">Загрузка…</div>
		<div v-else class="chat-container">
			<div class="messages" ref="messagesRef">
				<div
					v-if="awaitingFirst && messages.length === 0"
					class="thinking"
				>
					<span class="thinking-dot"></span>
					<span class="thinking-dot"></span>
					<span class="thinking-dot"></span>
				</div>
				<q-chat-message
					v-for="m in messages"
					:key="(m.id || '') + (m.createdAt || '')"
					:name="getName(m)"
					:sent="m.role === 'USER'"
					:text="[getText(m)]"
					:stamp="formatTime(m.createdAt)"
					:class="m.role === 'USER' ? 'msg-user' : 'msg-ai'"
				/>
			</div>
			<div class="composer">
				<div class="composer-field">
					<textarea
						ref="inputRef"
						v-model="input"
						class="composer-input"
						rows="1"
						placeholder="Напишите сообщение…"
						@input="autosize"
						@keydown.enter.exact.prevent="send"
					></textarea>
				</div>
				<button
					class="send-lamp"
					:disabled="!input.trim() || sending"
					@click="send"
					aria-label="Отправить"
				>
					<q-icon name="send" />
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { chatService } from "../services/api";
import type { Chat, ChatMessage } from "../services/api/types";
import { socketService } from "../services/SocketService";

const route = useRoute();
const router = useRouter();
const chat = ref<Chat | null>(null);
const messages = ref<ChatMessage[]>([]);
const input = ref("");
const loading = ref(true);
const sending = ref(false);
const awaitingFirst = ref(true);
const aiRequested = ref(false);
const messagesRef = ref<HTMLDivElement | null>(null);
const chatPageRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

// Авто-рост textarea под текст (до max-height из CSS)
function autosize() {
	const el = inputRef.value;
	if (!el) return;
	el.style.height = "auto";
	el.style.height = `${el.scrollHeight}px`;
}

// Клавиатура: получаем её реальную высоту и поднимаем композитор ровно на неё
// через padding-bottom (страница остаётся на всю высоту — без белого зазора).
// Основной путь — VirtualKeyboard API (env(keyboard-inset-height) в CSS),
// фолбэк — visualViewport (считаем высоту клавы и пишем в --kb).
function setKbInset(px: number) {
	const page = chatPageRef.value;
	if (page) page.style.setProperty("--kb", `${Math.max(0, Math.round(px))}px`);
	scrollToBottom();
}

function onVisualViewport() {
	const vv = window.visualViewport;
	if (!vv) return;
	// высота клавиатуры = сколько «съедено» снизу от внутренней высоты окна
	setKbInset(window.innerHeight - vv.height - vv.offsetTop);
}

function onKeyboardGeometry() {
	const vk: any = (navigator as any).virtualKeyboard;
	setKbInset(vk?.boundingRect?.height || 0);
}

function scrollToBottom() {
	nextTick(() => {
		messagesRef.value?.scrollTo({
			top: messagesRef.value.scrollHeight,
			behavior: "smooth",
		});
	});
}

function upsertMessage(m: any) {
	console.log("[CHAT] upsert", m?.id, m?.role);
	if (tempAi.value && m.role === "AI" && m.chatId === chat.value?.id) {
		tempAi.value.id = m.id;
		tempAi.value.content = m.content;
		tempAi.value.createdAt = m.createdAt;
		tempAi.value = null;
		aiRequested.value = false;
		awaitingFirst.value = false;
		clearFallback();
		scrollToBottom();
		return;
	}
	const idx = messages.value.findIndex((x: any) => x.id && x.id === m.id);
	if (idx >= 0) {
		(messages.value[idx] as any) = m as any;
	} else {
		messages.value.push(m as ChatMessage);
	}
	awaitingFirst.value = false;
	scrollToBottom();
}

function formatTime(ts: string) {
	const d = new Date(ts);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function parseSystem(content: string): any | null {
	try {
		const obj = JSON.parse(content);
		return obj && typeof obj === "object" ? obj : null;
	} catch {
		return null;
	}
}

function getName(m: ChatMessage): string {
	if (m.role === "USER") return "Вы";
	if (m.role === "AI") return "Нейроассистент";
	return "Система";
}

function getText(m: ChatMessage): string {
	if (m.role === "SYSTEM") {
		const sys = parseSystem(m.content);
		if (sys?.type === "chat_init") {
			return "Чат создан. Я помогу проанализировать событие. Задавайте вопросы или опишите ситуацию.";
		}
		return "Системное сообщение";
	}
	return m.content;
}

async function ensureChat(): Promise<void> {
	const chatId = route.params.chatId as string | undefined;
	const entryId = route.params.entryId as string | undefined;
	console.log("[CHAT] ensureChat", { chatId, entryId });

	if (chatId) {
		chat.value = {
			id: chatId,
			userId: "",
			cbtEntryId: "",
			createdAt: "",
			updatedAt: "",
		} as Chat;
		return;
	}
	if (entryId) {
		console.log("[CHAT] creating by entry", entryId);
		const created = await chatService.getOrCreateByEntry(entryId);
		chat.value = created;
		router.replace({ name: "Chat", params: { chatId: created.id } });
	}
}

async function loadMessages() {
	if (!chat.value?.id) return;
	console.log("[CHAT] loadMessages for", chat.value.id);
	messages.value = await chatService.listMessages(chat.value.id);
	awaitingFirst.value = messages.value.length === 0;
	scrollToBottom();
}

async function send() {
	if (!chat.value?.id || !input.value.trim()) return;
	try {
		sending.value = true;
		console.log("[CHAT] send", input.value);
		const msg = await chatService.sendMessage(
			chat.value.id,
			input.value.trim()
		);
		upsertMessage(msg);
		input.value = "";
		// сбрасываем высоту textarea обратно к одной строке
		nextTick(() => {
			if (inputRef.value) inputRef.value.style.height = "auto";
		});
		if (!aiRequested.value) {
			console.log("[CHAT] auto ai_generate after user msg");
			startAi(chat.value.id);
		}
	} finally {
		sending.value = false;
	}
}

function bindSocket() {
	const onMsg = (m: any) => {
		console.log("[CHAT] socket message", m?.id);
		if (m?.chatId && chat.value?.id === m.chatId) {
			upsertMessage(m);
		}
	};

	const onDelta = (p: { chatId: string; delta: string }) => {
		if (!chat.value?.id || p.chatId !== chat.value.id) return;
		console.log("[CHAT] ai_delta", p.delta?.slice(0, 20));
		awaitingFirst.value = false;
		clearFallback();
		if (!tempAi.value) {
			tempAi.value = {
				id: "",
				chatId: p.chatId,
				role: "AI",
				content: p.delta,
				createdAt: new Date().toISOString(),
			} as any;
			messages.value.push(tempAi.value as any);
		} else {
			tempAi.value.content += p.delta;
		}
		scrollToBottom();
	};

	const onDone = (p: { chatId: string }) => {
		console.log("[CHAT] ai_done", p.chatId);
		clearFallback();
		aiRequested.value = false;
	};

	const onErr = (p: { chatId: string; error: string }) => {
		console.warn("[CHAT] ai_error", p.error);
		clearFallback();
		tempAi.value = null;
		aiRequested.value = false;
	};

	const onStarted = (p: { chatId: string }) => {
		if (!chat.value?.id || p.chatId !== chat.value.id) return;
		console.log("[CHAT] ai_started", p.chatId);
		// Запускаем/перезапускаем таймер контроля на случай подвисания стрима
		scheduleFallback();
	};

	// Диагностический ACK
	const onAck = (p: { chatId: string }) => {
		if (!chat.value?.id || p.chatId !== chat.value.id) return;
		console.log("[CHAT] ai_ack", p.chatId);
		aiAcked.value = true;
	};

	socketService.onMessage(onMsg);
	socketService.onAiDelta(onDelta);
	socketService.onAiDone(onDone);
	socketService.onAiError(onErr);
	const s = socketService.connect();
	s.on("ai_started", onStarted as any);
	s.on("ai_ack", onAck as any);
	// Логи подключения
	const onConnect = () => console.log("[CHAT] socket connect", (s as any).id);
	const onConnectError = (e: any) =>
		console.warn("[CHAT] socket connect_error", e?.message || e);
	const onDisconnect = (reason: any) =>
		console.warn("[CHAT] socket disconnect", reason);
	s.on("connect", onConnect);
	s.on("connect_error", onConnectError);
	s.on("disconnect", onDisconnect);
	return () => {
		console.log("[CHAT] cleanup listeners");
		socketService.offMessage(onMsg);
		socketService.offAiDelta(onDelta);
		socketService.offAiDone(onDone);
		socketService.offAiError(onErr);
		s.off("ai_started", onStarted as any);
		s.off("ai_ack", onAck as any);
		s.off("connect", onConnect);
		s.off("connect_error", onConnectError);
		s.off("disconnect", onDisconnect);
	};
}

const tempAi = ref<any | null>(null);
const fallbackTimer = ref<number | null>(null);
const ackRetryTimer = ref<number | null>(null);
aiRequested.value = false;
const aiAcked = ref(false);

function clearFallback() {
	if (fallbackTimer.value) {
		clearTimeout(fallbackTimer.value);
		fallbackTimer.value = null;
	}
	if (ackRetryTimer.value) {
		clearTimeout(ackRetryTimer.value);
		ackRetryTimer.value = null;
	}
}

async function fetchLatestAiIfAny() {
	if (!chat.value?.id) return;
	try {
		const list = await chatService.listMessages(chat.value.id);
		const lastAi = [...list].reverse().find((m) => m.role === "AI");
		if (lastAi) {
			upsertMessage(lastAi as any);
		}
	} catch {}
}

function scheduleFallback() {
	clearFallback();
	fallbackTimer.value = window.setTimeout(async () => {
		if (aiRequested.value && !tempAi.value && chat.value?.id) {
			console.warn("[CHAT] fallback: fetch latest AI via REST");
			await fetchLatestAiIfAny();
			aiRequested.value = false;
			awaitingFirst.value = false;
		}
	}, 7000) as unknown as number;
}

function startAi(chatId: string) {
	if (aiRequested.value) return;
	// На всякий случай: убеждаемся, что мы в комнате, перед генерацией
	void socketService.joinChatAsync(chatId, 2000).then(() => {
		socketService.emitAiGenerate(chatId);
	});
	aiRequested.value = true;
	aiAcked.value = false;
	// Короткий ретрай, если событие не дошло до сервера
	if (ackRetryTimer.value) clearTimeout(ackRetryTimer.value);
	ackRetryTimer.value = window.setTimeout(async () => {
		if (aiRequested.value && !aiAcked.value && chat.value?.id === chatId) {
			console.warn("[CHAT] no ai_ack, deep reconnect & retry");
			// Глубокий ресет: разрываем соединение, переподключаемся, повторно join и эмитим
			socketService.disconnect();
			const joined = await socketService.joinChatAsync(chatId, 3000);
			if (joined) socketService.emitAiGenerate(chatId);
		}
	}, 1500) as unknown as number;
	// Если сервер не ответит ai_started за разумное время — не спамим, просто снимем спиннер
	if (fallbackTimer.value) clearTimeout(fallbackTimer.value);
	fallbackTimer.value = window.setTimeout(() => {
		if (aiRequested.value && !tempAi.value) {
			console.warn("[CHAT] no ai_started, cancel spinner");
			aiRequested.value = false;
			awaitingFirst.value = false;
		}
	}, 4000) as unknown as number;
}

onMounted(async () => {
	console.log("[CHAT] mounted");
	try {
		await ensureChat();
		if (chat.value?.id) {
			console.log("[CHAT] join", chat.value.id);
			// Сначала навешиваем слушатели (внутри произойдёт connect), затем join
			cleanup.value = bindSocket();
			const joined = await socketService.joinChatAsync(chat.value.id, 4000);
			if (!joined) {
				console.warn("[CHAT] join timed out");
			}
		}
		await loadMessages();
		if (chat.value?.id && messages.value.length === 0 && !aiRequested.value) {
			console.log("[CHAT] auto ai_generate on empty history");
			startAi(chat.value.id);
		}
	} finally {
		loading.value = false;
	}

	// Клавиатура: подписываемся на ОБА источника — что сработает на этом вебвью,
	// то и обновит --kb (значения совпадают: оба = высота клавиатуры).
	const vk: any = (navigator as any).virtualKeyboard;
	if (vk) {
		vk.overlaysContent = true; // клавиатура перекрывает контент, а не ресайзит
		vk.addEventListener("geometrychange", onKeyboardGeometry);
	}
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", onVisualViewport);
		window.visualViewport.addEventListener("scroll", onVisualViewport);
		onVisualViewport();
	}
});

const cleanup = ref<null | (() => void)>(null);

onUnmounted(() => {
	console.log("[CHAT] unmounted");
	clearFallback();
	cleanup.value?.();
	if (chat.value?.id) socketService.leaveChat(chat.value.id);
	const vk: any = (navigator as any).virtualKeyboard;
	if (vk) {
		vk.overlaysContent = false;
		vk.removeEventListener("geometrychange", onKeyboardGeometry);
	}
	if (window.visualViewport) {
		window.visualViewport.removeEventListener("resize", onVisualViewport);
		window.visualViewport.removeEventListener("scroll", onVisualViewport);
	}
});

watch(
	() => route.params.chatId,
	async () => {
		console.log("[CHAT] route chatId change", route.params.chatId);
		chat.value = {
			id: String(route.params.chatId),
			userId: "",
			cbtEntryId: "",
			createdAt: "",
			updatedAt: "",
		} as Chat;
		await loadMessages();
		await socketService.joinChatAsync(chat.value.id, 4000);
		if (messages.value.length === 0 && !aiRequested.value) {
			console.log("[CHAT] auto ai_generate after route change");
			startAi(chat.value.id);
		}
	}
);
</script>

<style scoped>
.chat-page {
	height: 100dvh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	box-sizing: border-box;
	/* Поднимаем весь столбец (и композитор) над клавиатурой на её реальную
	   высоту. --kb пишет JS из VirtualKeyboard API (boundingRect) или из
	   visualViewport — единый источник, без капризов env()-фолбэка. Страница
	   остаётся на всю высоту, поэтому белого зазора снизу нет. */
	padding-bottom: var(--kb, 0px);
	transition: padding-bottom 0.18s ease-out;
}

/* ===== Шапка ===== */
.chat-header {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 14px 16px;
	border-bottom: 1px solid var(--line);
	flex-shrink: 0;
}
.icon-btn {
	width: 38px;
	height: 38px;
	display: grid;
	place-items: center;
	border: none;
	background: rgba(237, 230, 214, 0.06);
	color: var(--paper);
	border-radius: 50%;
	cursor: pointer;
	transition: background 0.18s ease;
}
.icon-btn:hover {
	background: rgba(240, 178, 100, 0.12);
	color: var(--lamp);
}
.icon-btn .q-icon {
	font-size: 21px;
}
.chat-title {
	flex: 1;
	text-align: center;
	margin: 0;
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: 20px;
	letter-spacing: -0.01em;
}
.header-spacer {
	width: 38px;
	flex-shrink: 0;
}

.chat-loading {
	padding: 24px;
	text-align: center;
	color: var(--paper-dim);
}

.chat-container {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
}
.messages {
	flex: 1;
	overflow-y: auto;
	padding: 16px 14px;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

/* ===== «Печатает…» ===== */
.thinking {
	display: flex;
	gap: 6px;
	padding: 14px 4px;
	align-self: flex-start;
}
.thinking-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--lamp);
	opacity: 0.5;
	animation: thinking 1.2s ease-in-out infinite;
}
.thinking-dot:nth-child(2) {
	animation-delay: 0.2s;
}
.thinking-dot:nth-child(3) {
	animation-delay: 0.4s;
}
@keyframes thinking {
	0%,
	60%,
	100% {
		opacity: 0.35;
		transform: translateY(0);
	}
	30% {
		opacity: 1;
		transform: translateY(-3px);
	}
}

/* ===== Пузырьки Quasar в «чернильной» теме ===== */
:deep(.q-message-name) {
	color: var(--paper-dim);
	font-size: 12px;
}
:deep(.q-message-stamp) {
	color: rgba(151, 144, 126, 0.7);
}
:deep(.q-message-text) {
	color: var(--paper);
	min-height: unset;
}
:deep(.q-message-text--received .q-message-text-content) {
	color: var(--paper);
}
/* AI / система — тёмная «бумага» */
:deep(.msg-ai .q-message-text) {
	background: rgba(26, 31, 43, 0.85);
	border: 1px solid var(--line);
	color: var(--paper);
}
:deep(.msg-ai .q-message-text:last-child:before) {
	border-color: transparent rgba(26, 31, 43, 0.85);
}
/* Пользователь — янтарь */
:deep(.msg-user .q-message-text) {
	background: var(--lamp);
	color: #181203;
}
:deep(.msg-user .q-message-text:last-child:before) {
	border-color: transparent var(--lamp);
}

/* ===== Композитор ===== */
.composer {
	display: flex;
	align-items: flex-end;
	gap: 10px;
	padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
	background: rgba(18, 21, 29, 0.92);
	backdrop-filter: blur(14px);
	-webkit-backdrop-filter: blur(14px);
	border-top: 1px solid var(--line);
	flex-shrink: 0;
}
.composer-field {
	flex: 1;
	display: flex;
	align-items: center;
	background: rgba(26, 31, 43, 0.7);
	border: 1px solid var(--line);
	border-radius: 22px;
	padding: 0 16px;
	transition: border-color 0.2s ease;
}
.composer-field:focus-within {
	border-color: rgba(240, 178, 100, 0.55);
}
.composer-input {
	flex: 1;
	min-width: 0;
	background: transparent;
	border: none;
	outline: none;
	color: var(--paper);
	font-family: inherit;
	font-size: 15px;
	line-height: 1.4;
	padding: 11px 0;
	margin: 0;
	resize: none;
	max-height: 120px;
	overflow-y: auto;
	caret-color: var(--lamp);
}
.composer-input::placeholder {
	color: rgba(151, 144, 126, 0.6);
}
.send-lamp {
	width: 44px;
	height: 44px;
	flex-shrink: 0;
	display: grid;
	place-items: center;
	border: none;
	border-radius: 50%;
	cursor: pointer;
	color: #181203;
	background: var(--lamp);
	box-shadow: 0 8px 22px -8px rgba(240, 178, 100, 0.6);
	transition: transform 0.12s ease, opacity 0.2s ease, background 0.2s ease;
}
.send-lamp .q-icon {
	font-size: 20px;
}
.send-lamp:active {
	transform: scale(0.92);
}
.send-lamp:disabled {
	opacity: 0.4;
	box-shadow: none;
	cursor: not-allowed;
}
</style>