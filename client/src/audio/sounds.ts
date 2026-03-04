// client/src/audio/sounds.ts
// 程序化合成音效定义 — 使用 Web Audio API，无需外部音频文件
// 每个音效 50-500ms，使用振荡器、增益包络、滤波器

export type SoundName =
  // Dice
  | 'dice_shake'
  | 'dice_land'
  // Movement
  | 'piece_step'
  | 'piece_land'
  // Resources
  | 'coin_gain'
  | 'coin_loss'
  | 'gpa_up'
  | 'gpa_down'
  | 'explore_up'
  // Cards
  | 'card_draw'
  | 'card_flip'
  | 'card_use'
  // Events
  | 'event_trigger'
  | 'event_positive'
  | 'event_negative'
  // Voting
  | 'vote_start'
  | 'vote_cast'
  | 'vote_end'
  // Game flow
  | 'turn_start'
  | 'turn_end'
  | 'round_start'
  // Status
  | 'hospital_enter'
  | 'bankrupt'
  // Victory
  | 'victory'
  | 'victory_fanfare'
  // UI
  | 'button_click'
  | 'tab_switch';

// ============================================
// Helper: create oscillator with gain envelope
// ============================================

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  startOffset: number = 0
): OscillatorNode {
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.01);
  return osc;
}

function playFrequencySweep(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  startOffset: number = 0
): void {
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playNoiseBurst(
  ctx: AudioContext,
  duration: number,
  volume: number,
  filterFreq: number,
  filterQ: number = 1,
  startOffset: number = 0
): void {
  const now = ctx.currentTime + startOffset;
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 8);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.start(now);
}

function playChime(
  ctx: AudioContext,
  frequencies: number[],
  noteDuration: number,
  volume: number,
  spacing: number = 0.06
): void {
  frequencies.forEach((freq, idx) => {
    playTone(ctx, freq, noteDuration, 'sine', volume / frequencies.length, idx * spacing);
  });
}

// ============================================
// Sound Definitions
// ============================================

