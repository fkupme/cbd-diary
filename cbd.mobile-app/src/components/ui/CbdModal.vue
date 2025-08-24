<template>
	<q-dialog
		v-model="isOpen"
		persistent
		transition-show="fade"
		transition-hide="fade"
		@hide="onHide"
	>
		<q-card class="modal-card">
			<slot />
		</q-card>
	</q-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
}>();

const isOpen = computed({
	get: () => props.modelValue,
	set: (value: boolean) => emit("update:modelValue", value),
});

const onHide = () => {
	emit("update:modelValue", false);
};
</script>

<style scoped>
.modal-card {
	width: 90vw;
	max-width: 500px;
	max-height: 90vh;
	border-radius: var(--radius-2xl);
	background: var(--bg-elevated);
	border: 1px solid var(--border-color);
	box-shadow: var(--shadow-xl);
	overflow: hidden;
}

/* Адаптация для мобильных устройств */
@media (max-width: 768px) {
	.modal-card {
		width: 95vw;
		max-height: 85vh;
	}
}
</style> 