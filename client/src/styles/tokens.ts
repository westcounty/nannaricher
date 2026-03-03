// client/src/styles/tokens.ts

export const DESIGN_TOKENS = {
  color: {
    brand: {
      primary: '#5E3A8D',      // 南大紫
      primaryLight: '#8B5FBF',
      primaryDark: '#3D2566',
      accent: '#C9A227',       // 金色点缀
    },
    cell: {
      corner: {
        start: '#4CAF50',
        hospital: '#F44336',
        ding: '#FFC107',
        waiting_room: '#2196F3',
      },
      event: '#FF9800',
      chance: '#9C27B0',
      lineEntry: {
        pukou: '#607D8B',
        study: '#3F51B5',
        money: '#FF9800',
        suzhou: '#2196F3',
        explore: '#E91E63',
        gulou: '#795548',
        xianlin: '#4CAF50',
        food: '#FF5722',
      },
    },
    resource: {
      money: '#FFD700',
      gpa: '#4CAF50',
      exploration: '#FF5722',
    },
    player: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B'],
    semantic: {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    fontFamily: {
      display: '"Noto Sans SC", sans-serif',
      body: '"Noto Sans SC", sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
      display: 48,
    },
  },
  animation: {
    duration: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500,
      verySlow: 800,
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  breakpoint: {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
