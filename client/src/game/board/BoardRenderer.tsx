// client/src/game/board/BoardRenderer.tsx
import React from 'react';
import type { Graphics } from 'pixi.js';
import { GameState, Position, MainPosition } from '@nannaricher/shared';

interface BoardRendererProps {
  gameState: GameState;
  onCellClick?: (cellId: string, position: Position) => void;
}

// 棋盘配置
const BOARD_SIZE = 700;
const CELL_SIZE = 80;
const CORNER_SIZE = 100;
const CELLS_PER_SIDE = 7;

// 28格主棋盘数据
const MAIN_BOARD_CELLS = [
  { id: 'start', index: 0, name: '起点/低保日', type: 'corner' as const },
  { id: 'chance_1', index: 1, name: '机会/命运', type: 'chance' as const },
  { id: 'tuition', index: 2, name: '所有人交学费', type: 'event' as const },
  { id: 'chance_2', index: 3, name: '机会/命运', type: 'chance' as const },
  { id: 'line_pukou', index: 4, name: '浦口线入口', type: 'line_entry' as const },
  { id: 'zijing', index: 5, name: '紫荆站', type: 'event' as const },
  { id: 'line_study', index: 6, name: '学在南哪入口', type: 'line_entry' as const },

  { id: 'hospital', index: 7, name: '校医院', type: 'corner' as const },
  { id: 'line_money', index: 8, name: '赚在南哪入口', type: 'line_entry' as const },
  { id: 'qingong', index: 9, name: '勤工助学', type: 'event' as const },
  { id: 'chance_3', index: 10, name: '机会/命运', type: 'chance' as const },
  { id: 'line_suzhou', index: 11, name: '苏州线入口', type: 'line_entry' as const },
  { id: 'retake', index: 12, name: '重修', type: 'event' as const },
  { id: 'chance_4', index: 13, name: '机会/命运', type: 'chance' as const },

  { id: 'ding', index: 14, name: '鼎', type: 'corner' as const },
  { id: 'line_explore', index: 15, name: '乐在南哪入口', type: 'line_entry' as const },
  { id: 'jiang_gong', index: 16, name: '蒋公的面子', type: 'event' as const },
  { id: 'chance_5', index: 17, name: '机会/命运', type: 'chance' as const },
  { id: 'line_xianlin', index: 18, name: '仙林线入口', type: 'line_entry' as const },
  { id: 'society', index: 19, name: '社团', type: 'event' as const },
  { id: 'chance_6', index: 20, name: '机会/命运', type: 'chance' as const },

  { id: 'waiting_room', index: 21, name: '候车厅', type: 'corner' as const },
  { id: 'line_gulou', index: 22, name: '鼓楼线入口', type: 'line_entry' as const },
  { id: 'kechuang', index: 23, name: '科创赛事', type: 'event' as const },
  { id: 'chance_7', index: 24, name: '机会/命运', type: 'chance' as const },
  { id: 'line_food', index: 25, name: '食堂线入口', type: 'line_entry' as const },
  { id: 'nanna_cp', index: 26, name: '南哪诚品', type: 'event' as const },
  { id: 'chuangmen', index: 27, name: '闯门', type: 'event' as const },
];

const CORNER_INDICES = [0, 7, 14, 21];

// 计算格子位置
export function getCellPosition(index: number): { x: number; y: number } {
  const boardCenter = BOARD_SIZE / 2;
  const halfCorner = CORNER_SIZE / 2;

  const side = Math.floor(index / CELLS_PER_SIDE);
  const posInSide = index % CELLS_PER_SIDE;

  let x = 0, y = 0;

  switch (side) {
    case 0:
      x = boardCenter + halfCorner + (CELLS_PER_SIDE - 1 - posInSide) * CELL_SIZE;
      y = boardCenter + halfCorner;
      break;
    case 1:
      x = boardCenter - halfCorner;
      y = boardCenter + halfCorner - (posInSide + 1) * CELL_SIZE;
      break;
    case 2:
      x = boardCenter - halfCorner - (CELLS_PER_SIDE - 1 - posInSide) * CELL_SIZE;
      y = boardCenter - halfCorner;
      break;
    case 3:
      x = boardCenter + halfCorner;
      y = boardCenter - halfCorner + (posInSide + 1) * CELL_SIZE;
      break;
  }

  return { x, y };
}

// 获取格子颜色
function getCellColor(cell: typeof MAIN_BOARD_CELLS[0], index: number): number {
  if (CORNER_INDICES.includes(index)) {
    switch (cell.id) {
      case 'start': return 0x4CAF50;
      case 'hospital': return 0xF44336;
      case 'ding': return 0xFFC107;
      case 'waiting_room': return 0x2196F3;
    }
  }
  switch (cell.type) {
    case 'event': return 0xFF9800;
    case 'chance': return 0x9C27B0;
    case 'line_entry': return 0x607D8B;
  }
  return 0xffffff;
}

// 绘制单个格子
function createDrawCellFn(size: number, color: number) {
  return (g: Graphics) => {
    g.clear();
    g.rect(-size/2, -size/2, size, size);
    g.fill({ color });
    g.stroke({ width: 2, color: 0x333333, alpha: 0.3 });
  };
}

// 绘制背景
function drawBackground(g: Graphics) {
  g.clear();
  g.roundRect(-BOARD_SIZE/2 - 20, -BOARD_SIZE/2 - 20, BOARD_SIZE + 40, BOARD_SIZE + 40, 16);
  g.fill({ color: 0xffffff });
  g.roundRect(-BOARD_SIZE/2 + 100, -BOARD_SIZE/2 + 100, BOARD_SIZE - 200, BOARD_SIZE - 200, 12);
  g.fill({ color: 0xfafafa });
}

export const BoardRenderer: React.FC<BoardRendererProps> = ({
  gameState,
  onCellClick,
}) => {
  const cells = MAIN_BOARD_CELLS.map((cell, index) => {
    const pos = getCellPosition(index);
    const isCorner = CORNER_INDICES.includes(index);
    const size = isCorner ? 90 : 70;
    const color = getCellColor(cell, index);

    return (
      <pixiGraphics
        key={cell.id}
        x={pos.x}
        y={pos.y}
        draw={createDrawCellFn(size, color)}
        interactive={true}
        pointerdown={() => {
          const position: MainPosition = { type: 'main', index };
          onCellClick?.(cell.id, position);
        }}
      />
    );
  });

  return (
    <pixiContainer x={BOARD_SIZE / 2} y={BOARD_SIZE / 2}>
      <pixiGraphics draw={drawBackground} />
      {cells}
    </pixiContainer>
  );
};

export { BOARD_SIZE, CELL_SIZE, CORNER_SIZE, CELLS_PER_SIDE };
