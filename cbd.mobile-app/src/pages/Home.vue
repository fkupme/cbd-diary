<template>
	<div class="home diary-theme">
		<div class="home-inner">
			<!-- Шапка: дата прописью + приветствие + аватар -->
			<header class="home-head">
				<div class="home-head-text">
					<p class="diary-date">{{ longDate }}</p>
					<h1 class="home-greet">
						{{ greetingWord }}<template v-if="firstName">, {{ firstName }}</template>
					</h1>
				</div>
				<button class="avatar-btn" @click="goToProfile" aria-label="Профиль">
					{{ initial }}
				</button>
			</header>

			<!-- Голосовой захват события — главный сценарий -->
			<section class="capture">
				<button class="capture-orb" @click="openCapture" aria-label="Рассказать, что произошло">
					<span class="orb-ring"></span>
					<span class="orb-ring orb-ring-2"></span>
					<svg class="orb-mic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
				</button>
				<h2 class="capture-title">
					{{ t("home.capture.title", "Расскажите, что произошло") }}
				</h2>
				<p class="capture-sub">
					{{
						t(
							"home.capture.sub",
							"Опишите ситуацию словами — я разложу её на мысли, эмоции и реакции"
						)
					}}
				</p>
				<button class="text-link capture-manual" @click="manualEntry">
					{{ t("home.capture.manual", "или записать текстом") }}
				</button>
			</section>

			<!-- Тихая строка состояния дневника -->
			<p class="diary-stat" v-if="hasEntries">
				<span class="diary-stat-strong">{{ totalEntries }}</span>
				{{ pluralize(totalEntries, ["запись", "записи", "записей"]) }}
				<template v-if="currentStreak > 1">
					· <span class="diary-stat-strong">{{ currentStreak }}</span>
					{{ pluralize(currentStreak, ["день", "дня", "дней"]) }} подряд
				</template>
			</p>

			<!-- Последние страницы дневника -->
			<section class="pages" v-if="recentEntries.length > 0">
				<div class="pages-head">
					<h3 class="pages-title">
						{{ t("home.recentEntries", "Последние страницы") }}
					</h3>
					<button class="text-link" @click="router.push('/diary')">
						{{ t("home.seeAll", "все") }} →
					</button>
				</div>

				<ul class="pages-list">
					<li
						v-for="entry in recentEntries"
						:key="entry.id"
						class="page-card"
						@click="router.push(`/diary?entry=${entry.id}`)"
					>
						<div class="page-card-top">
							<span class="page-time">{{ formatTime(entry.createdAt) }}</span>
							<div class="page-emotions">
								<span
									v-for="emotion in getEntryEmotions(entry).slice(0, 3)"
									:key="emotion.id"
									class="ink-tag"
								>
									<i
										class="ink-dot"
										:style="{ background: getEmotionColor(emotion.id) }"
									></i>
									{{ emotion.name }}
								</span>
							</div>
						</div>
						<p class="page-text">{{ getEntryPreview(entry) }}</p>
					</li>
				</ul>
			</section>

			<!-- Пустой дневник -->
			<section class="empty" v-else>
				<p class="empty-line">
					{{ t("home.empty.line", "Дневник пока пуст") }}
				</p>
				<p class="empty-sub">
					{{
						t(
							"home.empty.sub",
							"Первая запись — самая важная. Расскажите про момент, который сегодня зацепил."
						)
					}}
				</p>
			</section>

			<!-- Мысль на вечер -->
			<p class="diary-thought" v-if="dailyTip">{{ dailyTip }}</p>

			<!-- Дисклеймер -->
			<p class="home-disclaimer">
				{{
					t(
						"home.disclaimer",
						"Приложение не заменяет психотерапевта. В кризисной ситуации звоните 112."
					)
				}}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLocalization } from "../composables/useLocalization";
import { useCBTStore } from "../stores/cbt";
import { useEmotionsStore } from "../stores/emotions";
import { useUserStore } from "../stores/user";

const router = useRouter();
const cbtStore = useCBTStore();
const emotionsStore = useEmotionsStore();
const userStore = useUserStore();
const { t } = useLocalization();

const now = ref(new Date());

// ===== Шапка =====
const greetingWord = computed(() => {
	const hour = now.value.getHours();
	if (hour < 6) return String(t("common.night", "Доброй ночи"));
	if (hour < 12) return String(t("common.morning", "Доброе утро"));
	if (hour < 18) return String(t("common.afternoon", "Добрый день"));
	return String(t("common.evening", "Добрый вечер"));
});

const longDate = computed(() =>
	now.value.toLocaleDateString("ru-RU", {
		weekday: "long",
		day: "numeric",
		month: "long",
	})
);

