type AudioMethodName =
  | 'createOscillator'
  | 'createGain'
  | 'createBuffer'
  | 'createBufferSource'
  | 'createBiquadFilter'
  | 'resume';

const BOUND_METHODS: AudioMethodName[] = [
  'createOscillator',
  'createGain',
  'createBuffer',
  'createBufferSource',
  'createBiquadFilter',
  'resume',
];

export function createAudioPlaybackContext(
  ctx: AudioContext,
  destination: AudioNode,
): AudioContext {
  const playbackCtx = {
    get currentTime() {
      return ctx.currentTime;
    },
    get sampleRate() {
      return ctx.sampleRate;
    },
    get state() {
      return ctx.state;
    },
    get destination() {
      return destination;
    },
  } as AudioContext;

  for (const method of BOUND_METHODS) {
    const fn = ctx[method];
    if (typeof fn === 'function') {
      (playbackCtx as any)[method] = fn.bind(ctx);
    }
  }

  return playbackCtx;
}
