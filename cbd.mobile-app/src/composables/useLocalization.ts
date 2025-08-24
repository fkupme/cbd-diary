import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useI18nStore } from '../stores/i18n';

export function useLocalization() {
	const { t, locale } = useI18n();
	const i18nStore = useI18nStore();

	// Синхронизируем vue-i18n locale с store
	watch(
		() => i18nStore.currentLanguage,
		newLang => {
			if (locale.value !== newLang) {
				locale.value = newLang;
			}
		},
		{ immediate: true }
	);

	// Функция для перевода с безопасным фоллбеком
	const translate = (key: unknown, fallback?: string) => {
		try {
			if (typeof key !== 'string' || key.length === 0) {
				return fallback || '';
			}

			// Сначала vue-i18n
			const vueTranslation = t(key as string);
			if (vueTranslation && vueTranslation !== key)
				return vueTranslation as string;

			// Затем кастомные переводы из store
			if (i18nStore.customTranslations[key as string]) {
				return i18nStore.customTranslations[key as string];
			}

			return fallback || (key as string);
		} catch (err) {
			// На случай «Invalid arguments» от vue-i18n — возвращаем фоллбек, не падаем в рантайме
			return fallback || (typeof key === 'string' ? key : '');
		}
	};

	// Смена языка
	const setLanguage = async (languageCode: string) => {
		await i18nStore.setLanguage(languageCode);
		locale.value = languageCode;
	};

	return {
		t: translate,
		locale,
		setLanguage,
		currentLanguage: i18nStore.currentLanguage,
		currentLanguageInfo: i18nStore.currentLanguageInfo,
		availableLanguages: i18nStore.availableLanguages,
		isLoading: i18nStore.isLoading,
		error: i18nStore.error,
	};
}
