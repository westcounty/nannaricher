import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing animation states
 * @param duration Animation duration in milliseconds
 * @returns Animation state and controls
 */
export function useAnimation(duration: number = 800) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const animate = useCallback(() => {
    setIsAnimating(true);
    setProgress(0);
    startTimeRef.current = performance.now();

    const step = (timestamp: number) => {
      if (!startTimeRef.current) return;

      const elapsed = timestamp - startTimeRef.current;
      const newProgress = Math.min(elapsed / duration, 1);
      setProgress(newProgress);

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(step);
  }, [duration]);

  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
    setProgress(1);
  }, []);

  const reset = useCallback(() => {
    stop();
    setProgress(0);
    startTimeRef.current = null;
  }, [stop]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    isAnimating,
    progress,
    animate,
    stop,
    reset,
  };
}

/**
 * Hook for managing shake animation
 * @param intensity Shake intensity in pixels
 * @returns Shake transform value
 */
export function useShakeAnimation(intensity: number = 5) {
  const [offset, setOffset] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startShake = useCallback((duration: number = 500) => {
    setIsShaking(true);
    const startTime = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        setOffset(0);
        setIsShaking(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      // Decrease intensity over time
      const decay = 1 - elapsed / duration;
      const currentIntensity = intensity * decay;
      setOffset(Math.random() * currentIntensity * 2 - currentIntensity);
    }, 50);
  }, [intensity]);

  const stopShake = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setOffset(0);
    setIsShaking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    offset,
    isShaking,
    startShake,
    stopShake,
    transform: `translateX(${offset}px)`,
  };
}

/**
 * Hook for managing bounce animation
 * @returns Bounce scale value
 */
export function useBounceAnimation() {
  const [scale, setScale] = useState(1);
  const [isBouncing, setIsBouncing] = useState(false);
  const animationRef = useRef<number | null>(null);

  const bounce = useCallback(() => {
    setIsBouncing(true);
    const keyframes = [1, 1.2, 0.9, 1.1, 1];
    const durations = [100, 100, 100, 100, 100];
    let totalDuration = 0;
    const steps: { time: number; scale: number }[] = [];

    keyframes.forEach((kf, i) => {
      steps.push({ time: totalDuration, scale: kf });
      totalDuration += durations[i];
    });

    const startTime = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      // Find the two keyframes we're between
      let currentScale = 1;
      for (let i = 0; i < steps.length - 1; i++) {
        if (elapsed >= steps[i].time && elapsed < steps[i + 1].time) {
          const t = (elapsed - steps[i].time) / (steps[i + 1].time - steps[i].time);
          currentScale = steps[i].scale + (steps[i + 1].scale - steps[i].scale) * t;
          break;
        }
      }

      if (progress < 1) {
        setScale(currentScale);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setScale(1);
        setIsBouncing(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setScale(1);
    setIsBouncing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    scale,
    isBouncing,
    bounce,
    stop,
    transform: `scale(${scale})`,
  };
}

/**
 * Hook for managing fade-in animation
 * @param duration Fade duration in milliseconds
 * @returns Opacity and fade controls
 */
export function useFadeAnimation(duration: number = 300) {
  const [opacity, setOpacity] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const animationRef = useRef<number | null>(null);

  const fadeIn = useCallback(() => {
    setIsVisible(true);
    const startTime = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out function
      const eased = 1 - Math.pow(1 - progress, 3);
      setOpacity(eased);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [duration]);

  const fadeOut = useCallback(() => {
    const startTime = performance.now();
    const startOpacity = opacity;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in function
      const eased = Math.pow(progress, 3);
      setOpacity(startOpacity * (1 - eased));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsVisible(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [duration, opacity]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    opacity,
    isVisible,
    fadeIn,
    fadeOut,
    style: { opacity },
  };
}

export default useAnimation;
