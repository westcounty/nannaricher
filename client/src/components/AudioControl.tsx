import { useState, useCallback, useEffect, useRef } from 'react';
import { AudioManager, playSound } from '../audio/AudioManager';
import '../styles/audio-control.css';

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
    <div ref={containerRef} className="audio-control">
      <button
        onClick={() => { setIsOpen(prev => !prev); if (!isOpen) playSound('button_click'); }}
        className="audio-control__toggle"
        title="音量控制"
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {isOpen && (
        <div className="audio-control__panel">
          <div className="audio-control__mute-wrapper">
            <button
              onClick={toggleMute}
              className={`audio-control__mute-btn ${isMuted ? 'audio-control__mute-btn--muted' : 'audio-control__mute-btn--unmuted'}`}
            >
              {isMuted ? '🔇 取消静音' : '🔊 静音'}
            </button>
          </div>

          <label className="audio-control__label">
            主音量: {Math.round(masterVol * 100)}%
          </label>
          <input type="range" min="0" max="1" step="0.05" value={masterVol} onChange={handleMasterChange}
            className="audio-control__slider audio-control__slider--master" />

          <label className="audio-control__label">
            音效: {Math.round(sfxVol * 100)}%
          </label>
          <input type="range" min="0" max="1" step="0.05" value={sfxVol} onChange={handleSfxChange}
            className="audio-control__slider" />
        </div>
      )}
    </div>
  );
}
