import { onMounted, onUnmounted } from 'vue';
import { BiometricService } from '../services/BiometricService';
import { useUserStore } from '../stores/user';

/**
 * Композабл для автоматической блокировки приложения системной биометрией
 * Работает по стандартному принципу - как все остальные приложения
 */
export function useBiometricLock() {
	const biometricService = BiometricService.getInstance();
	const userStore = useUserStore();

	let isAuthenticating = false;
	let lastActiveTime = Date.now();

	console.log('🔐 Инициализируем композабл биометрической блокировки');

	async function checkAndRequestBiometric() {
		console.log('🔍 checkAndRequestBiometric вызвана');
		console.log('🔍 isAuthenticating:', isAuthenticating);
		console.log('🔍 userStore.isAuthenticated:', userStore.isAuthenticated);

		// Проверяем, нужна ли биометрия
		try {
			const biometricEnabled = await biometricService.isBiometricEnabled();
			console.log('🔍 biometricEnabled:', biometricEnabled);

			if (!biometricEnabled || !userStore.isAuthenticated || isAuthenticating) {
				console.log('🔍 Биометрия не нужна, выходим');
				return;
			}

			// Проверяем, прошло ли достаточно времени с последней активности (5 секунд для тестирования)
			const timeSinceActive = Date.now() - lastActiveTime;
			console.log('🔍 Времени с последней активности:', timeSinceActive, 'мс');

			if (timeSinceActive < 5000) {
				console.log('🔍 Прошло недостаточно времени, выходим');
				return;
			}

			isAuthenticating = true;
			console.log('🔐 Запрашиваем системную биометрию');

			// ТЕСТ: сначала проверим доступность
			const availability = await biometricService.checkAvailability();
			console.log('🔍 Доступность биометрии:', availability);

			// Просто показываем стандартный системный промпт биометрии
			const result = await biometricService.authenticateForLogin();
			console.log('✅ Результат биометрической аутентификации:', result);

			lastActiveTime = Date.now();
		} catch (error) {
			console.error('❌ Биометрическая аутентификация не пройдена:', error);
			// Можно перенаправить на страницу логина или показать ошибку
			// Но пока просто логируем
		} finally {
			isAuthenticating = false;
		}
	}

	function handleVisibilityChange() {
		console.log('👁️ Изменение видимости:', document.visibilityState);
		if (document.visibilityState === 'visible') {
			// Приложение стало видимым - проверяем биометрию
			console.log(
				'👁️ Приложение стало видимым, проверяем биометрию через 200мс'
			);
			setTimeout(checkAndRequestBiometric, 200);
		} else {
			// Приложение скрыто - обновляем время последней активности
			console.log('👁️ Приложение скрыто, обновляем время активности');
			lastActiveTime = Date.now();
		}
	}

	function handleFocus() {
		console.log('🎯 Приложение получило фокус');
		// Приложение получило фокус
		setTimeout(checkAndRequestBiometric, 200);
	}

	function handlePageShow(event: PageTransitionEvent) {
		console.log('📄 Событие pageshow, persisted:', event.persisted);
		// Страница показана (особенно важно для мобильных)
		if (!event.persisted) {
			setTimeout(checkAndRequestBiometric, 200);
		}
	}

	function handleResume() {
		console.log('▶️ Событие resume приложения');
		setTimeout(checkAndRequestBiometric, 200);
	}

	onMounted(() => {
		console.log('🔐 Монтируем композабл биометрической блокировки');

		// Устанавливаем слушатели событий для автоматической блокировки
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('pageshow', handlePageShow);
		document.addEventListener('resume', handleResume);

		// Дополнительные события для мобильных устройств
		document.addEventListener('deviceready', () => {
			console.log('📱 DeviceReady событие');
		});

		console.log('🔐 Биометрическая блокировка активирована');
		console.log('🔍 Текущее состояние видимости:', document.visibilityState);

		// ТЕСТ: проверим биометрию прямо сейчас
		setTimeout(() => {
			console.log('🧪 ТЕСТ: Проверяем биометрию при монтировании');
			checkAndRequestBiometric();
		}, 1000);
	});

	onUnmounted(() => {
		console.log('🔓 Размонтируем композабл биометрической блокировки');

		// Убираем слушатели при размонтировании
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('focus', handleFocus);
		window.removeEventListener('pageshow', handlePageShow);
		document.removeEventListener('resume', handleResume);

		console.log('🔓 Биометрическая блокировка деактивирована');
	});

	return {
		checkAndRequestBiometric,
	};
}