const firstName = computed(() => {
	const u = userStore.user as any;
	const full = u?.name || u?.username || "";
	return String(full).trim().split(/\s+/)[0] || "";
});

const initial = computed(() => {
	const f = firstName.value;
	const u = userStore.user as any;
	return (f || u?.email || "Я").charAt(0).toUpperCase();
});

// ===== Данные дневника =====
const hasEntries = computed(() => cbtStore.entries.length > 0);
const totalEntries = computed(() => cbtStore.entries.length);
const currentStreak = computed(() => calculateStreak());
const recentEntries = computed(() => cbtStore.entries.slice(0, 3));

const dailyTips = [
	t("home.tips.1", "Записывайте мысль сразу, как заметили сильную эмоцию"),
	t("home.tips.2", "Навязчивые размышления стихают, когда их выписываешь"),
	t("home.tips.3", "Эмоция имеет право быть. Важно, как мы на неё отвечаем"),
	t("home.tips.4", "Дневник помогает увидеть повторяющиеся ходы мысли"),
	t("home.tips.5", "Отмечайте и тёплые моменты дня, не только трудные"),
].map(String);

const dailyTip = computed(() => dailyTips[now.value.getDay() % dailyTips.length]);

// ===== Действия =====
function openCapture() {
	router.push("/capture");
}
function manualEntry() {
	router.push("/add-entry");
}
function goToProfile() {
	router.push("/profile");
}

// ===== Помощники =====
function pluralize(n: number, forms: [string, string, string]): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return forms[0];
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
	return forms[2];
}

function calculateStreak(): number {
	if (cbtStore.entries.length === 0) return 0;

	const sorted = [...cbtStore.entries].sort(
		(a, b) =>
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	let streak = 1;
	for (let i = 0; i < sorted.length - 1; i++) {
		const cur = new Date(sorted[i].createdAt);
		const next = new Date(sorted[i + 1].createdAt);
		cur.setHours(0, 0, 0, 0);
		next.setHours(0, 0, 0, 0);
		const diffDays =
			(cur.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
		if (diffDays === 1) streak++;
		else if (diffDays === 0) continue;
		else break;
	}
	return streak;
}

function formatTime(dateStr: string): string {
	const date = new Date(dateStr);
	const today = new Date();
	const sameDay =
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate();

	if (sameDay) {
		return `${t("common.today", "Сегодня")}, ${date.toLocaleTimeString(
			undefined,
			{ hour: "2-digit", minute: "2-digit" }
		)}`;
	}
	return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function getEntryEmotions(entry: any): Array<{ id: number; name: string }> {
	const thoughts = cbtStore.getEntryThoughts(entry);
	const emotions: Array<{ id: number; name: string }> = [];
	thoughts.forEach((thought) => {
		thought.emotions.forEach((emotion) => {
			const em = emotionsStore.getEmotionById(emotion.emotionId);
			const name = em ? (t(em.nameKey, em.name || "") as string) : "";
			if (name && !emotions.find((e) => e.id === emotion.emotionId)) {
				emotions.push({ id: emotion.emotionId, name });
			}
		});
	});
	return emotions;
}

function getEmotionColor(emotionId: number): string {
	const emotion = emotionsStore.getEmotionById(emotionId);
	if (!emotion) return "var(--lamp)";
	const category = emotionsStore.getCategoryById(emotion.categoryId);
	return category?.color || "var(--lamp)";
}

function getEntryPreview(entry: any): string {
	if (!entry.situation) return String(t("common.noDescription", "Без описания"));
	const max = 110;
	return entry.situation.length <= max
		? entry.situation
		: entry.situation.slice(0, max) + "…";
}

async function loadData() {
	try {
		await Promise.all([emotionsStore.loadAll(), cbtStore.loadEntries()]);
	} catch (error) {
		console.error("Ошибка загрузки данных:", error);
	}
}

onMounted(() => {
	loadData();
	const id = setInterval(() => (now.value = new Date()), 60000);
	// чистим на размонтировании страницы
	return () => clearInterval(id);
});
</script>

<style scoped>
.home {
	padding-bottom: 96px;
}

.home-inner {
	width: 100%;
	max-width: 440px;
	margin: 0 auto;
	padding: max(7dvh, 40px) 24px 24px;
	display: flex;
	flex-direction: column;
}

/* ===== Шапка ===== */
.home-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	animation: rise 0.5s ease-out both;
}

.diary-date {
	margin: 0 0 6px;
}

.home-greet {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(28px, 8vw, 34px);
	line-height: 1.08;
	letter-spacing: -0.015em;
	margin: 0;
}

.avatar-btn {
	flex-shrink: 0;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	border: 1px solid var(--line);
	background: var(--ink-soft);
	color: var(--paper);
	font-family: "Spectral", Georgia, serif;
	font-size: 18px;
	cursor: pointer;
	transition: border-color 0.2s ease;
}
.avatar-btn:hover {
	border-color: var(--lamp);
}

/* ===== Голосовой захват ===== */
.capture {
	margin-top: max(6dvh, 44px);
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	animation: rise 0.5s ease-out 0.08s both;
}

.capture-orb {
	position: relative;
	width: 132px;
	height: 132px;
	border-radius: 50%;
	border: none;
	cursor: pointer;
	display: grid;
	place-items: center;
	color: #181203;
	background:
		radial-gradient(circle at 50% 38%, #f7c887 0%, var(--lamp) 55%, var(--lamp-deep) 100%);
	box-shadow:
		0 0 0 1px rgba(240, 178, 100, 0.35),
		0 18px 50px -12px rgba(240, 178, 100, 0.55),
		0 0 80px -10px rgba(240, 178, 100, 0.35);
	transition: transform 0.12s ease;
}
.capture-orb:active {
	transform: scale(0.96);
}

.orb-mic {
	position: relative;
	width: 46px;
	height: 46px;
	z-index: 1;
}

/* Дыхание лампы */
.orb-ring {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	border: 1px solid rgba(240, 178, 100, 0.5);
	animation: orb-breathe 3.4s ease-out infinite;
}
.orb-ring-2 {
	animation-delay: 1.7s;
}

@keyframes orb-breathe {
	0% {
		transform: scale(1);
		opacity: 0.6;
	}
	100% {
		transform: scale(1.55);
		opacity: 0;
	}
}

.capture-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: 24px;
	letter-spacing: -0.01em;
	margin: 26px 0 0;
}

.capture-sub {
	font-size: 15px;
	line-height: 1.5;
	color: var(--paper-dim);
	margin: 10px 0 0;
	max-width: 30ch;
}

.capture-manual {
	margin-top: 16px;
	font-size: 14px;
	border-bottom: 1px solid transparent;
	padding-bottom: 1px;
}
.capture-manual:hover {
	border-bottom-color: var(--line);
}

/* ===== Тихая строка состояния ===== */
.diary-stat {
	margin: max(6dvh, 40px) 0 0;
	text-align: center;
	font-size: 14px;
	color: var(--paper-dim);
	letter-spacing: 0.01em;
	animation: rise 0.5s ease-out 0.14s both;
}
.diary-stat-strong {
	color: var(--paper);
	font-weight: 600;
}

/* ===== Последние страницы ===== */
.pages {
	margin-top: 28px;
	animation: rise 0.5s ease-out 0.18s both;
}

.pages-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-bottom: 14px;
}

.pages-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: 19px;
	margin: 0;
}

