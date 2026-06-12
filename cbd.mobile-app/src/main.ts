import {
	isTauriRuntime,
	registerServiceWorker,
	setupInstallPromptCapture,
} from '@cbd/platform';
import { createPinia } from 'pinia';
import { Dark, Quasar } from 'quasar';
import { createApp } from 'vue';
import App from './App.vue';
import { hasFirebaseConfig, serviceWorkerUrlWithConfig } from './config/firebase';
import i18n from './i18n';
import router from './router';
import { useI18nStore } from './stores/i18n';
import './styles/main.scss';

// PWA (web): перехватываем промпт установки и регистрируем service worker
// как можно раньше — иначе beforeinstallprompt можно пропустить. На native — no-op.
if (!isTauriRuntime()) {
	setupInstallPromptCapture();
	if ('serviceWorker' in navigator) {
		void registerServiceWorker(
			hasFirebaseConfig()
				? serviceWorkerUrlWithConfig()
				: '/firebase-messaging-sw.js'
		);
	}
}

// Import icon libraries
import '@quasar/extras/material-icons-outlined/material-icons-outlined.css';
import '@quasar/extras/material-icons-round/material-icons-round.css';
import '@quasar/extras/material-icons-sharp/material-icons-sharp.css';
import '@quasar/extras/material-icons/material-icons.css';

// Import Quasar css
import 'quasar/src/css/index.sass';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(i18n);
app.use(Quasar, {
	plugins: {
		Dark,
	},
	config: {
		dark: 'auto', // автоматическое определение темной темы
	},
});

// Инициализируем i18n store и синхронизируем с vue-i18n
async function initializeApp() {
	const i18nStore = useI18nStore();

	// Синхронизируем язык между store и vue-i18n
	i18n.global.locale.value = i18nStore.currentLanguage as 'ru' | 'en';

	// Загружаем переводы в фоне — не блокируем маунт приложения
	i18nStore.initialize().catch(console.error);

	// Проверяем сохраненные настройки темной темы
	const savedSettings = localStorage.getItem('cbd-diary-settings');
	if (savedSettings) {
		try {
			const settings = JSON.parse(savedSettings);
			if (settings.app?.darkMode !== undefined) {
				Dark.set(settings.app.darkMode);
				// Синхронизируем с классом на documentElement
				if (settings.app.darkMode) {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
			}
		} catch (error) {
			console.error('Ошибка загрузки настроек темы:', error);
		}
	}

	// Слушаем изменения темной темы Quasar и синхронизируем с нашим классом
	Dark.isActive && document.documentElement.classList.add('dark');

	app.mount('#app');
}

initializeApp();
