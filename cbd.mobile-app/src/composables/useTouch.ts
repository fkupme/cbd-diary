/**
 * Touch and Haptic Feedback Composable
 * Provides touch event handling and haptic feedback for mobile devices
 */

import { ref, onMounted } from 'vue';

export interface TouchOptions {
  enableHaptic?: boolean;
  hapticStyle?: 'light' | 'medium' | 'heavy';
  preventDefaultTouch?: boolean;
  swipeThreshold?: number;
}

export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
}

export function useTouch(options: TouchOptions = {}) {
  const {
    enableHaptic = true,
    hapticStyle = 'light',
    preventDefaultTouch = false,
    swipeThreshold = 50,
  } = options;

  // Touch state
  const isTouching = ref(false);
  const touchStart = ref<{ x: number; y: number; time: number } | null>(null);
  const touchEnd = ref<{ x: number; y: number; time: number } | null>(null);

  // Device capabilities
  const isTouchDevice = ref(false);
  const supportsHaptic = ref(false);

  // Detect device capabilities
  onMounted(() => {
    isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    supportsHaptic.value = 'vibrate' in navigator;
  });

  /**
   * Trigger haptic feedback if supported
   */
  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = hapticStyle) => {
    if (!enableHaptic || !supportsHaptic.value) return;

    try {
      // Use the new Haptic API if available (iOS Safari 15+)
      if ('DeviceMotionEvent' in window && 'requestPermission' in DeviceMotionEvent) {
        // iOS haptic patterns
        const patterns = {
          light: [10],
          medium: [20],
          heavy: [30],
        };
        navigator.vibrate(patterns[style]);
      } else {
        // Fallback vibration patterns
        const patterns = {
          light: [25],
          medium: [50],
          heavy: [75],
        };
        navigator.vibrate(patterns[style]);
      }
    } catch (error) {
      console.warn('Haptic feedback not available:', error);
    }
  };

  /**
   * Handle touch start
   */
  const handleTouchStart = (event: TouchEvent) => {
    if (preventDefaultTouch) {
      event.preventDefault();
    }

    isTouching.value = true;
    const touch = event.touches[0];
    touchStart.value = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    if (enableHaptic) {
      triggerHaptic('light');
    }
  };

  /**
   * Handle touch end
   */
  const handleTouchEnd = (event: TouchEvent) => {
    if (preventDefaultTouch) {
      event.preventDefault();
    }

    isTouching.value = false;
    const touch = event.changedTouches[0];
    touchEnd.value = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  /**
   * Calculate swipe direction and distance
   */
  const getSwipeDirection = (): SwipeDirection => {
    if (!touchStart.value || !touchEnd.value) {
      return { direction: null, distance: 0, velocity: 0 };
    }

    const deltaX = touchEnd.value.x - touchStart.value.x;
    const deltaY = touchEnd.value.y - touchStart.value.y;
    const deltaTime = touchEnd.value.time - touchStart.value.time;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime;

    if (distance < swipeThreshold) {
      return { direction: null, distance, velocity };
    }

    // Determine primary direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return {
        direction: deltaX > 0 ? 'right' : 'left',
        distance,
        velocity,
      };
    } else {
      return {
        direction: deltaY > 0 ? 'down' : 'up',
        distance,
        velocity,
      };
    }
  };

  /**
   * Add touch events to an element
   */
  const addTouchListeners = (element: HTMLElement) => {
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventDefaultTouch });
    element.addEventListener('touchend', handleTouchEnd, { passive: !preventDefaultTouch });
  };

  /**
   * Remove touch events from an element
   */
  const removeTouchListeners = (element: HTMLElement) => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
  };

  /**
   * Handle button press with haptic feedback
   */
  const handleButtonPress = (callback?: () => void, hapticType: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (enableHaptic) {
      triggerHaptic(hapticType);
    }
    callback?.();
  };

  /**
   * Long press detection
   */
  const useLongPress = (
    callback: () => void,
    threshold: number = 500,
    hapticOnTrigger: boolean = true
  ) => {
    let timeoutId: number | null = null;

    const start = () => {
      timeoutId = window.setTimeout(() => {
        if (hapticOnTrigger && enableHaptic) {
          triggerHaptic('heavy');
        }
        callback();
      }, threshold);
    };

    const cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return {
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onTouchMove: cancel,
    };
  };

  /**
   * Double tap detection
   */
  const useDoubleTap = (callback: () => void, threshold: number = 300) => {
    let lastTap = 0;

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTap < threshold) {
        if (enableHaptic) {
          triggerHaptic('medium');
        }
        callback();
      }
      lastTap = now;
    };

    return { onTouchEnd: handleTap };
  };

  /**
   * Swipe gesture handler
   */
  const useSwipe = (callbacks: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
  }) => {
    const handleSwipe = () => {
      const swipe = getSwipeDirection();
      
      if (swipe.direction && enableHaptic) {
        triggerHaptic('light');
      }

      switch (swipe.direction) {
        case 'left':
          callbacks.onSwipeLeft?.();
          break;
        case 'right':
          callbacks.onSwipeRight?.();
          break;
        case 'up':
          callbacks.onSwipeUp?.();
          break;
        case 'down':
          callbacks.onSwipeDown?.();
          break;
      }
    };

    return {
      onTouchStart: handleTouchStart,
      onTouchEnd: (event: TouchEvent) => {
        handleTouchEnd(event);
        handleSwipe();
      },
    };
  };

  return {
    // State
    isTouching,
    isTouchDevice,
    supportsHaptic,
    touchStart,
    touchEnd,

    // Methods
    triggerHaptic,
    handleButtonPress,
    getSwipeDirection,
    addTouchListeners,
    removeTouchListeners,

    // Gesture composables
    useLongPress,
    useDoubleTap,
    useSwipe,

    // Event handlers
    handleTouchStart,
    handleTouchEnd,
  };
}

/**
 * Touch-optimized button composable
 */
export function useTouchButton(
  callback: (event?: Event) => void,
  options: {
    hapticStyle?: 'light' | 'medium' | 'heavy';
    enableLongPress?: boolean;
    longPressCallback?: () => void;
    longPressThreshold?: number;
  } = {}
) {
  const {
    hapticStyle = 'medium',
    enableLongPress = false,
    longPressCallback,
    longPressThreshold = 500,
  } = options;

  const { handleButtonPress, useLongPress, isTouchDevice } = useTouch({ hapticStyle });

  const longPress = enableLongPress && longPressCallback
    ? useLongPress(longPressCallback, longPressThreshold)
    : {};

  const onClick = (event?: Event) => {
    handleButtonPress(() => callback(event), hapticStyle);
  };

  return {
    onClick,
    isTouchDevice,
    ...longPress,
  };
}

/**
 * Touch-optimized list item composable
 */
export function useTouchListItem(
  onTap: () => void,
  options: {
    enableSwipe?: boolean;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
  } = {}
) {
  const { enableSwipe = false, onSwipeLeft, onSwipeRight } = options;

  const { handleButtonPress, useSwipe } = useTouch();

  if (enableSwipe && (onSwipeLeft || onSwipeRight)) {
    return useSwipe({
      onSwipeLeft,
      onSwipeRight,
    });
  }

  return {
    onTouchEnd: () => handleButtonPress(onTap, 'light'),
  };
}