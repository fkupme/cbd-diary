<template>
	<div class="capture-page diary-theme">
		<div class="capture-inner" :class="{ 'is-chat': started }">
			<button class="back-btn text-link" @click="goBack" aria-label="Назад">
				← {{ t("common.back", "Назад") }}
			</button>

			<!-- ===== ВСТУПЛЕНИЕ: запись или текст ===== -->
			<template v-if="!started">
				<div class="orb-wrap">
					<button
						class="rec-orb"
						:class="{ listening: recording, busy: busy }"
						@click="toggleRecord"
						:disabled="busy"
						:aria-label="recording ? 'Остановить' : 'Говорить'"
					>
						<span class="rec-ring"></span>
						<span class="rec-ring rec-ring-2"></span>
						<svg v-if="!recording && !busy" class="rec-mic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" fill="currentColor" />
							<path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
						</svg>
						<span v-else-if="recording" class="rec-wave" aria-hidden="true">
							<i></i><i></i><i></i><i></i><i></i>
						</span>
						<span v-else class="rec-spin" aria-hidden="true"></span>
					</button>
				</div>

				<h1 class="capture-h1">
					{{ recording ? t("capture.listening", "Слушаю…") : busy ? t("capture.thinking", "Раскладываю…") : t("capture.prompt", "Расскажите, что произошло") }}
				</h1>
				<p class="capture-hint">
					{{ recording ? t("capture.hintLive", "Говорите свободно — как есть, без формулировок") : t("capture.hint", "Нажмите на лампу и опишите ситуацию словами") }}
				</p>

				<div class="smer">
					<p class="smer-cap">{{ t("capture.smerCap", "Я разложу рассказ по полочкам") }}</p>
					<div class="smer-row">
						<span class="smer-chip" v-for="part in smer" :key="part.k"><b>{{ part.k }}</b>{{ part.label }}</span>
					</div>
				</div>

				<div class="text-fallback">
					<label class="tf-label" for="cap-text">{{ t("capture.orType", "или опишите словами") }}</label>
					<textarea
						id="cap-text"
						v-model="text"
						class="tf-area"
						rows="4"
						:placeholder="t('capture.placeholder', 'Сегодня на встрече я промолчал, хотя был не согласен…')"
					></textarea>
				</div>

				<button class="lamp-btn analyze-btn" :disabled="!canAnalyze || busy" @click="analyzeText">
					{{ busy ? t("capture.thinking", "Раскладываю…") : t("capture.analyze", "Разложить по полочкам") }}
				</button>

				<p v-if="error" class="err-note">{{ error }}</p>
			</template>

			<!-- ===== ЧАТ ===== -->
			<template v-else>
				<div class="thread" ref="threadEl">
					<div v-for="m in messages" :key="m.id" class="row" :class="m.role === 'USER' ? 'right' : 'left'">
						<div v-if="m.role === 'USER'" class="bubble user">{{ m.content }}</div>

						<template v-else>
							<div v-if="m.kind === 'card'" class="card-wrap">
								<p class="card-cap"><span class="card-dot"></span>{{ t("intake.cardReady", "готова карточка") }}</p>
								<EventCardCompact
									:title="m.payload?.title || ''"
									:draft="m.payload?.draft || {}"
									:entry-id="entryIdFor(m)"
									@open="openEntry"
								/>
							</div>
							<div v-else-if="m.content" class="bubble ai">{{ m.content }}</div>
						</template>
					</div>

					<div v-if="busy" class="thinking" aria-label="думает"><i></i><i></i><i></i></div>
				</div>

				<!-- зона ввода зависит от последнего хода -->
				<div class="inputzone">
					<p v-if="error" class="err-note">{{ error }}</p>

					<!-- выбор ситуаций -->
					<template v-if="isSegment">
						<div class="opts">
							<button v-for="o in segOptions" :key="o.id" class="opt" :class="{ on: !!selected[o.id] }" @click="toggleSel(o.id)">
								<span class="tick"><i v-if="selected[o.id]" class="ti ti-check"></i></span>{{ o.label }}
							</button>
						</div>
						<button class="lamp-btn wide" :disabled="selCount === 0 || busy" @click="doSelect">
							{{ t("intake.analyzeChosen", "Разобрать выбранные") }} ({{ selCount }})
						</button>
					</template>

					<!-- эмоции: чипы + правка -->
					<template v-else-if="isEmotion">
						<div class="echips">
							<span v-for="(id, i) in emotionEdit" :key="id" class="echip">
								<span class="dot" :style="{ background: dotColor(id) }"></span>{{ emoName(id) }}
								<button class="x" @click="removeEmotion(i)" aria-label="убрать">×</button>
							</span>
							<span v-if="!emotionEdit.length" class="echip muted">{{ t("intake.noEmotionsYet", "ничего не выбрано") }}</span>
						</div>
						<div class="btn-row">
							<button class="lamp-btn" :disabled="busy" @click="confirmEmotions">{{ t("common.confirm", "Подтвердить") }}</button>
							<button class="ghost-btn" :disabled="busy" @click="confirmNoEmotions">{{ t("intake.noEmotions", "без эмоций") }}</button>
						</div>
						<div class="composer">
							<input v-model="composer" class="cin" :placeholder="t('intake.feelWords', 'или опиши чувства словами…')" @keydown.enter.prevent="sendText" />
							<button class="send" :disabled="!composer.trim() || busy" @click="sendText" aria-label="отправить"><i class="ti ti-arrow-up"></i></button>
						</div>
					</template>

					<!-- интенсивность -->
					<template v-else-if="isIntensity">
						<div class="nums">
							<button v-for="n in 10" :key="n" class="num" :disabled="busy" @click="sendIntensity(n)">{{ n }}</button>
						</div>
					</template>

					<!-- сохранить всё -->
					<template v-else-if="isCommit">
						<button class="lamp-btn wide" :disabled="busy" @click="commit">{{ t("intake.saveAll", "Сохранить всё") }}</button>
					</template>

					<!-- готово -->
					<template v-else-if="status === 'done'">
						<button class="lamp-btn wide" @click="router.push('/diary')">{{ t("intake.openDiary", "Открыть дневник") }}</button>
					</template>

					<!-- свободный текст (мысль / чувства-вопрос / реакция) -->
					<template v-else-if="composerActive">
						<div class="composer">
							<input v-model="composer" class="cin" :placeholder="composerPlaceholder" @keydown.enter.prevent="sendText" />
							<button v-if="isReactions" class="ghost-btn slim" :disabled="busy" @click="skipReactions">{{ t("intake.skip", "пропустить") }}</button>
							<button class="send" :disabled="!composer.trim() || busy" @click="sendText" aria-label="отправить"><i class="ti ti-arrow-up"></i></button>
						</div>
					</template>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import EventCardCompact from "../components/EventCardCompact.vue";
