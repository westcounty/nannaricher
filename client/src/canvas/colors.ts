// client/src/canvas/colors.ts
// Color palette for board rendering

// Cell colors based on type
export const CELL_COLORS = {
  // Corner cells - distinctive colors for each corner type
  corner: {
    default: '#e8e8e8',
    start: '#90EE90',      // Light green - starting point
    hospital: '#FFB6C1',   // Light pink - hospital
    ding: '#FFD700',       // Gold - the famous tripod
    waiting_room: '#87CEEB', // Light blue - waiting room
  },

  // Event cells - green tint
  event: '#d4edda',

  // Chance cells - yellow/orange tint
  chance: '#fff3cd',

  // Line entry cells - blue tint
  line_entry: '#cce5ff',

  // Default fallback
  default: '#ffffff',
} as const;

// Line colors - each line has a distinct color
export const LINE_COLORS = {
  pukou: '#9B59B6',      // Purple - Pukou campus
  study: '#3498DB',      // Blue - Study line
  money: '#2ECC71',      // Green - Money line
  suzhou: '#1ABC9C',     // Teal - Suzhou line
  explore: '#E74C3C',    // Red - Explore line
  gulou: '#E67E22',      // Orange - Gulou line
  xianlin: '#3498DB',    // Blue - Xianlin line
  food: '#F39C12',       // Yellow-orange - Food line
} as const;

// Player token colors
export const PLAYER_COLORS = [
  '#FF5733',  // Red-orange
  '#33FF57',  // Green
  '#3357FF',  // Blue
  '#FF33F1',  // Pink
  '#FFD700',  // Gold
  '#00FFFF',  // Cyan
  '#8B4513',  // Brown
  '#9400D3',  // Purple
] as const;

// Background and UI colors
export const UI_COLORS = {
  background: '#f5f5f5',
  boardBackground: '#ffffff',
  cellBorder: '#333333',
  cellBorderHover: '#000000',
  text: '#000000',
  textLight: '#666666',
  highlight: '#ffff00',
  selection: '#4CAF50',
} as const;

// Helper function to get cell color
export function getCellColor(
  type: string,
  cornerType?: string,
  _lineId?: string
): string {
  switch (type) {
    case 'corner':
      if (cornerType && cornerType in CELL_COLORS.corner) {
        return CELL_COLORS.corner[cornerType as keyof typeof CELL_COLORS.corner];
      }
      return CELL_COLORS.corner.default;

    case 'event':
      return CELL_COLORS.event;

    case 'chance':
      return CELL_COLORS.chance;

    case 'line_entry':
      return CELL_COLORS.line_entry;

    default:
      return CELL_COLORS.default;
  }
}

// Helper function to get line color
export function getLineColor(lineId: string): string {
  return LINE_COLORS[lineId as keyof typeof LINE_COLORS] || '#999999';
}

// Helper function to get player color by index
export function getPlayerColor(playerIndex: number): string {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
}
