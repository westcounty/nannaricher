// client/src/styles/tokens.ts — 完整设计令牌
export const DESIGN_TOKENS = {
  color: {
    brand: {
      primary: '#5E3A8D',       // 南大紫
      primaryLight: '#8B5FBF',
      primaryDark: '#3D2566',
      accent: '#C9A227',        // 金色
      accentLight: '#E0C55E',
    },
    bg: {
      main: '#0F0A1A',          // 深紫黑主背景
      surface: '#1A1230',       // 面板背景
      elevated: '#252040',      // 悬浮元素
      board: '#16102A',         // 棋盘区域
      overlay: 'rgba(0,0,0,0.6)',
    },
    cell: {
      corner: {
        start: ['#2E7D32', '#4CAF50'] as const,
        hospital: ['#C62828', '#EF5350'] as const,
        ding: ['#E65100', '#FFB300'] as const,
        waitingRoom: ['#1565C0', '#42A5F5'] as const,
      },
      event: ['#E65100', '#FF9800'] as const,
      chance: ['#6A1B9A', '#AB47BC'] as const,
      lineEntry: {
        pukou: ['#455A64', '#78909C'] as const,
        study: ['#283593', '#5C6BC0'] as const,
        money: ['#E65100', '#FF9800'] as const,
        suzhou: ['#1565C0', '#42A5F5'] as const,
        explore: ['#AD1457', '#EC407A'] as const,
        xianlin: ['#2E7D32', '#66BB6A'] as const,
        gulou: ['#4E342E', '#8D6E63'] as const,
        food: ['#BF360C', '#FF7043'] as const,
      },
    },
    resource: {
      money: '#FFD700',
      gpa: '#4CAF50',
      exploration: '#FF5722',
    },
    player: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B'] as const,
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      muted: '#707070',
      danger: '#EF5350',
      success: '#66BB6A',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 },
  shadow: {
    sm: '0 2px 4px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 8px 24px rgba(0,0,0,0.5)',
    glow: (color: string) => `0 0 12px ${color}40, 0 0 24px ${color}20`,
  },
  typography: {
    fontFamily: "'Noto Sans SC', system-ui, sans-serif",
    fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 28, display: 40 },
    fontWeight: { normal: 400, medium: 500, bold: 700, black: 900 },
  },
  animation: {
    duration: { instant: 0, fast: 150, normal: 300, slow: 500, verySlow: 800 },
    easing: {
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  breakpoint: { mobile: 768, tablet: 1024, desktop: 1440 },
} as const;

// PixiJS 颜色转换辅助
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// 渐变色对转换
export function getGradientColors(pair: readonly [string, string]): [number, number] {
  return [hexToPixi(pair[0]), hexToPixi(pair[1])];
}