import { useLocalization } from "../composables/useLocalization";
import { useIntake } from "../composables/useIntake";
import { useEmotionsStore } from "../stores/emotions";
import type { IntakeMessage } from "../services/api/IntakeService";

const router = useRouter();
const { t } = useLocalization();
const emotionsStore = useEmotionsStore();

onMounted(() => {
	// Каталог эмоций нужен для чипов и карточек (имя + цвет категории).
	// Идемпотентно: loadAll сам пропустит, если данные свежие.
	emotionsStore.loadAll().catch(() => {});
});

const {
	messages,
	events,
	status,
	cursor,
	busy,
	error,
	started,
	lastMessage,
	beginAudio,
	beginText,
	selectEvents,
	sendAnswer,
	commit,
} = useIntake();

// ---- вступление ----
const text = ref("");
const canAnalyze = computed(() => text.value.trim().length > 0);
const smer = [
	{ k: "С", label: t("capture.smer.s", "итуация") },
	{ k: "М", label: t("capture.smer.m", "ысли") },
	{ k: "Э", label: t("capture.smer.e", "моции") },
	{ k: "Р", label: t("capture.smer.r", "еакция") },
];

async function analyzeText() {
	if (!canAnalyze.value) return;
	const v = text.value.trim();
	text.value = "";
	await beginText(v);
	scrollSoon();
}

// ---- запись ----
const recording = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;

