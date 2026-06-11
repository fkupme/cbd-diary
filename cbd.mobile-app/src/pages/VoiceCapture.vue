<template>
	<div class="capture-page diary-theme">
		<div class="capture-inner">
			<!-- Назад -->
			<button class="back-btn text-link" @click="goBack" aria-label="Назад">
				← {{ t("common.back", "Назад") }}
			</button>

			<!-- Орб записи -->
			<div class="orb-wrap">
				<button
					class="rec-orb"
					:class="{ listening }"
					@click="toggleListening"
					:aria-label="listening ? 'Остановить' : 'Говорить'"
				>
					<span class="rec-ring"></span>
					<span class="rec-ring rec-ring-2"></span>
					<svg v-if="!listening" class="rec-mic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
							fill="currentColor"
						/>
						<path
							d="M19 11a7 7 0 0 1-14 0M12 18v3"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
					</svg>
					<span v-else class="rec-wave" aria-hidden="true">
						<i></i><i></i><i></i><i></i><i></i>
					</span>
				</button>
			</div>

			<h1 class="capture-h1">
				{{
					listening
						? t("capture.listening", "Слушаю…")
						: t("capture.prompt", "Расскажите, что произошло")
				}}
			</h1>
			<p class="capture-hint">
				{{
					listening
						? t("capture.hintLive", "Говорите свободно — как есть, без формулировок")
						: t("capture.hint", "Нажмите на лампу и опишите ситуацию словами")
				}}
			</p>

			<!-- Что произойдёт: СМЭР -->
			<div class="smer">
				<p class="smer-cap">{{ t("capture.smerCap", "Я разложу рассказ по полочкам") }}</p>
				<div class="smer-row">
					<span class="smer-chip" v-for="part in smer" :key="part.k">
						<b>{{ part.k }}</b>{{ part.label }}
					</span>
				</div>
			</div>

			<!-- Текстовый ввод как запасной путь -->
			<div class="text-fallback">
				<label class="tf-label" for="cap-text">{{
					t("capture.orType", "или опишите словами")
				}}</label>
				<textarea
					id="cap-text"
					v-model="text"
					class="tf-area"
					rows="4"
					:placeholder="t('capture.placeholder', 'Сегодня на встрече я промолчал, хотя был не согласен…')"
				></textarea>
			</div>

			<button class="lamp-btn analyze-btn" :disabled="!canAnalyze" @click="analyze">
				{{ t("capture.analyze", "Разложить по полочкам") }}
			</button>

			<p class="soon-note">
				{{ t("capture.soon", "Распознавание речи и авторазбор подключаются — скоро здесь") }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useLocalization } from "../composables/useLocalization";

const router = useRouter();
const { t } = useLocalization();

const listening = ref(false);
const text = ref("");

const smer = [
	{ k: "С", label: t("capture.smer.s", "итуация") },
	{ k: "М", label: t("capture.smer.m", "ысли") },
	{ k: "Э", label: t("capture.smer.e", "моции") },
	{ k: "Р", label: t("capture.smer.r", "еакция") },
];

const canAnalyze = computed(() => text.value.trim().length > 0);

function toggleListening() {
	// TODO: подключить распознавание речи (Web Speech / нативный плагин)
	// и потоковую расшифровку в text.value
	listening.value = !listening.value;
}