.pages-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.page-card {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 16px;
	padding: 16px 18px;
	cursor: pointer;
	transition: border-color 0.2s ease, background 0.2s ease;
}
.page-card:hover {
	border-color: rgba(240, 178, 100, 0.4);
	background: rgba(26, 31, 43, 0.85);
}

.page-card-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
}

.page-time {
	font-size: 12.5px;
	color: var(--paper-dim);
	white-space: nowrap;
}

.page-emotions {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
	justify-content: flex-end;
}

.ink-tag {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 12px;
	color: var(--paper-faint);
	border: 1px solid var(--line);
	border-radius: 999px;
	padding: 3px 9px 3px 7px;
	white-space: nowrap;
}

.ink-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}

.page-text {
	font-size: 15px;
	line-height: 1.45;
	color: var(--paper);
	margin: 0;
}

/* ===== Пустой дневник ===== */
.empty {
	margin-top: max(6dvh, 40px);
	text-align: center;
	animation: rise 0.5s ease-out 0.14s both;
}
.empty-line {
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 19px;
	color: var(--paper-dim);
	margin: 0 0 8px;
}
.empty-sub {
	font-size: 14px;
	line-height: 1.5;
	color: var(--paper-dim);
	margin: 0 auto;
	max-width: 30ch;
}

/* ===== Мысль на вечер ===== */
.diary-thought {
	margin: max(7dvh, 44px) 0 0;
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 17px;
	line-height: 1.5;
	color: var(--paper-dim);
	text-align: center;
	padding: 0 6px;
}

.home-disclaimer {
	margin: 22px 0 0;
	text-align: center;
	font-size: 12px;
	line-height: 1.5;
	color: rgba(151, 144, 126, 0.7);
}

@keyframes rise {
	from {
		opacity: 0;
		transform: translateY(12px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.home-head,
	.capture,
	.diary-stat,
	.pages,
	.empty {
		animation: none;
	}
	.orb-ring {
		display: none;
	}
}
</style>
