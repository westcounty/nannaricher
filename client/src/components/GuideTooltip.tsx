import { useState, useEffect, useCallback } from 'react';
import './GuideTooltip.css';

/**
 * Guide step configuration
 */
interface GuideStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Default guide steps for first-time players
 */
const DEFAULT_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Caigen Life!',
    content:
      'This is a turn-based board game simulating university life. Your goal is to balance your GPA, money, and exploration values to achieve the best outcome!',
    position: 'center',
  },
  {
    id: 'board',
    title: 'Game Board',
    content:
      'The board represents your university journey. Each cell has different effects - some give you money, others affect your GPA, and some trigger special events.',
    targetSelector: '.board-area',
    position: 'right',
  },
  {
    id: 'players',
    title: 'Player Panel',
    content:
      'Here you can see all players\' status including money, GPA, and exploration value. The highlighted player is currently taking their turn.',
    targetSelector: '.side-panel',
    position: 'left',
  },
  {
    id: 'dice',
    title: 'Roll Dice',
    content:
      'On your turn, click the "Roll Dice" button to move. The number rolled determines how many cells you advance.',
    targetSelector: '.current-player-panel',
    position: 'top',
  },
  {
    id: 'cards',
    title: 'Your Cards',
    content:
      'You can hold event cards that provide special abilities. Use them strategically to gain an advantage!',
    targetSelector: '.bottom-bar',
    position: 'top',
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    content:
      'Balance is key! Don\'t focus only on money - maintaining a good GPA and exploring different paths will lead to the best endings. Good luck!',
    position: 'center',
  },
];

// Local storage key for guide completion status
const GUIDE_STORAGE_KEY = 'caigen-life-guide-completed';

interface GuideTooltipProps {
  steps?: GuideStep[];
  onComplete?: () => void;
  autoStart?: boolean;
}

/**
 * GuideTooltip Component
 * Displays a step-by-step tutorial for first-time players
 */
export function GuideTooltip({
  steps = DEFAULT_GUIDE_STEPS,
  onComplete,
  autoStart = true,
}: GuideTooltipProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Check if guide was already completed
  useEffect(() => {
    try {
      const completed = localStorage.getItem(GUIDE_STORAGE_KEY) === 'true';
      if (autoStart && !completed) {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => setIsActive(true), 500);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // LocalStorage might not be available
      console.warn('Could not access localStorage:', e);
    }
  }, [autoStart]);

  // Get current step
  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [isLastStep, steps.length]);

  const handlePrevious = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    setIsActive(false);
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Could not save guide completion status:', e);
    }
    onComplete?.();
  }, [onComplete]);

  // Don't render if not active or no step
  if (!isActive || !currentStep) {
    return null;
  }

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    const position = currentStep.position || 'center';

    if (position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Try to find target element
    if (currentStep.targetSelector) {
      const targetEl = document.querySelector(currentStep.targetSelector);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        switch (position) {
          case 'top':
            return {
              bottom: window.innerHeight - rect.top - scrollY + 10,
              left: rect.left + scrollX + rect.width / 2,
              transform: 'translateX(-50%)',
            };
          case 'bottom':
            return {
              top: rect.bottom + scrollY + 10,
              left: rect.left + scrollX + rect.width / 2,
              transform: 'translateX(-50%)',
            };
          case 'left':
            return {
              top: rect.top + scrollY + rect.height / 2,
              right: window.innerWidth - rect.left - scrollX + 10,
              transform: 'translateY(-50%)',
            };
          case 'right':
            return {
              top: rect.top + scrollY + rect.height / 2,
              left: rect.right + scrollX + 10,
              transform: 'translateY(-50%)',
            };
        }
      }
    }

    // Fallback to center
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  };

  return (
    <>
      {/* Overlay */}
      <div className="guide-overlay" onClick={handleSkip} />

      {/* Target highlight */}
      {currentStep.targetSelector && (
        <TargetHighlight selector={currentStep.targetSelector} />
      )}

      {/* Tooltip */}
      <div
        className={`guide-tooltip guide-tooltip--${currentStep.position || 'center'}`}
        style={getTooltipStyle()}
        role="dialog"
        aria-labelledby="guide-title"
        aria-describedby="guide-content"
      >
        <div className="guide-tooltip__header">
          <h3 id="guide-title" className="guide-tooltip__title">
            {currentStep.title}
          </h3>
          <button
            className="guide-tooltip__close"
            onClick={handleSkip}
            aria-label="Skip guide"
          >
            &times;
          </button>
        </div>

        <div id="guide-content" className="guide-tooltip__content">
          {currentStep.content}
        </div>

        <div className="guide-tooltip__footer">
          <div className="guide-tooltip__progress">
            {currentStepIndex + 1} / {steps.length}
          </div>

          <div className="guide-tooltip__actions">
            {!isFirstStep && (
              <button className="guide-tooltip__btn guide-tooltip__btn--secondary" onClick={handlePrevious}>
                Previous
              </button>
            )}

            {isLastStep ? (
              <button className="guide-tooltip__btn guide-tooltip__btn--primary" onClick={handleComplete}>
                Got it!
              </button>
            ) : (
              <button className="guide-tooltip__btn guide-tooltip__btn--primary" onClick={handleNext}>
                Next
              </button>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="guide-tooltip__dots">
          {steps.map((_, index) => (
            <span
              key={index}
              className={`guide-tooltip__dot ${index === currentStepIndex ? 'guide-tooltip__dot--active' : ''} ${index < currentStepIndex ? 'guide-tooltip__dot--completed' : ''}`}
              onClick={() => setCurrentStepIndex(index)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * TargetHighlight Component
 * Highlights a specific element on the page
 */
function TargetHighlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      const el = document.querySelector(selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      }
    };

    updateRect();

    // Update on resize
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [selector]);

  if (!rect) return null;

  return (
    <div
      className="guide-highlight"
      style={{
        position: 'fixed',
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Hook to check if guide has been completed
 */
export function useGuideCompleted(): boolean {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      setCompleted(localStorage.getItem(GUIDE_STORAGE_KEY) === 'true');
    } catch (e) {
      console.warn('Could not access localStorage:', e);
    }
  }, []);

  return completed;
}

/**
 * Hook to reset guide
 */
export function useResetGuide(): () => void {
  return useCallback(() => {
    try {
      localStorage.removeItem(GUIDE_STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear guide completion status:', e);
    }
  }, []);
}

export default GuideTooltip;
