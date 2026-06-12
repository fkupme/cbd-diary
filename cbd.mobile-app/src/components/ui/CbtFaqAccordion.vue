<template>
	<ul class="faq">
		<li
			v-for="item in items"
			:key="item.id"
			class="faq-item"
			:class="{ open: openId === item.id }"
		>
			<button
				type="button"
				class="faq-q"
				:aria-expanded="openId === item.id"
				@click="toggle(item.id)"
			>
				<span class="faq-q-text">{{ item.q }}</span>
				<q-icon
					name="expand_more"
					class="faq-chevron"
					:class="{ rotated: openId === item.id }"
				/>
			</button>

			<div v-show="openId === item.id" class="faq-a">
				<template v-for="(block, i) in item.blocks" :key="i">
					<p v-if="block.type === 'p'" class="faq-p">{{ block.text }}</p>

					<ul v-else-if="block.type === 'list'" class="faq-list">
						<li v-for="(li, j) in block.items" :key="j">{{ li }}</li>
					</ul>

					<div v-else-if="block.type === 'example'" class="faq-example">
						<p v-if="block.title" class="faq-example-title">
							{{ block.title }}
						</p>
						<p v-for="(ln, j) in block.lines" :key="j" class="faq-example-line">
							{{ ln }}
						</p>
					</div>

					<p v-else-if="block.type === 'note'" class="faq-note">
						{{ block.text }}
					</p>
				</template>
			</div>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { FaqItem } from "../../data/cbtFaq";

interface Props {
	items: FaqItem[];
	// Какой пункт раскрыть изначально (для подсказок-«?» из формы)
	focusId?: string;
}
const props = defineProps<Props>();

const openId = ref<string | null>(props.focusId ?? null);

// При смене focusId (например, при открытии bottom-sheet на другом поле)
watch(
	() => props.focusId,
	(id) => {
		if (id) openId.value = id;
	}
);

function toggle(id: string) {
	openId.value = openId.value === id ? null : id;
}
</script>

<style scoped>
.faq {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.faq-item {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 16px;
	overflow: hidden;
	transition: border-color 0.2s ease, background 0.2s ease;
}
.faq-item.open {
	border-color: rgba(240, 178, 100, 0.4);
	background: rgba(26, 31, 43, 0.85);
}

.faq-q {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 15px 16px;
	border: none;
	background: none;
	color: var(--paper);
	font-family: inherit;
	font-size: 15.5px;
	font-weight: 500;
	text-align: left;
	cursor: pointer;
}
.faq-q-text {
	flex: 1;
}
.faq-chevron {
	flex-shrink: 0;
	font-size: 22px;
	color: var(--paper-dim);
	transition: transform 0.25s ease, color 0.2s ease;
}
.faq-chevron.rotated {
	transform: rotate(180deg);
	color: var(--lamp);
}

.faq-a {
	padding: 0 16px 16px;
	animation: faq-in 0.22s ease-out both;
}
@keyframes faq-in {
	from {
		opacity: 0;
		transform: translateY(-4px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.faq-p {
	margin: 0 0 10px;
	font-size: 14.5px;
	line-height: 1.55;
	color: var(--paper-faint);
}
.faq-p:last-child {
	margin-bottom: 0;
}

.faq-list {
	list-style: none;
	margin: 0 0 10px;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.faq-list li {
	position: relative;
	padding-left: 16px;
	font-size: 14px;
	line-height: 1.5;
	color: var(--paper-faint);
}
.faq-list li::before {
	content: "";
	position: absolute;
	left: 2px;
	top: 9px;
	width: 5px;
	height: 5px;
	border-radius: 50%;
	background: var(--lamp);
}

.faq-example {
	margin: 0 0 10px;
	padding: 12px 14px;
	background: rgba(18, 21, 29, 0.5);
	border: 1px solid var(--line);
	border-left: 2px solid rgba(240, 178, 100, 0.5);
	border-radius: 10px;
}
.faq-example-title {
	margin: 0 0 8px;
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 14px;
	color: var(--paper-dim);
}
.faq-example-line {
	margin: 0 0 5px;
	font-size: 13.5px;
	line-height: 1.45;
	color: var(--paper);
}
.faq-example-line:last-child {
	margin-bottom: 0;
}

.faq-note {
	margin: 0;
	padding: 11px 13px;
	background: rgba(240, 178, 100, 0.07);
	border: 1px solid rgba(240, 178, 100, 0.22);
	border-radius: 10px;
	font-size: 13.5px;
	line-height: 1.5;
	color: var(--paper);
}
</style>
