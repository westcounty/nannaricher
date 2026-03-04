import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Sound effect types for the game
 */
export type SoundType = 'dice' | 'move' | 'event' | 'card' | 'win' | 'lose' | 'click' | 'notification';

/**
 * Sound configuration
 */
interface SoundConfig {
  src: string;
  volume: number;
}

// Sound configurations - using Web Audio API generated sounds
const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  dice: { src: 'dice', volume: 0.5 },
  move: { src: 'move', volume: 0.4 },
  event: { src: 'event', volume: 0.6 },
  card: { src: 'card', volume: 0.5 },
  win: { src: 'win', volume: 0.7 },
  lose: { src: 'lose', volume: 0.5 },
  click: { src: 'click', volume: 0.3 },
  notification: { src: 'notification', volume: 0.4 },
};

/**
 * Generate sound using Web Audio API
 */
function generateSound(audioContext: AudioContext, type: SoundType): void {
  const config = SOUND_CONFIGS[type];
  const now = audioContext.currentTime;

  switch (type) {
    case 'dice': {
      // Rolling dice sound - series of short clicks
      for (let i = 0; i < 8; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 200 + Math.random() * 400;
        osc.type = 'square';
        const startTime = now + i * 0.05;
        gain.gain.setValueAtTime(config.volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.03);
        osc.start(startTime);
        osc.stop(startTime + 0.04);
      }
      break;
    }

    case 'move': {
      // Movement sound - quick ascending tone
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      osc.type = 'sine';
      gain.gain.setValueAtTime(config.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }

    case 'event': {
      // Event trigger sound - dramatic chord
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      frequencies.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        const startTime = now + i * 0.05;
        gain.gain.setValueAtTime(config.volume * 0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
      break;
    }

    case 'card': {
      // Card flip/draw sound - quick sweep
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.1);
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(config.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
      break;
    }

    case 'win': {
      // Victory fanfare - ascending major chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        const startTime = now + i * 0.15;
        gain.gain.setValueAtTime(config.volume * 0.6, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
      break;
    }

    case 'lose': {
      // Failure sound - descending minor tones
      const notes = [392, 349.23, 311.13]; // G4, F4, Eb4
      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        const startTime = now + i * 0.2;
        gain.gain.setValueAtTime(config.volume * 0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
      break;
    }

    case 'click': {
      // UI click sound - short tick
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 1000;
      osc.type = 'sine';
      gain.gain.setValueAtTime(config.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
      break;
    }

    case 'notification': {
      // Notification sound - pleasant chime
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(config.volume * 0.5, now);
      gain.gain.setValueAtTime(config.volume * 0.3, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    }
  }
}

/**
 * Hook for managing game sound effects
 * Uses Web Audio API to generate sounds without external files
 */
export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Initialize AudioContext on first user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play a specific sound type
  const playSound = useCallback(
    (type: SoundType) => {
      if (isMuted) return;

      const ctx = initAudioContext();
      if (!ctx) return;

      try {
        generateSound(ctx, type);
      } catch (e) {
        console.warn('Error playing sound:', e);
      }
    },
    [isMuted, initAudioContext]
  );

  // Convenience methods for game sounds
  const playDice = useCallback(() => playSound('dice'), [playSound]);
  const playMove = useCallback(() => playSound('move'), [playSound]);
  const playEvent = useCallback(() => playSound('event'), [playSound]);
  const playCard = useCallback(() => playSound('card'), [playSound]);
  const playWin = useCallback(() => playSound('win'), [playSound]);
  const playLose = useCallback(() => playSound('lose'), [playSound]);
  const playClick = useCallback(() => playSound('click'), [playSound]);
  const playNotification = useCallback(() => playSound('notification'), [playSound]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Set volume (0-1)
  const setMasterVolume = useCallback((newVolume: number) => {
    setVolume(Math.max(0, Math.min(1, newVolume)));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Initialize audio context on first mount (will be ready after user interaction)
  useEffect(() => {
    const handleUserInteraction = () => {
      initAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [initAudioContext]);

  return {
    // Sound playback methods
    playSound,
    playDice,
    playMove,
    playEvent,
    playCard,
    playWin,
    playLose,
    playClick,
    playNotification,
    // Controls
    isMuted,
    toggleMute,
    volume,
    setMasterVolume,
    // Initialize audio context manually if needed
    initAudioContext,
  };
}

export default useSound;
