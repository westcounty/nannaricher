// client/src/game/pieces/PlayerPiece.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';
import { Player, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../../styles/tokens';

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
  const [isAnimating, setIsAnimating] = useState(false);

  // 计算实际位置
  useEffect(() => {
    if (getCellPosition) {
      const targetPos = getCellPosition(player.position);
      if (!isAnimating) {
        // 简单的位置更新，可以添加动画效果
        setDisplayPosition(targetPos);
      }
    }
  }, [player.position, isAnimating, getCellPosition]);

  // 绘制棋子
  const drawPiece = useCallback((g: PixiGraphics) => {
    g.clear();

    // 获取玩家颜色
    const playerIndex = parseInt(player.color) || 0;
    const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];

    // 棋子底座（阴影效果）
    g.beginFill(0x333333, 0.3);
    g.drawEllipse(0, 12, 15, 8);
    g.endFill();

    // 棋子主体
    g.beginFill(color);
    g.drawCircle(0, 0, 12);
    g.endFill();

    // 高光效果
    g.beginFill(0xffffff, 0.4);
    g.drawCircle(-4, -4, 4);
    g.endFill();

    // 当前玩家标记（金色边框）
    if (isCurrentPlayer) {
      g.lineStyle(3, 0xC9A227); // 南大金色
      g.drawCircle(0, 0, 16);
    }
  }, [player.color, isCurrentPlayer]);

  return (
    <Container x={displayPosition.x} y={displayPosition.y}>
      <Graphics draw={drawPiece} />
      {/* 玩家名称标签 */}
      <Text
        text={player.name.slice(0, 2)}
        style={new TextStyle({
          fontSize: 10,
          fill: 0xffffff,
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
        })}
        anchor={0.5}
        y={-20}
      />
    </Container>
  );
};
