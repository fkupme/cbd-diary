# Система локализации

Система локализации состоит из трех компонентов:

## 1. Vue-i18n (базовые переводы)

Основная библиотека для переводов. Переводы хранятся в `src/i18n/index.ts`.

## 2. I18n Store (кастомные переводы)

Pinia store для переводов из базы данных и управления состоянием. Файл: `src/stores/i18n.ts`.

## 3. useLocalization Composable

Composable для интеграции vue-i18n с i18n store. Файл: `src/composables/useLocalization.ts`.

## Использование в компонентах

```vue
<template>
	<div>
		<h1>{{ t('settings.title') }}</h1>
		<p>{{ t('common.loading') }}</p>

		<!-- Смена языка -->
		<button @click="changeLanguage('en')">English</button>
		<button @click="changeLanguage('ru')">Русский</button>
	</div>
</template>

<script setup lang="ts">
import { useLocalization } from '@/composables/useLocalization';

const { t, setLanguage, currentLanguage, availableLanguages } =
	useLocalization();

const changeLanguage = async (lang: string) => {
	await setLanguage(lang);
};
</script>
```

## Доступные функции

### t(key: string, fallback?: string)

Функция перевода. Сначала ищет в vue-i18n, потом в кастомных переводах store.

### setLanguage(languageCode: string)

Смена языка. Обновляет и vue-i18n и store.

### currentLanguage

Текущий выбранный язык.

### availableLanguages

Массив доступных языков с информацией (код, название, флаг).

### currentLanguageInfo

Информация о текущем языке.

## Добавление новых переводов

### В vue-i18n (статические переводы)

Редактируй `src/i18n/index.ts`:

```typescript
const messages = {
	ru: {
		mySection: {
			newKey: 'Новый перевод',
		},
	},
	en: {
		mySection: {
			newKey: 'New translation',
		},
	},
};
```

### В store (динамические переводы)

Используй функцию `getTranslation()` для загрузки из БД.

## Поддерживаемые языки

- Русский (ru) - по умолчанию
- English (en)

Для добавления нового языка:

1. Добавь переводы в `src/i18n/index.ts`
2. Обнови `availableLanguages` в `src/stores/i18n.ts`
