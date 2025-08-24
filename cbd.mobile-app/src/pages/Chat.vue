<template>
	<div class="chat-page">
		<div class="chat-header">
			<q-btn
				class="back-btn"
				@click="$router.go(-1)"
				round
				flat
				icon="arrow_back"
			/>
			<h1 class="page-title">Чат</h1>
			<div class="header-spacer"></div>
		</div>
		<div v-if="loading" class="chat-loading">Загрузка…</div>
		<div v-else class="chat-container">
			<div class="messages" ref="messagesRef">
				<div
					v-if="awaitingFirst && messages.length === 0"
					class="q-pa-md flex items-center justify-center"
				>
					<q-spinner-pie color="primary" size="32px" />
				</div>
				<q-chat-message
					v-for="m in messages"
					:key="(m.id || '') + (m.createdAt || '')"
					:name="getName(m)"
					:sent="m.role === 'USER'"
					:text="[getText(m)]"
					:stamp="formatTime(m.createdAt)"
					:bg-color="
						m.role === 'USER'
							? 'primary'
							: m.role === 'AI'
							? 'grey-3'
							: 'grey-2'
					"
					:text-color="m.role === 'USER' ? 'white' : 'black'"
				/>
			</div>
			<div class="composer">
				<CbdInput
					v-model="input"
					class="input"
					type="text"
					:placeholder="'Напишите сообщение…'"
					@keyup.enter="send"
				/>
				<CbdButton
					class="send-btn"
					:disabled="!input.trim() || sending"
					@click="send"
				>
					<q-icon name="send" />
				</CbdButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CbdButton, CbdInput } from "../components/ui";
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
});

const cleanup = ref<null | (() => void)>(null);

onUnmounted(() => {
	console.log("[CHAT] unmounted");
	clearFallback();
	cleanup.value?.();
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
/* Оставляем базовые стили контейнеров; QChatMessage сам рендерит пузырьки */
.chat-page {
	min-height: 100dvh;
	height: 100dvh;
	background: var(--bg-secondary);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.chat-header {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px 16px;
}
.page-title {
	flex: 1;
	text-align: center;
	margin: 0;
}
.header-spacer {
	width: 24px;
}
.chat-container {
	display: flex;
	flex-direction: column;
	height: calc(100dvh - 110px);
	max-height: calc(100dvh - 110px);
	padding-bottom: 110px;
}
.messages {
	flex: 1;
	overflow-y: auto;
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.composer {
	display: flex;
	gap: 8px;
	background: var(--bg-primary);
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	height: 70px;
	padding: 10px 12px;
}
.input {
	flex: 1;
	padding-bottom: 40px;
}
.send-btn {
	border: none;
	background: var(--primary);
	color: var(--text-inverse);
	border-radius: 20px;
	padding: 0 14px;
	padding-bottom: 40px;
}
.chat-loading {
	padding: 16px;
}
</style>