export const SOUNDS: Record<SoundName, (ctx: AudioContext) => void> = {
  // --- Dice ---

  /** Rapid oscillator frequency sweep simulating dice rattling */
  dice_shake(ctx: AudioContext): void {
    for (let i = 0; i < 6; i++) {
      const freq = 200 + Math.random() * 600;
      playTone(ctx, freq, 0.04, 'square', 0.12, i * 0.045);
    }
  },

  /** Short thud when dice lands on surface */
  dice_land(ctx: AudioContext): void {
    playFrequencySweep(ctx, 400, 100, 0.12, 'sine', 0.25);
    playNoiseBurst(ctx, 0.08, 0.15, 300, 2);
  },

  // --- Movement ---

  /** Single step tick as piece moves one cell */
  piece_step(ctx: AudioContext): void {
    playTone(ctx, 600, 0.06, 'triangle', 0.15);
  },

  /** Landing impact when piece arrives at destination */
  piece_land(ctx: AudioContext): void {
    playFrequencySweep(ctx, 500, 250, 0.15, 'sine', 0.2);
    playNoiseBurst(ctx, 0.05, 0.1, 400, 3);
  },

  // --- Resources ---

  /** Ascending two-tone chime: C5 -> E5 */
  coin_gain(ctx: AudioContext): void {
    playTone(ctx, 523.25, 0.15, 'sine', 0.2);
    playTone(ctx, 659.25, 0.2, 'sine', 0.25, 0.1);
  },

  /** Descending minor tone indicating money loss */
  coin_loss(ctx: AudioContext): void {
    playFrequencySweep(ctx, 400, 200, 0.25, 'sawtooth', 0.15);
  },

  /** Bright ascending tone for GPA increase */
  gpa_up(ctx: AudioContext): void {
    playTone(ctx, 659.25, 0.12, 'triangle', 0.18);
    playTone(ctx, 783.99, 0.18, 'triangle', 0.22, 0.08);
  },

  /** Dull descending tone for GPA decrease */
  gpa_down(ctx: AudioContext): void {
    playFrequencySweep(ctx, 500, 300, 0.2, 'triangle', 0.15);
  },

  /** Sparkle-like tone for exploration gain */
  explore_up(ctx: AudioContext): void {
    playTone(ctx, 880, 0.08, 'sine', 0.12);
    playTone(ctx, 1108.73, 0.12, 'sine', 0.15, 0.06);
    playTone(ctx, 1318.51, 0.15, 'sine', 0.12, 0.12);
  },

  // --- Cards ---

  /** Whoosh sweep for drawing a card */
  card_draw(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.2);
  },

  /** Quick snap for card flip reveal */
  card_flip(ctx: AudioContext): void {
    playNoiseBurst(ctx, 0.04, 0.2, 2000, 3);
    playTone(ctx, 1200, 0.06, 'sine', 0.12, 0.02);
  },

  /** Activation shimmer when using a card */
  card_use(ctx: AudioContext): void {
    playChime(ctx, [784, 988, 1175], 0.15, 0.5, 0.04);
  },

  // --- Events ---

  /** Alert chime when an event triggers */
  event_trigger(ctx: AudioContext): void {
    playTone(ctx, 660, 0.1, 'sine', 0.2);
    playTone(ctx, 880, 0.15, 'sine', 0.2, 0.08);
  },

  /** Happy ascending chime for positive events */
  event_positive(ctx: AudioContext): void {
    playChime(ctx, [523.25, 659.25, 783.99], 0.2, 0.5, 0.06);
  },

  /** Dark descending tones for negative events */
  event_negative(ctx: AudioContext): void {
    playTone(ctx, 392, 0.15, 'sawtooth', 0.12);
    playTone(ctx, 311.13, 0.2, 'sawtooth', 0.1, 0.12);
  },

  // --- Voting ---

  /** Bell-like attention chime for vote start */
  vote_start(ctx: AudioContext): void {
    playTone(ctx, 880, 0.1, 'sine', 0.2);
    playTone(ctx, 880, 0.15, 'sine', 0.15, 0.12);
    playTone(ctx, 1320, 0.2, 'sine', 0.2, 0.25);
  },

  /** Short confirmation tick when casting a vote */
  vote_cast(ctx: AudioContext): void {
    playTone(ctx, 1000, 0.05, 'sine', 0.15);
    playTone(ctx, 1200, 0.08, 'sine', 0.12, 0.04);
  },

  /** Resolution chord when voting concludes */
  vote_end(ctx: AudioContext): void {
    playChime(ctx, [523.25, 659.25, 783.99, 1046.5], 0.25, 0.5, 0.05);
  },

  // --- Game Flow ---

  /** Bright ping indicating turn starts */
  turn_start(ctx: AudioContext): void {
    playTone(ctx, 523.25, 0.12, 'sine', 0.18);
  },

  /** Soft descending tone when turn ends */
  turn_end(ctx: AudioContext): void {
    playFrequencySweep(ctx, 440, 330, 0.12, 'sine', 0.12);
  },

  /** Distinct chime marking new round */
  round_start(ctx: AudioContext): void {
    playTone(ctx, 440, 0.1, 'sine', 0.15);
    playTone(ctx, 554.37, 0.1, 'sine', 0.15, 0.1);
    playTone(ctx, 659.25, 0.15, 'sine', 0.18, 0.2);
  },

  // --- Status ---

  /** Ominous low tone for entering hospital */
  hospital_enter(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.52);
  },

  /** Dramatic descending crash for going bankrupt */
  bankrupt(ctx: AudioContext): void {
    playFrequencySweep(ctx, 500, 80, 0.5, 'sawtooth', 0.2);
    playNoiseBurst(ctx, 0.3, 0.15, 200, 1, 0.1);
  },

  // --- Victory ---

  /** Ascending C major arpeggio */
  victory(ctx: AudioContext): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      playTone(ctx, freq, 0.3, 'sine', 0.2, i * 0.12);
    });
  },

  /** Extended fanfare: two ascending arpeggios */
  victory_fanfare(ctx: AudioContext): void {
    // First arpeggio: C major
    const firstChord = [523.25, 659.25, 783.99];
    firstChord.forEach((freq, i) => {
      playTone(ctx, freq, 0.2, 'triangle', 0.18, i * 0.08);
    });
    // Second arpeggio: higher octave with sustained final note
    const secondChord = [1046.5, 1318.51, 1567.98];
    secondChord.forEach((freq, i) => {
      playTone(ctx, freq, 0.35, 'sine', 0.22, 0.3 + i * 0.08);
    });
  },

  // --- UI ---

  /** Very short noise burst for button clicks (5ms) */
  button_click(ctx: AudioContext): void {
    playNoiseBurst(ctx, 0.005, 0.12, 4000, 5);
    playTone(ctx, 1500, 0.03, 'sine', 0.08);
  },

  /** Soft tick for switching tabs */
  tab_switch(ctx: AudioContext): void {
    playTone(ctx, 1000, 0.04, 'sine', 0.1);
  },
};
