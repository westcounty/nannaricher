// client/src/components/SettingsPanel.tsx
// Dropdown settings panel accessible from CompactHeader.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { AudioControl } from './AudioControl';
import '../styles/settings-panel.css';

const FONT_SIZE_KEY = 'nannaricher_font_size';
const REDUCED_MOTION_KEY = 'nannaricher_reduced_motion';

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const roomId = useGameStore((s) => s.roomId);
  const gameState = useGameStore((s) => s.gameState);
  const playerCount = gameState?.players.length ?? 0;

  // Font size
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return saved ? parseFloat(saved) : 1.0;
  });

  // Reduced motion
  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem(REDUCED_MOTION_KEY) === '1';
  });

  // Apply font size to root
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}rem`;
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  // Apply reduced motion preference
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
    localStorage.setItem(REDUCED_MOTION_KEY, reducedMotion ? '1' : '0');
  }, [reducedMotion]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFontSize(parseFloat(e.target.value));
  }, []);

  return (
    <div ref={containerRef} className="settings-panel-container">
      <button
        className="settings-panel__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        title="设置"
      >
        {'\u2699\uFE0F'}
      </button>

      {isOpen && (
        <div className="settings-panel">
          <h4 className="settings-panel__title">设置</h4>

          {/* Room info */}
          <div className="settings-panel__row">
            <span className="settings-panel__label">房间号</span>
            <span className="settings-panel__value">{roomId ?? '-'}</span>
          </div>

          <div className="settings-panel__row">
            <span className="settings-panel__label">玩家数</span>
            <span className="settings-panel__value">{playerCount}</span>
          </div>

          {/* Divider */}
          <div className="settings-panel__divider" />

          {/* Font size slider */}
          <div className="settings-panel__group">
            <label className="settings-panel__label">
              字体大小: {Math.round(fontSize * 100)}%
            </label>
            <input
              type="range"
              min="0.8"
              max="1.6"
              step="0.05"
              value={fontSize}
              onChange={handleFontSizeChange}
              className="settings-panel__slider"
            />
          </div>

          {/* Reduced motion toggle */}
          <div className="settings-panel__row settings-panel__row--clickable" onClick={() => setReducedMotion((v) => !v)}>
            <span className="settings-panel__label">减少动效</span>
            <span className={`settings-panel__toggle-indicator ${reducedMotion ? 'settings-panel__toggle-indicator--on' : ''}`}>
              {reducedMotion ? '开' : '关'}
            </span>
          </div>

          {/* Divider */}
          <div className="settings-panel__divider" />

          {/* Embedded audio control */}
          <div className="settings-panel__group">
            <span className="settings-panel__label">音频</span>
            <AudioControl />
          </div>
        </div>
      )}
    </div>
  );
}
