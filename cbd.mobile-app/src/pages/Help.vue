<template>
	<div class="help-page diary-theme">
		<div class="help-inner">
			<header class="help-head">
				<button class="icon-btn" @click="$router.back()" aria-label="Назад">
					<q-icon name="arrow_back" />
				</button>
				<h1 class="help-title">{{ t("help.title", "Как это работает") }}</h1>
				<span class="header-spacer"></span>
			</header>

			<p class="help-sub">
				{{
					t(
						"help.sub",
						"Короткий путеводитель по дневнику и идеям КПТ — без терминов и теории, только нужное на старте."
					)
				}}
			</p>

			<CbtFaqAccordion :items="faq" />

			<p class="help-foot">
				{{
					t(
						"help.foot",
						"Приложение не заменяет психотерапевта. В кризисной ситуации звоните 112."
					)
				}}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { CbtFaqAccordion } from "../components/ui";
import { useLocalization } from "../composables/useLocalization";
import { CBT_FAQ } from "../data/cbtFaq";

const { t } = useLocalization();
const faq = CBT_FAQ;
</script>

<style scoped>
.help-page {
	padding-bottom: 40px;
}
.help-inner {
	width: 100%;
	max-width: 440px;
	margin: 0 auto;
	padding: max(5dvh, 28px) 24px 24px;
}

.help-head {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 14px;
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
	transition: background 0.18s ease, color 0.18s ease;
}
.icon-btn:hover {
	background: rgba(240, 178, 100, 0.12);
	color: var(--lamp);
}
.icon-btn .q-icon {
	font-size: 21px;
}
.help-title {
	flex: 1;
	margin: 0;
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(24px, 7vw, 30px);
	letter-spacing: -0.015em;
}
.header-spacer {
	width: 38px;
	flex-shrink: 0;
}

.help-sub {
	margin: 0 0 22px;
	font-size: 14.5px;
	line-height: 1.55;
	color: var(--paper-dim);
}

.help-foot {
	margin: 22px 2px 0;
	font-size: 12.5px;
	line-height: 1.5;
	color: rgba(151, 144, 126, 0.7);
}
</style>