function analyze() {
	if (!canAnalyze.value) return;
	// TODO: отправить text.value модели, извлечь СМЭР, переспросить недостающее,
	// при нескольких событиях — предложить выбор. Пока ведём в ручную форму,
	// прокидывая исходный текст в поле «ситуация».
	router.push({ path: "/add-entry", query: { situation: text.value.trim() } });
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

.back-btn {
	align-self: flex-start;
	font-size: 15px;
	margin-bottom: max(3dvh, 18px);
}

/* ===== Орб ===== */
.orb-wrap {
	margin-top: max(2dvh, 12px);
	display: grid;
	place-items: center;
}

.rec-orb {
	position: relative;
	width: 150px;
	height: 150px;
	border-radius: 50%;
	border: none;
	cursor: pointer;
	display: grid;
	place-items: center;
	color: #181203;
	background: radial-gradient(
		circle at 50% 38%,
		#f7c887 0%,
		var(--lamp) 55%,
		var(--lamp-deep) 100%
	);
	box-shadow:
		0 0 0 1px rgba(240, 178, 100, 0.35),
		0 20px 60px -14px rgba(240, 178, 100, 0.55),
		0 0 90px -8px rgba(240, 178, 100, 0.35);
	transition: transform 0.12s ease;
}
.rec-orb:active {
	transform: scale(0.97);
}

.rec-mic {
	width: 52px;
	height: 52px;
	z-index: 1;
}

.rec-ring {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	border: 1px solid rgba(240, 178, 100, 0.5);
	opacity: 0;
}
.rec-orb.listening .rec-ring {
	animation: rec-breathe 2.4s ease-out infinite;
}
.rec-orb.listening .rec-ring-2 {
	animation-delay: 1.2s;
}

@keyframes rec-breathe {
	0% {
		transform: scale(1);
		opacity: 0.6;
	}
	100% {
		transform: scale(1.7);
		opacity: 0;
	}
}

/* Эквалайзер во время «записи» */
.rec-wave {
	display: flex;
	align-items: center;
	gap: 5px;
	height: 44px;
	z-index: 1;
}
.rec-wave i {
	width: 5px;
	height: 14px;
	border-radius: 3px;
	background: #181203;
	animation: wave 0.9s ease-in-out infinite;
}
.rec-wave i:nth-child(2) { animation-delay: 0.15s; }
.rec-wave i:nth-child(3) { animation-delay: 0.3s; }
.rec-wave i:nth-child(4) { animation-delay: 0.45s; }
.rec-wave i:nth-child(5) { animation-delay: 0.6s; }

@keyframes wave {
	0%, 100% { height: 12px; }
	50% { height: 38px; }
}

/* ===== Текст ===== */
.capture-h1 {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: 26px;
	line-height: 1.12;
	letter-spacing: -0.01em;
	margin: 28px 0 0;
}
.capture-hint {
	font-size: 15px;
	line-height: 1.5;
	color: var(--paper-dim);
	margin: 10px 0 0;
	max-width: 32ch;
}

/* ===== СМЭР ===== */
.smer {
	margin-top: max(4dvh, 26px);
	width: 100%;
}
.smer-cap {
	font-size: 12px;
	letter-spacing: 0.09em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin: 0 0 12px;
}
.smer-row {
	display: flex;
	gap: 8px;
	justify-content: center;
	flex-wrap: wrap;
}
.smer-chip {
	font-size: 13px;
	color: var(--paper-faint);
	border: 1px solid var(--line);
	border-radius: 999px;
	padding: 6px 12px;
}
.smer-chip b {
	color: var(--lamp);
	font-weight: 600;
}

/* ===== Текстовый запас ===== */
.text-fallback {
	margin-top: max(4dvh, 26px);
	width: 100%;
	text-align: left;
}
.tf-label {
	display: block;
	font-size: 12px;
	letter-spacing: 0.09em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin-bottom: 8px;
}
.tf-area {
	width: 100%;
	resize: vertical;
	min-height: 96px;
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 14px;
	padding: 13px 15px;
	color: var(--paper);
	font-family: inherit;
	font-size: 15px;
	line-height: 1.5;
	outline: none;
	transition: border-color 0.2s ease;
}
.tf-area::placeholder {
	color: rgba(151, 144, 126, 0.55);
}
.tf-area:focus {
	border-color: rgba(240, 178, 100, 0.55);
}

/* ===== Кнопка ===== */
.analyze-btn {
	margin-top: 20px;
	width: 100%;
	height: 54px;
	border-radius: 16px;
	font-size: 16px;
}
.analyze-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	box-shadow: none;
}

.soon-note {
	margin: 16px 0 0;
	font-size: 12.5px;
	color: rgba(151, 144, 126, 0.7);
	line-height: 1.5;
	max-width: 34ch;
}

@media (prefers-reduced-motion: reduce) {
	.rec-ring,
	.rec-wave i {
		animation: none !important;
	}
}
</style>
