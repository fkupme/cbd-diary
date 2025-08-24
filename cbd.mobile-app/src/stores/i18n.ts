import { emotionsService } from '@/services/api/EmotionsService';
import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// Типы данных, соответствующие Rust backend
export interface Translation {
	id: number;
	language_code: string;
	translation_key: string;
	translation_value: string;
	context?: string;
	created_at: string;
}

export const useI18nStore = defineStore('i18n', () => {
	// State
	const currentLanguage = ref<string>(
		localStorage.getItem('preferred_language') || 'ru'
	);
	const customTranslations = ref<Record<string, string>>({});
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	// Getters
	const availableLanguages = computed(() => [
		{ code: 'ru', name: 'Русский', flag: '🇷🇺' },
		{ code: 'en', name: 'English', flag: '🇺🇸' },
		{ code: 'es', name: 'Español', flag: '🇪🇸' },
		{ code: 'de', name: 'Deutsch', flag: '🇩🇪' },
		{ code: 'fr', name: 'Français', flag: '🇫🇷' },
		{ code: 'zh', name: '中文', flag: '🇨🇳' },
	]);

	const currentLanguageInfo = computed(
		() =>
			availableLanguages.value.find(
				lang => lang.code === currentLanguage.value
			) || availableLanguages.value[0]
	);

	// Actions
	async function setLanguage(languageCode: string): Promise<void> {
		if (currentLanguage.value === languageCode) return;

		currentLanguage.value = languageCode;
		await loadCustomTranslations(languageCode);

		// Сохраняем выбранный язык
		localStorage.setItem('preferred_language', languageCode);
	}

	async function loadCustomTranslations(languageCode: string): Promise<void> {
		isLoading.value = true;
		error.value = null;

		try {
			// 1) Тянем пачки переводов с сервера (категории + эмоции) для всех языков
			const bundles = await emotionsService.getEmotionI18nBundles();
			const langs = Object.keys(bundles);
			for (const lang of langs) {
				const entries = Object.entries(bundles[lang]);
				if (entries.length > 0) {
					// Сохраняем в локальную БД (SQLite) через Tauri команду
					await invoke<number>('upsert_translations_bulk', {
						languageCode: lang,
						translations: entries,
					});
				}
			}

			// 2) Гидрируем кэш для текущего языка из локальной БД
			const fromDb = await invoke<Array<[string, string]>>(
				'get_translations_for_language',
				{ languageCode }
			);
			const map: Record<string, string> = {};
			for (const [k, v] of fromDb) {
				map[k] = v;
			}
			customTranslations.value = map;
		} catch (err: any) {
			error.value = String(err);
			console.error('Ошибка загрузки переводов:', err);
		} finally {
			isLoading.value = false;
		}
	}

	async function getTranslation(key: string): Promise<string> {
		// Сначала проверяем кастомные переводы
		if (customTranslations.value[key]) {
			return customTranslations.value[key];
		}

		try {
			const translation = await invoke<string | null>('get_translation', {
				languageCode: currentLanguage.value,
				translationKey: key,
			});

			if (translation) {
				customTranslations.value[key] = translation;
				return translation;
			}
		} catch (err) {
			console.error(`Ошибка загрузки перевода для ключа ${key}:`, err);
		}

		return key;
	}

	// Инициализация
	async function initialize(): Promise<void> {
		await loadCustomTranslations(currentLanguage.value);
	}

	function clearError(): void {
		error.value = null;
	}

	return {
		// State
		currentLanguage,
		customTranslations,
		isLoading,
		error,

		// Getters
		availableLanguages,
		currentLanguageInfo,

		// Actions
		setLanguage,
		loadCustomTranslations,
		getTranslation,
		initialize,
		clearError,
	};
});
