// client/src/styles/tokens.ts — 完整设计令牌
export const DESIGN_TOKENS = {
  color: {
    brand: {
      primary: '#5B2D8E',       // 南大紫 (official CMYK 50/100/0/40)
      primaryLight: '#7B4DB8',
      primaryDark: '#3D1F66',
      accent: '#D4AF37',        // 金色 (old gold)
      accentLight: '#E8CC6E',
    },
    bg: {
      main: '#18120E',          // 暖棕主背景
      surface: '#241C18',       // 面板背景
      elevated: '#332822',      // 悬浮元素
      board: '#1E1610',         // 棋盘区域
      overlay: 'rgba(10,5,2,0.6)',
    },
    cell: {
      corner: {
        start: ['#2E7D50', '#4DB870'] as const,     // 雪松绿 — 起点
        hospital: ['#C62848', '#E85070'] as const,   // 南大红 — 医院
        ding: ['#5B2D8E', '#7B4DB8'] as const,       // 南大紫 — 鼎
        waitingRoom: ['#2868A8', '#4A90CC'] as const, // 学院蓝 — 候车
      },
      event: ['#8B4513', '#B85C1A'] as const,        // 暗橙 — 事件 (darker for contrast)
      chance: ['#5B2D8E', '#B88DE8'] as const,       // 亮紫 — 机会/命运 (brighter purple)
      lineEntry: {
        pukou: ['#506070', '#7890A0'] as const,       // 灰蓝 — 浦口
        study: ['#2848A0', '#5070CC'] as const,       // 深蓝 — 学在南哪
        money: ['#C87020', '#E8A040'] as const,       // 金橙 — 赚在南哪
        suzhou: ['#2868A8', '#4A90CC'] as const,      // 蓝 — 苏州
        explore: ['#A02060', '#D04888'] as const,     // 玫红 — 乐在南哪
        xianlin: ['#2E7D50', '#58B878'] as const,     // 绿 — 仙林
        gulou: ['#5B2D8E', '#7B4DB8'] as const,       // 紫 — 鼓楼
        food: ['#C85030', '#E87858'] as const,         // 红橙 — 食堂
      },
    },
    resource: {
      money: '#D4AF37',       // 金色
      gpa: '#4DB870',         // 雪松绿
      exploration: '#E8842A', // 暖橙
    },
    player: ['#E53935', '#3498DB', '#2ECC71', '#F39C12', '#8E24AA', '#00897B'] as const,
    text: {
      primary: '#F5EFE0',
      secondary: '#B8AA98',
      muted: '#7A6E60',
      danger: '#EF5350',
      success: '#66BB6A',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 },
  shadow: {
    sm: '0 2px 4px rgba(10,5,2,0.4)',
    md: '0 4px 12px rgba(10,5,2,0.5)',
    lg: '0 8px 24px rgba(10,5,2,0.6)',
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
