import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Новая проверка для iOS физических устройств согласно Tauri 2.0
// @ts-expect-error process is a nodejs global
const mobileHost = process.env.TAURI_DEV_PUBLIC_NETWORK_HOST_REQUIRED
	? host
	: false;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
	plugins: [
		vue({
			template: { transformAssetUrls },
		}),
		quasar({
			// Убираем sassVariables - будем использовать кастомную дизайн систему
		}),
	],

	// Настройка алиасов для путей
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false, // Используем адрес, который указывает Tauri
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
			  }
			: undefined,
		watch: {
			// 3. tell vite to ignore watching `src-tauri`
			ignored: ['**/src-tauri/**'],
		},
	},
}));
