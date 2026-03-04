// client/src/components/ZoomHint.tsx
// One-time hint overlay for mobile users about pinch-zoom and drag.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'nannaricher_zoom_hint_shown';

export function ZoomHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Only show on touch devices
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    setVisible(true);

    const timer = setTimeout(() => {
      dismiss();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        color: '#e2e8f0',
        padding: '12px 20px',
        borderRadius: '12px',
        fontSize: '0.9rem',
        fontWeight: 600,
        textAlign: 'center',
        pointerEvents: 'auto',
        cursor: 'pointer',
        animation: 'zoom-hint-fade-in 0.3s ease-out',
        whiteSpace: 'nowrap',
        letterSpacing: '0.5px',
      }}
    >
      <style>{`
        @keyframes zoom-hint-fade-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      {'\uD83D\uDC46\uD83D\uDC46 \u53CC\u6307\u7F29\u653E / \u62D6\u62FD\u79FB\u52A8\u68CB\u76D8'}
    </div>
  );
}
