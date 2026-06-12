import { emotionsService } from '@/services/api/EmotionsService';
import { isTauriRuntime } from '@cbd/platform';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// Ленивый invoke — переводы кэшируются в локальной SQLite только на native.
async function getInvoke() {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke;
}

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

		// 1) Тянем пачки переводов с сервера (категории + эмоции) — best-effort.
		//    Падение сети/сервера НЕ должно обнулять уже закэшированные переводы.
		let bundles: Record<string, Record<string, string>> = {};
		try {
			bundles = await emotionsService.getEmotionI18nBundles();
		} catch (err: any) {
			console.warn(
				'i18n: не удалось обновить переводы с сервера, работаем на локальном кэше',
				err
			);
		}

		// web (online-only): локальной SQLite нет — держим переводы текущего
		// языка прямо в памяти из серверных бандлов.
		if (!isTauriRuntime()) {
			const map = bundles[languageCode];
			if (map && Object.keys(map).length > 0) {
				customTranslations.value = map;
			}
			isLoading.value = false;
			return;
		}

		// 2a) native: апсертим пачки в локальную БД (SQLite) через Tauri команду
		try {
			const invoke = await getInvoke();
			for (const lang of Object.keys(bundles)) {
				const entries = Object.entries(bundles[lang]);
				if (entries.length > 0) {
					await invoke<number>('upsert_translations_bulk', {
						languageCode: lang,
						translations: entries,
					});
				}
			}
		} catch (err: any) {
			console.warn('i18n: upsert переводов в локальную БД не удался', err);
		}

		// 2b) native: всегда гидрируем кэш текущего языка из локальной БД
		try {
			const invoke = await getInvoke();
			const fromDb = await invoke<Array<[string, string]>>(
				'get_translations_for_language',
				{ languageCode }
			);
			const map: Record<string, string> = {};
			for (const [k, v] of fromDb) {
				map[k] = v;
			}
			if (Object.keys(map).length > 0) {
				customTranslations.value = map;
			}
		} catch (err: any) {
			error.value = String(err);
			console.error('Ошибка гидратации переводов из локальной БД:', err);
		} finally {
			isLoading.value = false;
		}
	}

	async function getTranslation(key: string): Promise<string> {
		// Сначала проверяем кастомные переводы
		if (customTranslations.value[key]) {
			return customTranslations.value[key];
		}

		// web: локальной БД нет — отдаём ключ как фолбэк (vue-i18n переведёт сам)
		if (!isTauriRuntime()) {
			return key;
		}

		try {
			const invoke = await getInvoke();
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