function pickMime(): string {
	const prefs = ["audio/mp4", "audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
	const MR: any = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
	if (MR?.isTypeSupported) {
		for (const m of prefs) if (MR.isTypeSupported(m)) return m;
	}
	return "";
}

async function toggleRecord() {
	if (recording.value) {
		stopRecord();
		return;
	}
	if (!navigator.mediaDevices?.getUserMedia) {
		error.value = "Запись недоступна на этом устройстве. Опиши словами ниже.";
		return;
	}
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch {
		error.value = "Нет доступа к микрофону. Опиши словами ниже.";
		return;
	}
	chunks = [];
	const mime = pickMime();
	mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
	mediaRecorder.ondataavailable = (e) => {
		if (e.data && e.data.size) chunks.push(e.data);
	};
	mediaRecorder.onstop = async () => {
		const type = mediaRecorder?.mimeType || mime || "audio/webm";
		const blob = new Blob(chunks, { type });
		cleanupStream();
		if (blob.size > 0) {
			await beginAudio(blob, type.split(";")[0]);
			scrollSoon();
		}
	};
	mediaRecorder.start();
	recording.value = true;
}
function stopRecord() {
	recording.value = false;
	try {
		mediaRecorder?.stop();
	} catch {
		/* noop */
	}
}
function cleanupStream() {
	stream?.getTracks().forEach((tr) => tr.stop());
	stream = null;
}
onBeforeUnmount(() => {
	try {
		mediaRecorder?.stop();
	} catch {
		/* noop */
	}
	cleanupStream();
});

// ---- зона ввода по последнему ходу ----
const isSegment = computed(
	() => lastMessage.value?.kind === "buttons" && !!lastMessage.value?.payload?.multi,
);
const segOptions = computed<{ id: string; label: string; value: string }[]>(
	() => lastMessage.value?.payload?.options || [],
);
const isEmotion = computed(() => lastMessage.value?.kind === "emotion");
const isIntensity = computed(() => lastMessage.value?.kind === "intensity");
const isCommit = computed(
	() => lastMessage.value?.kind === "buttons" && lastMessage.value?.payload?.action === "commit",
);
const isReactions = computed(() => cursor.value?.field === "reactions");
const composerActive = computed(() => {
	const f = cursor.value?.field;
	return f === "thought" || f === "emotions" || f === "reactions";
});
const composerPlaceholder = computed(() => {
	const f = cursor.value?.field;
	if (f === "thought") return t("intake.phThought", "что промелькнуло в голове…");
	if (f === "emotions") return t("intake.phFeel", "опиши, что почувствовал…");
	if (f === "reactions") return t("intake.phReact", "что сделал, как поступил…");
	return t("intake.phAnswer", "ответь словами…");
});

// выбор ситуаций
const selected = ref<Record<string, boolean>>({});
const selCount = computed(() => Object.values(selected.value).filter(Boolean).length);
function toggleSel(id: string) {
	selected.value[id] = !selected.value[id];
}
function doSelect() {
	const ids = segOptions.value.filter((o) => selected.value[o.id]).map((o) => o.value ?? o.id);
	selectEvents(ids);
}

// эмоции
const emotionEdit = ref<number[]>([]);
function removeEmotion(i: number) {
	emotionEdit.value.splice(i, 1);
}
function confirmEmotions() {
	sendAnswer({ emotionIds: [...emotionEdit.value] });
}
function confirmNoEmotions() {
	sendAnswer({ emotionIds: [] });
}

// текст / интенсивность / реакция
const composer = ref("");
function sendText() {
	const v = composer.value.trim();
	if (!v) return;
	composer.value = "";
	sendAnswer({ text: v });
}
function sendIntensity(n: number) {
	sendAnswer({ intensity: n });
}
function skipReactions() {
	sendAnswer({ skip: true });
}

// карточка → запись
function entryIdFor(m: IntakeMessage): string | null {
	const ev = events.value.find((e) => e.id === m.payload?.eventId);
	return ev?.createdEntryId ?? null;
}
function openEntry(_entryId: string) {
	router.push("/diary");
}

// эмоции: имя/цвет
function dotColor(id: number): string {
	return emotionsStore.getEmotionColor(id) || "var(--lamp)";
}
function emoName(id: number): string {
	const e = emotionsStore.getEmotionById(id);
	return e ? t((e as any).nameKey, (e as any).name || "") : "";
}

// инициализация под новый ход + автоскролл
watch(lastMessage, (m) => {
	if (!m) return;
	if (m.kind === "buttons" && m.payload?.multi) {
		const sel: Record<string, boolean> = {};
		for (const o of m.payload.options || []) sel[o.id] = true;
		selected.value = sel;
	} else if (m.kind === "emotion") {
		emotionEdit.value = (m.payload?.suggestions || []).map((s: any) => s.emotionId);
	}
	scrollSoon();
});
watch(busy, scrollSoon);

const threadEl = ref<HTMLElement | null>(null);
function scrollSoon() {
	nextTick(() => {
		const el = threadEl.value;
		if (el) el.scrollTop = el.scrollHeight;
	});
}

function goBack() {
	if (window.history.length > 1) router.back();
	else router.push("/home");
}
</script>

<style scoped>
.capture-page {
	display: flex;
	justify-content: center;
	min-height: 100dvh;
}
.capture-inner {
	width: 100%;
	max-width: 440px;
	padding: max(5dvh, 28px) 24px 40px;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}
.capture-inner.is-chat {
	align-items: stretch;
	text-align: left;
	padding-bottom: 16px;
	height: 100dvh;
	box-sizing: border-box;
}
.back-btn {
	align-self: flex-start;
	font-size: 15px;
	margin-bottom: max(3dvh, 18px);
}

/* ===== Орб ===== */
.orb-wrap { margin-top: max(2dvh, 12px); display: grid; place-items: center; }
.rec-orb {
	position: relative; width: 150px; height: 150px; border-radius: 50%;
	border: none; cursor: pointer; display: grid; place-items: center; color: #181203;
	background: radial-gradient(circle at 50% 38%, #f7c887 0%, var(--lamp) 55%, var(--lamp-deep) 100%);
	box-shadow: 0 0 0 1px rgba(240,178,100,.35), 0 20px 60px -14px rgba(240,178,100,.55), 0 0 90px -8px rgba(240,178,100,.35);
	transition: transform .12s ease;
}
.rec-orb:active { transform: scale(.97); }
.rec-orb:disabled { cursor: default; }
.rec-mic { width: 52px; height: 52px; z-index: 1; }
.rec-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(240,178,100,.5); opacity: 0; }
.rec-orb.listening .rec-ring { animation: rec-breathe 2.4s ease-out infinite; }
.rec-orb.listening .rec-ring-2 { animation-delay: 1.2s; }
@keyframes rec-breathe { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(1.7); opacity: 0; } }
.rec-wave { display: flex; align-items: center; gap: 5px; height: 44px; z-index: 1; }
.rec-wave i { width: 5px; height: 14px; border-radius: 3px; background: #181203; animation: wave .9s ease-in-out infinite; }
.rec-wave i:nth-child(2) { animation-delay: .15s; }
.rec-wave i:nth-child(3) { animation-delay: .3s; }
.rec-wave i:nth-child(4) { animation-delay: .45s; }
.rec-wave i:nth-child(5) { animation-delay: .6s; }
@keyframes wave { 0%, 100% { height: 12px; } 50% { height: 38px; } }
.rec-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(24,18,3,.25); border-top-color: #181203; animation: spin .8s linear infinite; z-index: 1; }
@keyframes spin { to { transform: rotate(360deg); } }

.capture-h1 { font-family: "Spectral", Georgia, serif; font-weight: 500; font-size: 26px; line-height: 1.12; letter-spacing: -.01em; margin: 28px 0 0; }
.capture-hint { font-size: 15px; line-height: 1.5; color: var(--paper-dim); margin: 10px 0 0; max-width: 32ch; }

.smer { margin-top: max(4dvh, 26px); width: 100%; }
.smer-cap { font-size: 12px; letter-spacing: .09em; text-transform: uppercase; color: var(--paper-dim); margin: 0 0 12px; }
.smer-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.smer-chip { font-size: 13px; color: var(--paper-faint); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; }
.smer-chip b { color: var(--lamp); font-weight: 600; }

.text-fallback { margin-top: max(4dvh, 26px); width: 100%; text-align: left; }
.tf-label { display: block; font-size: 12px; letter-spacing: .09em; text-transform: uppercase; color: var(--paper-dim); margin-bottom: 8px; }
.tf-area { width: 100%; resize: vertical; min-height: 96px; background: rgba(26,31,43,.6); border: 1px solid var(--line); border-radius: 14px; padding: 13px 15px; color: var(--paper); font-family: inherit; font-size: 15px; line-height: 1.5; outline: none; transition: border-color .2s ease; }
.tf-area::placeholder { color: rgba(151,144,126,.55); }
.tf-area:focus { border-color: rgba(240,178,100,.55); }

.analyze-btn { margin-top: 20px; width: 100%; height: 54px; border-radius: 16px; font-size: 16px; }
.analyze-btn:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

.err-note { margin: 14px 0 0; font-size: 13px; color: var(--coral, #e26d5c); line-height: 1.45; }

/* ===== Чат ===== */
.thread { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 4px 0 14px; }
.row { display: flex; }
.row.right { justify-content: flex-end; }
.row.left { justify-content: flex-start; }
.bubble { max-width: 86%; border-radius: 14px; padding: 11px 13px; font-size: 14.5px; line-height: 1.45; }
.bubble.user { background: var(--lamp); color: #241a06; }
.bubble.ai { background: rgba(26,31,43,.92); border: .5px solid var(--line); color: var(--paper); }

.card-wrap { width: 100%; max-width: 92%; }
.card-cap { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--paper-dim); margin: 0 0 7px; }
.card-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--lamp); }

.thinking { display: flex; gap: 5px; padding: 6px 2px; }
.thinking i { width: 6px; height: 6px; border-radius: 50%; background: var(--lamp); opacity: .5; animation: think 1.2s ease-in-out infinite; }
.thinking i:nth-child(2) { animation-delay: .2s; }
.thinking i:nth-child(3) { animation-delay: .4s; }
@keyframes think { 0%, 100% { opacity: .3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }

.inputzone { padding-top: 10px; border-top: .5px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
.opts { display: flex; flex-direction: column; gap: 7px; }
.opt { display: flex; align-items: center; gap: 9px; background: rgba(26,31,43,.7); border: .5px solid var(--line); border-radius: 11px; padding: 10px 11px; font-size: 14px; color: var(--paper); text-align: left; cursor: pointer; }
.opt.on { border-color: rgba(240,178,100,.5); }
.tick { width: 18px; height: 18px; border-radius: 6px; background: rgba(237,230,214,.08); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #241a06; flex: 0 0 auto; }
.opt.on .tick { background: var(--lamp); }

.echips { display: flex; flex-wrap: wrap; gap: 7px; }
.echip { display: inline-flex; align-items: center; gap: 6px; border: .5px solid var(--line); border-radius: 999px; padding: 5px 8px 5px 10px; font-size: 13px; color: var(--paper); }
.echip.muted { color: var(--paper-dim); }
.echip .dot { width: 7px; height: 7px; border-radius: 50%; }
.echip .x { border: none; background: none; color: var(--paper-dim); font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; }

.btn-row { display: flex; gap: 10px; align-items: center; }
.ghost-btn { background: none; border: .5px solid var(--line); color: var(--paper-dim); border-radius: 11px; padding: 9px 14px; font-size: 13px; cursor: pointer; }
.ghost-btn.slim { padding: 8px 11px; }

.nums { display: flex; flex-wrap: wrap; gap: 6px; }
.num { width: 30px; height: 34px; border-radius: 8px; border: .5px solid var(--line); background: rgba(26,31,43,.6); color: var(--paper); font-size: 14px; cursor: pointer; }
.num:active { background: var(--lamp); color: #241a06; }

.composer { display: flex; align-items: center; gap: 8px; }
.cin { flex: 1; background: rgba(26,31,43,.6); border: .5px solid var(--line); border-radius: 999px; padding: 10px 15px; color: var(--paper); font-family: inherit; font-size: 14.5px; outline: none; }
.cin:focus { border-color: rgba(240,178,100,.55); }
.cin::placeholder { color: rgba(151,144,126,.55); }
.send { width: 38px; height: 38px; flex: 0 0 auto; border-radius: 50%; border: none; background: var(--lamp); color: #241a06; font-size: 17px; display: grid; place-items: center; cursor: pointer; }
.send:disabled { opacity: .4; cursor: not-allowed; }

.lamp-btn.wide { width: 100%; }

@media (prefers-reduced-motion: reduce) {
	.rec-ring, .rec-wave i, .rec-spin, .thinking i { animation: none !important; }
}
</style>
