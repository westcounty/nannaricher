// client/src/game/board/BoardRenderer.tsx
import React, { useCallback } from 'react';
import { Container, Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from 'pixi.js';
import { GameState, Position, MainPosition } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../../styles/tokens';

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
  // 底边（索引 0-6，从右往左：起点 → 校医院方向）
  { id: 'start', index: 0, name: '起点/低保日', type: 'corner' as const },
  { id: 'chance_1', index: 1, name: '机会/命运', type: 'chance' as const },
  { id: 'tuition', index: 2, name: '所有人交学费', type: 'event' as const },
  { id: 'chance_2', index: 3, name: '机会/命运', type: 'chance' as const },
  { id: 'line_pukou', index: 4, name: '浦口线入口', type: 'line_entry' as const },
  { id: 'zijing', index: 5, name: '紫荆站', type: 'event' as const },
  { id: 'line_study', index: 6, name: '学在南哪入口', type: 'line_entry' as const },

  // 左边（索引 7-13，从下往上：校医院 → 鼎方向）
  { id: 'hospital', index: 7, name: '校医院', type: 'corner' as const },
  { id: 'line_money', index: 8, name: '赚在南哪入口', type: 'line_entry' as const },
  { id: 'qingong', index: 9, name: '勤工助学', type: 'event' as const },
  { id: 'chance_3', index: 10, name: '机会/命运', type: 'chance' as const },
  { id: 'line_suzhou', index: 11, name: '苏州线入口', type: 'line_entry' as const },
  { id: 'retake', index: 12, name: '重修', type: 'event' as const },
  { id: 'chance_4', index: 13, name: '机会/命运', type: 'chance' as const },

  // 顶边（索引 14-20，从左往右：鼎 → 候车厅方向）
  { id: 'ding', index: 14, name: '鼎', type: 'corner' as const },
  { id: 'line_explore', index: 15, name: '乐在南哪入口', type: 'line_entry' as const },
  { id: 'jiang_gong', index: 16, name: '蒋公的面子', type: 'event' as const },
  { id: 'chance_5', index: 17, name: '机会/命运', type: 'chance' as const },
  { id: 'line_xianlin', index: 18, name: '仙林线入口', type: 'line_entry' as const },
  { id: 'society', index: 19, name: '社团', type: 'event' as const },
  { id: 'chance_6', index: 20, name: '机会/命运', type: 'chance' as const },

  // 右边（索引 21-27，从上往下：候车厅 → 起点方向）
  { id: 'waiting_room', index: 21, name: '候车厅', type: 'corner' as const },
  { id: 'line_gulou', index: 22, name: '鼓楼线入口', type: 'line_entry' as const },
  { id: 'kechuang', index: 23, name: '科创赛事', type: 'event' as const },
  { id: 'chance_7', index: 24, name: '机会/命运', type: 'chance' as const },
  { id: 'line_food', index: 25, name: '食堂线入口', type: 'line_entry' as const },
  { id: 'nanna_cp', index: 26, name: '南哪诚品', type: 'event' as const },
  { id: 'chuangmen', index: 27, name: '闯门', type: 'event' as const },
];

const CORNER_INDICES = [0, 7, 14, 21];

export const BoardRenderer: React.FC<BoardRendererProps> = ({
  gameState,
  onCellClick,
}) => {
  // 计算格子位置
  const getCellPosition = useCallback((index: number): { x: number; y: number } => {
    const boardCenter = BOARD_SIZE / 2;
    const halfCell = CELL_SIZE / 2;
    const halfCorner = CORNER_SIZE / 2;

    const side = Math.floor(index / CELLS_PER_SIDE);
    const posInSide = index % CELLS_PER_SIDE;

    let x = 0, y = 0;

    switch (side) {
      case 0: // 底边，从右往左
        x = boardCenter + halfCorner + (CELLS_PER_SIDE - 1 - posInSide) * CELL_SIZE;
        y = boardCenter + halfCorner;
        break;
      case 1: // 左边，从下往上
        x = boardCenter - halfCorner;
        y = boardCenter + halfCorner - (posInSide + 1) * CELL_SIZE;
        break;
      case 2: // 顶边，从左往右
        x = boardCenter - halfCorner - (CELLS_PER_SIDE - 1 - posInSide) * CELL_SIZE;
        y = boardCenter - halfCorner;
        break;
      case 3: // 右边，从上往下
        x = boardCenter + halfCorner;
        y = boardCenter - halfCorner + (posInSide + 1) * CELL_SIZE;
        break;
    }

    return { x, y };
  }, []);

  // 绘制棋盘背景
  const drawBackground = useCallback((g: PixiGraphics) => {
    g.clear();

    // 棋盘底色
    g.beginFill(0xffffff);
    g.drawRoundedRect(-BOARD_SIZE/2 - 20, -BOARD_SIZE/2 - 20, BOARD_SIZE + 40, BOARD_SIZE + 40, 16);
    g.endFill();

    // 中央区域
    g.beginFill(0xfafafa);
    g.drawRoundedRect(-BOARD_SIZE/2 + 100, -BOARD_SIZE/2 + 100, BOARD_SIZE - 200, BOARD_SIZE - 200, 12);
    g.endFill();
  }, []);

  return (
    <Container x={BOARD_SIZE / 2} y={BOARD_SIZE / 2}>
      {/* 背景 */}
      <Graphics draw={drawBackground} />

      {/* 主棋盘格子 - 占位符，CellSprite 会在 Task 3.3 中实现 */}
      {MAIN_BOARD_CELLS.map((cell, index) => {
        const pos = getCellPosition(index);
        // 占位矩形，后续会替换为 CellSprite
        return (
          <Graphics
            key={cell.id}
            draw={(g: PixiGraphics) => {
              g.clear();
              const isCorner = CORNER_INDICES.includes(index);
              const size = isCorner ? 90 : 70;

              // 根据类型选择颜色
              let color = 0xffffff;
              if (isCorner) {
                switch (cell.id) {
                  case 'start': color = 0x4CAF50; break;
                  case 'hospital': color = 0xF44336; break;
                  case 'ding': color = 0xFFC107; break;
                  case 'waiting_room': color = 0x2196F3; break;
                }
              } else {
                switch (cell.type) {
                  case 'event': color = 0xFF9800; break;
                  case 'chance': color = 0x9C27B0; break;
                  case 'line_entry': color = 0x607D8B; break;
                }
              }

              g.beginFill(color);
              g.drawRoundedRect(pos.x - size/2, pos.y - size/2, size, size, isCorner ? 12 : 8);
              g.endFill();
              g.lineStyle(2, 0x333333, 0.3);
              g.drawRoundedRect(pos.x - size/2, pos.y - size/2, size, size, isCorner ? 12 : 8);
            }}
            interactive={true}
            pointerdown={() => {
              const position: MainPosition = { type: 'main', index };
              onCellClick?.(cell.id, position);
            }}
          />
        );
      })}
    </Container>
  );
};
