// client/src/game/board/CellSprite.tsx
import React, { useCallback, useMemo } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

interface CellSpriteProps {
  cell: {
    id: string;
    index: number;
    name: string;
    type: 'corner' | 'event' | 'chance' | 'line_entry';
    lineId?: string;
  };
  x: number;
  y: number;
  isCorner: boolean;
  onClick?: () => void;
}

const CORNER_SIZE = 90;
const CELL_SIZE = 70;

export const CellSprite: React.FC<CellSpriteProps> = ({
  cell,
  x,
  y,
  isCorner,
  onClick,
}) => {
  const size = isCorner ? CORNER_SIZE : CELL_SIZE;

  // 获取格子颜色 — using design tokens
  const cellColor = useMemo(() => {
    const ct = DESIGN_TOKENS.color.cell;
    if (isCorner) {
      switch (cell.id) {
        case 'start': return hexToPixi(ct.corner.start[1]);
        case 'hospital': return hexToPixi(ct.corner.hospital[1]);
        case 'ding': return hexToPixi(ct.corner.ding[1]);
        case 'waiting_room': return hexToPixi(ct.corner.waitingRoom[1]);
        default: return 0xffffff;
      }
    }

    switch (cell.type) {
      case 'event': return hexToPixi(ct.event[1]);
      case 'chance': return hexToPixi(ct.chance[1]);
      case 'line_entry': {
        const lineId = cell.lineId as keyof typeof ct.lineEntry | undefined;
        if (lineId && lineId in ct.lineEntry) {
          return hexToPixi(ct.lineEntry[lineId][1]);
        }
        return hexToPixi(ct.lineEntry.pukou[1]);
      }
      default: return 0xffffff;
    }
  }, [cell, isCorner]);

  const drawCell = useCallback((g: PixiGraphics) => {
    g.clear();

    // 格子背景
    g.beginFill(cellColor);
    if (isCorner) {
      g.drawRoundedRect(-size/2, -size/2, size, size, 12);
    } else {
      g.drawRoundedRect(-size/2, -size/2, size, size, 8);
    }
    g.endFill();

    // 边框
    g.lineStyle(2, 0x333333, 0.3);
    if (isCorner) {
      g.drawRoundedRect(-size/2, -size/2, size, size, 12);
    } else {
      g.drawRoundedRect(-size/2, -size/2, size, size, 8);
    }

    // 入口标记（线路入口格）
    if (cell.type === 'line_entry') {
      g.beginFill(0x333333, 0.2);
      g.drawCircle(0, size/3, 8);
      g.endFill();
    }
  }, [cellColor, size, isCorner, cell.type]);

  // 格子名称样式
  const nameStyle = useMemo(() => new TextStyle({
    fontFamily: 'sans-serif',
    fontSize: isCorner ? 14 : 11,
    fill: isCorner ? 0xffffff : 0x333333,
    fontWeight: isCorner ? 'bold' : 'normal',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: size - 8,
  }), [isCorner, size]);

  // 类型标记
  const typeIcon = useMemo(() => {
    switch (cell.type) {
      case 'chance': return '?';
      case 'event': return '!';
      case 'line_entry': return '→';
      default: return '';
    }
  }, [cell.type]);

  return (
    <Container
      x={x}
      y={y}
      interactive={true}
      pointerdown={onClick}
    >
      <Graphics draw={drawCell} />
      <Text
        text={cell.name}
        style={nameStyle}
        anchor={0.5}
        y={isCorner ? -5 : -8}
      />
      {typeIcon && (
        <Text
          text={typeIcon}
          style={new TextStyle({
            fontSize: 20,
            fill: 0xffffff,
            fontWeight: 'bold',
          })}
          anchor={0.5}
          y={size/3 - 5}
        />
      )}
    </Container>
  );
};
