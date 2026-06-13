<template>
	<component
		:is="entryId ? 'button' : 'div'"
		class="evcard"
		:class="{ clickable: !!entryId }"
		@click="onClick"
	>
		<div class="evcard-title">{{ title }}</div>

		<div class="evcard-tags" v-if="emotions.length">
			<span class="ink-tag" v-for="e in emotions" :key="e.emotionId">
				<span class="dot" :style="{ background: dotColor(e.emotionId) }"></span>
				{{ emoName(e.emotionId) }}<span class="iv" v-if="e.intensity">&nbsp;{{ e.intensity }}</span>
			</span>
		</div>

		<div class="evcard-foot">
			<span class="evcard-meta">{{ meta }}</span>
			<span class="evcard-open" v-if="entryId">{{ t("intake.open", "открыть") }} ›</span>
		</div>
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useLocalization } from "../composables/useLocalization";
import { useEmotionsStore } from "../stores/emotions";

const props = defineProps<{
	title: string;
	draft: any;
	entryId?: string | null;
}>();

const emit = defineEmits<{ (e: "open", entryId: string): void }>();

const { t } = useLocalization();
const emotionsStore = useEmotionsStore();

const thoughts = computed(() =>
	Array.isArray(props.draft?.thoughts) ? props.draft.thoughts : [],
);
const emotions = computed(
	() => (thoughts.value[0]?.emotions as { emotionId: number; intensity: number }[]) || [],
);

const meta = computed(() => {
	const n = thoughts.value.filter((x: any) => x?.thought?.trim()).length;
	const parts: string[] = [];
	if (n) parts.push(`${n} ${plural(n, "мысль", "мысли", "мыслей")}`);
	if (props.draft?.reactions?.trim()) parts.push("реакция");
	return parts.join(" · ") || "ситуация";
});

function dotColor(id: number): string {
	return emotionsStore.getEmotionColor(id) || "var(--lamp)";
}
function emoName(id: number): string {
	const e = emotionsStore.getEmotionById(id);
	if (!e) return "";
	return t((e as any).nameKey, (e as any).name || "");
}
function onClick() {
	if (props.entryId) emit("open", props.entryId);
}
function plural(n: number, a: string, b: string, c: string): string {
	const m10 = n % 10;
	const m100 = n % 100;
	if (m10 === 1 && m100 !== 11) return a;
	if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
	return c;
}
</script>

<style scoped>
.evcard {
	display: block;
	width: 100%;
	text-align: left;
	background: rgba(26, 31, 43, 0.55);
	border: 0.5px solid rgba(240, 178, 100, 0.42);
	border-radius: 14px;
	padding: 12px 13px 0;
	color: var(--paper);
	font-family: inherit;
}
.evcard.clickable {
	cursor: pointer;
	transition: border-color 0.18s ease, background 0.18s ease;
}
.evcard.clickable:active {
	background: rgba(26, 31, 43, 0.8);
}

.evcard-title {
	font-family: "Spectral", Georgia, serif;
	font-size: 15px;
	line-height: 1.25;
	color: var(--paper);
	margin-bottom: 9px;
}

.evcard-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 10px;
}
.ink-tag {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: 0.5px solid var(--line);
	border-radius: 999px;
	padding: 3px 9px 3px 7px;
	font-size: 12px;
	color: var(--paper-faint);
}
.dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex: 0 0 auto;
}
.iv {
	color: var(--paper-dim);
	font-size: 11px;
}

.evcard-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-top: 0.5px solid rgba(237, 230, 214, 0.1);
	padding: 9px 0;
}
.evcard-meta {
	font-size: 11px;
	color: var(--paper-dim);
}
.evcard-open {
	font-size: 12px;
	color: var(--lamp);
}
</style>
