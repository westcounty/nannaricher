// client/src/styles/tokens.ts — 完整设计令牌（奶油紫金主题）
export const DESIGN_TOKENS = {
  color: {
    brand: {
      primary: '#5B2D8E',       // 南大紫 (official CMYK 50/100/0/40)
      primaryLight: '#7B4DB8',
      primaryDark: '#3D1F66',
      accent: '#FFB300',        // 南大标准黄 (NJU Yellow)
      accentLight: '#FFD54F',
    },
    // 南大标准辅助色
    nju: {
      purple: '#5B2D8E',        // 南大紫（主色）
      red: '#F20073',           // 南大红/品红
      blue: '#3380FF',          // 南大蓝
      yellow: '#FFB300',        // 南大黄
      gold: '#D4AF37',          // 古金（装饰用）
      pineGreen: '#2E7D50',     // 松青
    },
    bg: {
      main: '#F5EDE0',          // 奶油主背景
      surface: '#FFFFFF',       // 白色面板
      elevated: '#EBE0D0',      // 悬浮元素
      board: '#EDE4D4',         // 棋盘区域
      overlay: 'rgba(42,32,24,0.6)',
    },
    // 语义色 —— 用于状态和反馈
    semantic: {
      success: '#2E7D50',       // 松青
      successLight: '#4DB870',
      danger: '#F20073',        // 南大红
      dangerLight: '#FF4D94',
      warning: '#FFB300',       // 南大黄
      warningLight: '#FFD54F',
      info: '#3380FF',          // 南大蓝
      infoLight: '#5CA0FF',
    },
    cell: {
      corner: {
        start: ['#2E7D50', '#4DB870'] as const,     // 雪松绿 — 起点
        hospital: ['#C62848', '#E85070'] as const,   // 南大红 — 医院
        ding: ['#5B2D8E', '#7B4DB8'] as const,       // 南大紫 — 鼎
        waitingRoom: ['#2868A8', '#4A90CC'] as const, // 学院蓝 — 候车
      },
      event: ['#8B4513', '#B85C1A'] as const,        // 暗橙 — 事件
      chance: ['#5B2D8E', '#B88DE8'] as const,       // 亮紫 — 机会/命运
      lineEntry: {
        pukou: ['#1B5E20', '#43A047'] as const,       // 深绿 — 浦口（江北自然）
        study: ['#1565C0', '#42A5F5'] as const,       // 钴蓝 — 学在南哪（书卷蓝）
        money: ['#E65100', '#FF9100'] as const,       // 炽橙 — 赚在南哪（金融活力）
        suzhou: ['#00838F', '#26C6DA'] as const,      // 青碧 — 苏州（园林水色）
        explore: ['#AD1457', '#EC407A'] as const,     // 洋红 — 乐在南哪（探索热情）
        xianlin: ['#2E7D32', '#66BB6A'] as const,     // 翠绿 — 仙林（校园绿意）
        gulou: ['#6A1B9A', '#AB47BC'] as const,       // 兰紫 — 鼓楼（历史典雅）
        food: ['#BF360C', '#FF7043'] as const,         // 火红 — 食堂（美食热烈）
      },
      // 语义映射：根据格子类型返回显示色
      typeColor: {
        corner: '#FFB300',       // 琥珀/金色
        event: '#8B4513',        // 棕橙
        chance: '#5B2D8E',       // 紫
        lineEntry: '#2E7D50',    // 绿
        default: '#8A7E6E',      // 灰棕
      },
    },
    resource: {
      money: '#FFB300',       // 南大标准黄
      gpa: '#4DB870',         // 雪松绿
      exploration: '#E8842A', // 暖橙
    },
    player: ['#E53935', '#3498DB', '#2ECC71', '#F39C12', '#8E24AA', '#00897B'] as const,
    text: {
      primary: '#2A2018',
      secondary: '#5A5040',
      muted: '#8A7E6E',
      danger: '#F20073',       // 南大标准红
      success: '#2E7D50',      // 松青
      info: '#3380FF',         // 南大蓝
      accent: '#FFB300',       // 南大黄
      onDark: '#F5EFE0',       // 深色背景上的浅色文字
      onBrand: '#FFFFFF',      // 品牌色上的白色文字
    },
    // 边框色
    border: {
      light: 'rgba(91,45,142,0.08)',
      medium: 'rgba(91,45,142,0.12)',
      strong: 'rgba(91,45,142,0.20)',
      accent: 'rgba(91,45,142,0.25)',
    },
    // 常用白/黑
    white: '#FFFFFF',
    black: '#000000',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 },
  shadow: {
    sm: '0 2px 4px rgba(91,45,142,0.08)',
    md: '0 4px 12px rgba(91,45,142,0.10)',
    lg: '0 8px 24px rgba(91,45,142,0.12)',
    overlay: '0 8px 32px rgba(91,45,142,0.15)',
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

// 获取格子类型对应的显示颜色
export function getCellTypeTokenColor(type: string): string {
  const map = DESIGN_TOKENS.color.cell.typeColor;
  return (map as Record<string, string>)[type] || map.default;
}

// rgba 辅助：从 hex 生成带透明度的 rgba
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
