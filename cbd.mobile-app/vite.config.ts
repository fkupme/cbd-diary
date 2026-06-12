import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
// mode === 'web' → PWA-сборка для браузера; иначе — нативная сборка под Tauri.
export default defineConfig(async ({ mode }) => {
	const isWeb = mode === 'web';

	return {
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
				// Платформенный пакет потребляется как исходники (без отдельной сборки)
				'@cbd/platform': fileURLToPath(
					new URL('../packages/platform/src', import.meta.url)
				),
			},
		},

		// Web-сборка PWA уезжает в отдельную папку, чтобы не затирать Tauri dist
		...(isWeb
			? { build: { outDir: 'dist-web', target: 'es2020' } }
			: {}),

		// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
		//
		// 1. prevent vite from obscuring rust errors
		clearScreen: false,
		// 2. tauri expects a fixed port, fail if that port is not available
		server: isWeb
			? {
					// Обычный web dev-сервер (PWA в браузере)
					port: 5174,
					strictPort: false,
			  }
			: {
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
	};
});
