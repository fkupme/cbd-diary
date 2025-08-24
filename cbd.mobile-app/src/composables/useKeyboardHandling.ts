import { onMounted, onUnmounted } from 'vue';

export function useKeyboardHandling(
	pageSelector: string = '.page',
	keyboardHeight: number = 320
) {
	let isKeyboardOpen = false;

	const handleInputFocus = (event: Event) => {
		const target = event.target as HTMLElement;

		if (!target || !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
			return;
		}

		if (!isKeyboardOpen) {
			isKeyboardOpen = true;

			const pageElement = document.querySelector(pageSelector) as HTMLElement;
			if (pageElement) {
				pageElement.style.paddingBottom = `${keyboardHeight}px`;

				// Прокручиваем с задержкой, чтобы padding успел примениться
				setTimeout(() => {
					target.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
						inline: 'nearest',
					});
				}, 200);
			}
		}
	};

	const handleInputBlur = () => {
		// Увеличиваем задержку для более надежной проверки
		setTimeout(() => {
			const activeElement = document.activeElement as HTMLElement;
			const isStillFocused =
				activeElement &&
				['INPUT', 'TEXTAREA'].includes(activeElement.tagName) &&
				activeElement.offsetParent !== null; // Проверяем что элемент видимый

			if (!isStillFocused && isKeyboardOpen) {
				isKeyboardOpen = false;

				const pageElement = document.querySelector(pageSelector) as HTMLElement;
				if (pageElement) {
					pageElement.style.paddingBottom = '';
				}
			}
		}, 300);
	};

	// Дополнительно отслеживаем клики вне полей ввода
	const handleDocumentClick = (event: Event) => {
		const target = event.target as HTMLElement;
		if (
			target &&
			!['INPUT', 'TEXTAREA'].includes(target.tagName) &&
			isKeyboardOpen
		) {
			setTimeout(() => {
				const activeElement = document.activeElement as HTMLElement;
				if (
					!activeElement ||
					!['INPUT', 'TEXTAREA'].includes(activeElement.tagName)
				) {
					isKeyboardOpen = false;
					const pageElement = document.querySelector(
						pageSelector
					) as HTMLElement;
					if (pageElement) {
						pageElement.style.paddingBottom = '';
					}
				}
			}, 100);
		}
	};

	// Отслеживание изменений viewport для прямого детекта клавиатуры
	const handleViewportChange = () => {
		if (!window.visualViewport) return;

		const currentHeight = window.visualViewport.height;
		const windowHeight = window.innerHeight;
		const heightDiff = windowHeight - currentHeight;

		if (heightDiff > 100 && !isKeyboardOpen) {
			// Клавиатура открылась
			isKeyboardOpen = true;
			const pageElement = document.querySelector(pageSelector) as HTMLElement;
			if (pageElement) {
				pageElement.style.paddingBottom = `${keyboardHeight}px`;
			}
		} else if (heightDiff <= 50 && isKeyboardOpen) {
			// Клавиатура закрылась
			isKeyboardOpen = false;
			const pageElement = document.querySelector(pageSelector) as HTMLElement;
			if (pageElement) {
				pageElement.style.paddingBottom = '';
			}
		}
	};

	// Обработчик для системной кнопки "Назад" и других событий
	const handleVisibilityChange = () => {
		setTimeout(() => {
			const activeElement = document.activeElement as HTMLElement;
			const isInputFocused =
				activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName);

			if (!isInputFocused && isKeyboardOpen) {
				isKeyboardOpen = false;
				const pageElement = document.querySelector(pageSelector) as HTMLElement;
				if (pageElement) {
					pageElement.style.paddingBottom = '';
				}
			}
		}, 100);
	};

	// Отслеживание window resize для дополнительного детекта
	const handleWindowResize = () => {
		setTimeout(() => {
			if (isKeyboardOpen) {
				const activeElement = document.activeElement as HTMLElement;
				const isInputFocused =
					activeElement &&
					['INPUT', 'TEXTAREA'].includes(activeElement.tagName);

				if (!isInputFocused) {
					isKeyboardOpen = false;
					const pageElement = document.querySelector(
						pageSelector
					) as HTMLElement;
					if (pageElement) {
						pageElement.style.paddingBottom = '';
					}
				}
			}
		}, 150);
	};

	const setupListeners = () => {
		document.addEventListener('focusin', handleInputFocus);
		document.addEventListener('focusout', handleInputBlur);
		document.addEventListener('click', handleDocumentClick);

		// Прямое отслеживание событий клавиатуры
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', handleViewportChange);
		}
		window.addEventListener('resize', handleWindowResize);

		// События для системной кнопки "Назад"
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleVisibilityChange);
		window.addEventListener('blur', handleVisibilityChange);
	};

	const cleanupListeners = () => {
		document.removeEventListener('focusin', handleInputFocus);
		document.removeEventListener('focusout', handleInputBlur);
		document.removeEventListener('click', handleDocumentClick);

		// Убираем отслеживание событий клавиатуры
		if (window.visualViewport) {
			window.visualViewport.removeEventListener('resize', handleViewportChange);
		}
		window.removeEventListener('resize', handleWindowResize);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('focus', handleVisibilityChange);
		window.removeEventListener('blur', handleVisibilityChange);

		// Восстанавливаем стили при cleanup
		const pageElement = document.querySelector(pageSelector) as HTMLElement;
		if (pageElement) {
			pageElement.style.paddingBottom = '';
		}
	};

	onMounted(() => {
		setupListeners();
	});

	onUnmounted(() => {
		cleanupListeners();
	});

	return {
		setupListeners,
		cleanupListeners,
	};
}
