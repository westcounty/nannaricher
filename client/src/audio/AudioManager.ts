// client/src/audio/AudioManager.ts
import { Howl, Howler } from 'howler';

// 音效类型
export type SoundType =
  | 'dice_roll'
  | 'dice_result'
  | 'piece_move'
  | 'card_draw'
  | 'card_flip'
  | 'coin'
  | 'event_positive'
  | 'event_negative'
  | 'win'
  | 'click'
  | 'notification';

// 音效配置
interface SoundConfig {
  src: string[];
  volume: number;
  loop?: boolean;
  sprite?: Record<string, { start: number; end: number; loop?: boolean }>;
}

// 音效映射（使用占位符路径，实际需要添加音频文件）
const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  dice_roll: {
    src: ['/sounds/dice-roll.mp3'],
    volume: 0.5,
  },
  dice_result: {
    src: ['/sounds/dice-result.mp3'],
    volume: 0.6,
  },
  piece_move: {
    src: ['/sounds/move.mp3'],
    volume: 0.4,
  },
  card_draw: {
    src: ['/sounds/card-draw.mp3'],
    volume: 0.5,
  },
  card_flip: {
    src: ['/sounds/card-flip.mp3'],
    volume: 0.5,
  },
  coin: {
    src: ['/sounds/coin.mp3'],
    volume: 0.6,
  },
  event_positive: {
    src: ['/sounds/event-positive.mp3'],
    volume: 0.5,
  },
  event_negative: {
    src: ['/sounds/event-negative.mp3'],
    volume: 0.5,
  },
  win: {
    src: ['/sounds/win.mp3'],
    volume: 0.7,
  },
  click: {
    src: ['/sounds/click.mp3'],
    volume: 0.3,
  },
  notification: {
    src: ['/sounds/notification.mp3'],
    volume: 0.5,
  },
};

/**
 * 音频管理器类
 * 使用单例模式管理游戏音效
 */
class AudioManagerImpl {
  private sounds: Map<SoundType, Howl> = new Map();
  private muted: boolean = false;
  private masterVolume: number = 1.0;

  constructor() {
    this.initSounds();
  }

  /**
   * 初始化所有音效
   */
  private initSounds(): void {
    for (const [type, config] of Object.entries(SOUND_CONFIGS)) {
      this.sounds.set(type as SoundType, new Howl({
        src: config.src,
        volume: config.volume,
        loop: config.loop || false,
        html5: true, // 使用 HTML5 Audio 以支持大文件
        preload: false, // 延迟加载，按需加载
      }));
    }
  }

  /**
   * 播放音效
   */
  play(type: SoundType): void {
    if (this.muted) return;

    const sound = this.sounds.get(type);
    if (sound) {
      // 如果正在播放，先停止
      if (sound.playing()) {
        sound.stop();
      }
      sound.play();
    }
  }

  /**
   * 停止音效
   */
  stop(type: SoundType): void {
    const sound = this.sounds.get(type);
    if (sound) {
      sound.stop();
    }
  }

  /**
   * 停止所有音效
   */
  stopAll(): void {
    this.sounds.forEach(sound => sound.stop());
  }

  /**
   * 静音切换
   */
  toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }

  /**
   * 设置静音状态
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  /**
   * 获取静音状态
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * 设置主音量
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }

  /**
   * 获取主音量
   */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * 设置单个音效音量
   */
  setSoundVolume(type: SoundType, volume: number): void {
    const sound = this.sounds.get(type);
    if (sound) {
      sound.volume(Math.max(0, Math.min(1, volume)));
    }
  }
}

// 导出单例实例
export const AudioManager = new AudioManagerImpl();

// 导出便捷函数
export const playSound = (type: SoundType) => AudioManager.play(type);
export const stopSound = (type: SoundType) => AudioManager.stop(type);
export const toggleMute = () => AudioManager.toggleMute();
