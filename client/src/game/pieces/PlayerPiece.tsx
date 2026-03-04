// client/src/game/pieces/PlayerPiece.tsx
import React, { useEffect, useState, useCallback } from 'react';
import type { Graphics } from 'pixi.js';
import { TextStyle } from 'pixi.js';
import { Player, Position } from '@nannaricher/shared';

interface PlayerPieceProps {
  player: Player;
  isCurrentPlayer: boolean;
  getCellPosition?: (position: Position) => { x: number; y: number };
}

// 玩家颜色
const PLAYER_COLORS = [
  0xE53935, // 红色
  0x1E88E5, // 蓝色
  0x43A047, // 绿色
  0xFB8C00, // 橙色
  0x8E24AA, // 紫色
  0x00897B, // 青色
];

export const PlayerPiece: React.FC<PlayerPieceProps> = ({
  player,
  isCurrentPlayer,
  getCellPosition,
}) => {
  const [displayPosition, setDisplayPosition] = useState({ x: 350, y: 350 });

  useEffect(() => {
    if (getCellPosition) {
      const targetPos = getCellPosition(player.position);
      setDisplayPosition(targetPos);
    }
  }, [player.position, getCellPosition]);

  const playerIndex = parseInt(player.color) || 0;
  const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];

  const drawPiece = useCallback((g: Graphics) => {
    g.clear();

    // 棋子底座阴影
    g.ellipse(0, 12, 15, 8);
    g.fill({ color: 0x333333, alpha: 0.3 });

    // 棋子主体
    g.circle(0, 0, 12);
    g.fill({ color });

    // 高光
    g.circle(-4, -4, 4);
    g.fill({ color: 0xffffff, alpha: 0.4 });

    // 当前玩家金色边框
    if (isCurrentPlayer) {
      g.circle(0, 0, 16);
      g.stroke({ width: 3, color: 0xC9A227 });
    }
  }, [color, isCurrentPlayer]);

  const textStyle = new TextStyle({
    fontSize: 10,
    fill: 0xffffff,
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
  });

  return (
    <pixiContainer x={displayPosition.x} y={displayPosition.y}>
      <pixiGraphics draw={drawPiece} />
      <pixiText
        text={player.name.slice(0, 2)}
        style={textStyle}
        anchor={0.5}
        y={-20}
      />
    </pixiContainer>
  );
};
