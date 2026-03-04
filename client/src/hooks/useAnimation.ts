import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/* ============================================
   VALUE ANIMATION TYPES
   ============================================ */

export interface AnimatedValueOptions {
  duration?: number;
  decimals?: number;
  easing?: 'linear' | 'easeOut' | 'easeInOut';
}

/* ============================================
   BASE ANIMATION HOOK
   ============================================ */

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

/* ============================================
   VALUE ANIMATION HOOK
   For animating numbers (money, GPA, etc.)
   ============================================ */

/**
 * Hook for animating numeric value changes
 * @param initialValue Starting value
 * @param options Animation options
 * @returns Animated value and setter
 */
export function useAnimatedValue(
  initialValue: number,
  options: AnimatedValueOptions = {}
) {
  const { duration = 500, decimals = 0, easing = 'easeOut' } = options;
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startValueRef = useRef(initialValue);
  const targetValueRef = useRef(initialValue);
  const startTimeRef = useRef<number | null>(null);

  // Easing functions
  const easingFunctions = useMemo(
    () => ({
      linear: (t: number) => t,
      easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
      easeInOut: (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    }),
    []
  );

  const animateTo = useCallback(
    (targetValue: number) => {
      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      startValueRef.current = displayValue;
      targetValueRef.current = targetValue;
      startTimeRef.current = performance.now();
      setIsAnimating(true);

      const step = (timestamp: number) => {
        if (!startTimeRef.current) return;

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFunctions[easing](progress);

        const currentValue =
          startValueRef.current +
          (targetValueRef.current - startValueRef.current) * easedProgress;

        setDisplayValue(Number(currentValue.toFixed(decimals)));

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          setIsAnimating(false);
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [displayValue, duration, decimals, easing, easingFunctions]
  );

  // Instant set without animation
  const setValueInstant = useCallback((value: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setDisplayValue(value);
    setIsAnimating(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    value: displayValue,
    isAnimating,
    animateTo,
    setValueInstant,
    formattedValue: displayValue.toFixed(decimals),
  };
}

/* ============================================
   PIECE MOVEMENT ANIMATION HOOK
   ============================================ */

export interface Position {
  x: number;
  y: number;
}

/**
 * Hook for animating piece movement along a path
 * @param initialPosition Starting position
 * @param path Array of positions to move through
 * @param stepDuration Time per step in ms
 */
export function usePieceMovement(
  initialPosition: Position,
  stepDuration: number = 300
) {
  const [currentPosition, setCurrentPosition] = useState(initialPosition);
  const [isMoving, setIsMoving] = useState(false);
  const [pathIndex, setPathIndex] = useState(0);
  const animationRef = useRef<number | null>(null);
  const pathRef = useRef<Position[]>([]);
  const startTimeRef = useRef<number | null>(null);

  const moveAlongPath = useCallback(
    (path: Position[]) => {
      if (path.length === 0) return;

      // Cancel ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      pathRef.current = path;
      setPathIndex(0);
      setIsMoving(true);
      startTimeRef.current = performance.now();

      let currentStep = 0;
      const step = (timestamp: number) => {
        if (!startTimeRef.current) return;

        const elapsed = timestamp - startTimeRef.current;
        const totalSteps = pathRef.current.length;
        const stepProgress = elapsed / stepDuration;

        // Calculate current step and interpolation
        const exactStep = Math.min(stepProgress, totalSteps - 0.001);
        const stepIndex = Math.floor(exactStep);
        const interpolation = exactStep - stepIndex;

        if (stepIndex !== currentStep) {
          currentStep = stepIndex;
          setPathIndex(stepIndex);
        }

        // Interpolate between current and next position
        const fromPos = pathRef.current[stepIndex];
        const toPos = pathRef.current[Math.min(stepIndex + 1, totalSteps - 1)];

        if (fromPos && toPos) {
          const x = fromPos.x + (toPos.x - fromPos.x) * interpolation;
          const y = fromPos.y + (toPos.y - fromPos.y) * interpolation;
          setCurrentPosition({ x, y });
        }

        if (stepProgress < totalSteps) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          // Ensure we end at the final position
          const finalPos = pathRef.current[totalSteps - 1];
          if (finalPos) {
            setCurrentPosition(finalPos);
          }
          setIsMoving(false);
          setPathIndex(totalSteps - 1);
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [stepDuration]
  );

  const stopMovement = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsMoving(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    position: currentPosition,
    isMoving,
    pathIndex,
    moveAlongPath,
    stopMovement,
  };
}

/* ============================================
   CARD FLIP ANIMATION HOOK
   ============================================ */

/**
 * Hook for card flip animation
 * @param isFlipped Initial flip state
 * @param duration Flip duration in ms
 */
export function useCardFlip(isFlipped: boolean = false, duration: number = 600) {
  const [flipped, setFlipped] = useState(isFlipped);
  const [isAnimating, setIsAnimating] = useState(false);
  const [rotationY, setRotationY] = useState(isFlipped ? 180 : 0);
  const animationRef = useRef<number | null>(null);

  const flip = useCallback(() => {
    // Cancel ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setIsAnimating(true);
    const startRotation = rotationY;
    const targetRotation = flipped ? startRotation - 180 : startRotation + 180;
    const startTime = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out for natural feel
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (targetRotation - startRotation) * eased;

      setRotationY(currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setFlipped(!flipped);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [flipped, rotationY, duration]);

  const flipToFront = useCallback(() => {
    if (!flipped) return;
    flip();
  }, [flipped, flip]);

  const flipToBack = useCallback(() => {
    if (flipped) return;
    flip();
  }, [flipped, flip]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Determine which side is showing based on rotation
  const showFront = rotationY % 360 < 90 || rotationY % 360 >= 270;

  return {
    flipped,
    isAnimating,
    rotationY,
    showFront,
    flip,
    flipToFront,
    flipToBack,
    setFlipped,
    transform: `perspective(1000px) rotateY(${rotationY}deg)`,
    backfaceVisibility: 'hidden' as const,
  };
}

/* ============================================
   DICE ROLL ANIMATION HOOK
   ============================================ */

/**
 * Hook for dice roll animation
 * @param duration Roll duration in ms
 */
export function useDiceRoll(duration: number = 1000) {
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState<number>(1);
  const animationRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const roll = useCallback(
    (finalValue?: number) => {
      // Cancel ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setIsRolling(true);
      const startTime = performance.now();
      const final = finalValue ?? Math.floor(Math.random() * 6) + 1;

      // Rapid random display during roll
      intervalRef.current = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 50);

      const animate = (timestamp: number) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Stop random display and show final result
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setDisplayValue(final);
          setResult(final);
          setIsRolling(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return final;
    },
    [duration]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isRolling,
    result,
    displayValue,
    roll,
    reset: useCallback(() => {
      setResult(null);
      setDisplayValue(1);
    }, []),
  };
}

/* ============================================
   SCALE PULSE ANIMATION HOOK
   ============================================ */

/**
 * Hook for scale pulse animation (useful for highlighting)
 * @param baseScale Default scale value
 */
export function useScalePulse(baseScale: number = 1) {
  const [scale, setScale] = useState(baseScale);
  const [isPulsing, setIsPulsing] = useState(false);
  const animationRef = useRef<number | null>(null);

  const pulse = useCallback(
    (intensity: number = 0.2, pulseDuration: number = 300) => {
      // Cancel ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      setIsPulsing(true);
      const startTime = performance.now();
      const peakScale = baseScale + intensity;

      const animate = (timestamp: number) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / pulseDuration, 1);

        // Ease-in-out pulse: grow then shrink back
        let currentScale: number;
        if (progress < 0.5) {
          currentScale = baseScale + (peakScale - baseScale) * (progress * 2);
        } else {
          currentScale = peakScale - (peakScale - baseScale) * ((progress - 0.5) * 2);
        }

        setScale(currentScale);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setScale(baseScale);
          setIsPulsing(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [baseScale]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    scale,
    isPulsing,
    pulse,
    transform: `scale(${scale})`,
  };
}

export default useAnimation;
