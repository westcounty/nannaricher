// client/src/a11y/AccessibilityProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilitySettings {
  highContrast: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  reducedMotion: boolean;
  fontSize: number; // 0.8 - 1.6
  screenReaderMode: boolean;
}

interface AccessibilityContextValue extends AccessibilitySettings {
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

const STORAGE_KEY = 'nannaricher_a11y_settings';

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  colorBlindMode: 'none',
  reducedMotion: false,
  fontSize: 1,
  screenReaderMode: false,
};

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  // Detect system prefers-reduced-motion once on mount
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setSettings(prev => ({ ...prev, reducedMotion: true }));
    }
  }, []);

  // Apply settings to DOM and persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    const root = document.documentElement;

    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    root.setAttribute('data-colorblind', settings.colorBlindMode);
    root.style.setProperty('--font-size-multiplier', String(settings.fontSize));
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <AccessibilityContext.Provider value={{ ...settings, updateSettings }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// 键盘导航 Hook
export const useKeyboardNavigation = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          document.body.classList.add('keyboard-navigation');
          break;
        case 'Escape':
          // 关闭模态框等
          const modal = document.querySelector('[role="dialog"]');
          if (modal) {
            const closeBtn = modal.querySelector('[aria-label="Close"]');
            if (closeBtn instanceof HTMLElement) {
              closeBtn.click();
            }
          }
          break;
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('keyboard-navigation');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [enabled]);
};

// ARIA Live Region 组件
export const LiveRegion: React.FC<{ message: string; assertive?: boolean }> = ({
  message,
  assertive = false,
}) => (
  <div
    role="status"
    aria-live={assertive ? 'assertive' : 'polite'}
    aria-atomic="true"
    className="sr-only"
  >
    {message}
  </div>
);
