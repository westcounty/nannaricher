import { useState, useCallback, useEffect, useRef } from 'react';
import { AudioManager, playSound } from '../audio/AudioManager';
import { DESIGN_TOKENS } from '../styles/tokens';

export function AudioControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(AudioManager.isMuted());
  const [masterVol, setMasterVol] = useState(AudioManager.getVolume('master'));
  const [sfxVol, setSfxVol] = useState(AudioManager.getVolume('sfx'));
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleMute = useCallback(() => {
    const newMuted = AudioManager.toggleMute();
    setIsMuted(newMuted);
  }, []);

  const handleMasterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    AudioManager.setVolume('master', val);
    setMasterVol(val);
  }, []);

  const handleSfxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    AudioManager.setVolume('sfx', val);
    setSfxVol(val);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => { setIsOpen(prev => !prev); if (!isOpen) playSound('button_click'); }}
        style={{
          background: 'transparent',
          border: 'none',
          color: DESIGN_TOKENS.color.text.primary,
          fontSize: '1.2rem',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: DESIGN_TOKENS.radius.sm,
        }}
        title="音量控制"
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          background: DESIGN_TOKENS.color.bg.elevated,
          border: '1px solid rgba(139, 95, 191, 0.3)',
          borderRadius: DESIGN_TOKENS.radius.lg,
          padding: '16px',
          minWidth: '200px',
          zIndex: 1000,
          boxShadow: DESIGN_TOKENS.shadow.lg,
        }}>
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={toggleMute}
              style={{
                width: '100%',
                padding: '8px',
                background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(94, 58, 141, 0.3)',
                border: 'none',
                borderRadius: DESIGN_TOKENS.radius.md,
                color: DESIGN_TOKENS.color.text.primary,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {isMuted ? '🔇 取消静音' : '🔊 静音'}
            </button>
          </div>

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: DESIGN_TOKENS.color.text.secondary }}>
            主音量: {Math.round(masterVol * 100)}%
          </label>
          <input type="range" min="0" max="1" step="0.05" value={masterVol} onChange={handleMasterChange}
            style={{ width: '100%', marginBottom: '12px', accentColor: DESIGN_TOKENS.color.brand.primary }} />

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: DESIGN_TOKENS.color.text.secondary }}>
            音效: {Math.round(sfxVol * 100)}%
          </label>
          <input type="range" min="0" max="1" step="0.05" value={sfxVol} onChange={handleSfxChange}
            style={{ width: '100%', accentColor: DESIGN_TOKENS.color.brand.primary }} />
        </div>
      )}
    </div>
  );
}
