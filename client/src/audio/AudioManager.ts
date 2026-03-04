// client/src/audio/AudioManager.ts
// 单例音频管理系统 — 支持 Web Audio API 程序化音效（无需外部音频文件）
// 懒初始化 AudioContext，符合浏览器自动播放策略

import { SOUNDS, type SoundName } from './sounds';

// Re-export for backward compatibility
export type { SoundName };

/** @deprecated Use SoundName instead */
export type SoundType = SoundName;

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

const STORAGE_KEY = 'nannaricher_audio_volumes';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.7,
  musicVolume: 0.5,
  muted: false,
};

// ============================================
// Legacy sound name mapping
// ============================================

const LEGACY_MAP: Record<string, SoundName> = {
  dice_roll: 'dice_shake',
  dice_result: 'dice_land',
  piece_move: 'piece_step',
  gpa_change: 'gpa_up',
  exploration_change: 'explore_up',
  notification: 'event_trigger',
  win: 'victory',
  lose: 'bankrupt',
};

// ============================================
// AudioManager Singleton
// ============================================

class AudioManagerImpl {
  private static _instance: AudioManagerImpl | null = null;
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private _muted: boolean;

  private constructor() {
    this.settings = this.loadSettings();
    this._muted = this.settings.muted;
    this.setupUserInteractionListener();
  }

  static getInstance(): AudioManagerImpl {
    if (!AudioManagerImpl._instance) {
      AudioManagerImpl._instance = new AudioManagerImpl();
    }
    return AudioManagerImpl._instance;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * 懒初始化 AudioContext（需要用户交互后才能创建）
   */
  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {
          // Silently ignore resume failures
        });
      }
      return this.ctx;
    }

    try {
      const AudioCtx = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      return this.ctx;
    } catch (error) {
      console.warn('[AudioManager] Failed to create AudioContext:', error);
      return null;
    }
  }

  /**
   * 监听首次用户交互，提前初始化 AudioContext
   */
  private setupUserInteractionListener(): void {
    const handler = () => {
      this.ensureContext();
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
      document.removeEventListener('touchstart', handler);
    };

    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    document.addEventListener('touchstart', handler);
  }

  /**
   * 兼容旧 API：手动初始化
   */
  async init(): Promise<void> {
    this.ensureContext();
  }

  /**
   * 兼容旧 API：恢复音频上下文
   */
  resume(): void {
    this.ensureContext();
  }

  // ============================================
  // Playback
  // ============================================

  /**
   * 播放音效（fire-and-forget，永不抛出异常）
   */
  play(sound: SoundName | string): void {
    if (this._muted) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      // Resolve legacy names
      const resolved = LEGACY_MAP[sound] || sound;
      const synthFn = SOUNDS[resolved as SoundName];
      if (synthFn) {
        // Create a gain node for volume control
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.settings.masterVolume * this.settings.sfxVolume;
        masterGain.connect(ctx.destination);

        // Patch destination for volume control
        const patchedCtx = Object.create(ctx, {
          destination: { get: () => masterGain },
        }) as AudioContext;

        synthFn(patchedCtx);
      } else {
        console.warn(`[AudioManager] Unknown sound: "${sound}"`);
      }
    } catch (error) {
      console.warn('[AudioManager] Error playing sound:', error);
    }
  }

  // ============================================
  // Volume Control
  // ============================================

  setVolume(channel: 'master' | 'sfx' | 'music', value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    switch (channel) {
      case 'master':
        this.settings.masterVolume = clamped;
        break;
      case 'sfx':
        this.settings.sfxVolume = clamped;
        break;
      case 'music':
        this.settings.musicVolume = clamped;
        break;
    }
    this.saveSettings();
  }

  getVolume(channel: 'master' | 'sfx' | 'music'): number {
    switch (channel) {
      case 'master': return this.settings.masterVolume;
      case 'sfx': return this.settings.sfxVolume;
      case 'music': return this.settings.musicVolume;
    }
  }

  mute(): void {
    this._muted = true;
    this.settings.muted = true;
    this.saveSettings();
  }

  unmute(): void {
    this._muted = false;
    this.settings.muted = false;
    this.saveSettings();
  }

  isMuted(): boolean {
    return this._muted;
  }

  /**
   * 切换静音
   */
  toggleMute(): boolean {
    if (this._muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this._muted;
  }

  // ============================================
  // Backward-compatible API
  // ============================================

  /**
   * @deprecated Use setVolume('master', v) instead
   */
  setMasterVolume(volume: number): void {
    this.setVolume('master', volume);
  }

  /**
   * @deprecated Use getVolume('master') instead
   */
  getMasterVolume(): number {
    return this.getVolume('master');
  }

  /**
   * @deprecated Use setVolume/mute/unmute instead
   */
  updateSettings(partial: Partial<AudioSettings>): void {
    if (partial.masterVolume !== undefined) this.settings.masterVolume = partial.masterVolume;
    if (partial.sfxVolume !== undefined) this.settings.sfxVolume = partial.sfxVolume;
    if (partial.musicVolume !== undefined) this.settings.musicVolume = partial.musicVolume;
    if (partial.muted !== undefined) {
      this.settings.muted = partial.muted;
      this._muted = partial.muted;
    }
    this.saveSettings();
  }

  /**
   * @deprecated Use getVolume / isMuted instead
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * @deprecated Use mute() / unmute() instead
   */
  setMuted(muted: boolean): void {
    if (muted) {
      this.mute();
    } else {
      this.unmute();
    }
  }

  // ============================================
  // Persistence
  // ============================================

  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================
// Exports
// ============================================

export const AudioManager = AudioManagerImpl.getInstance();

/** Convenience function: fire-and-forget sound playback */
export const playSound = (sound: SoundName | string): void => AudioManager.play(sound);
