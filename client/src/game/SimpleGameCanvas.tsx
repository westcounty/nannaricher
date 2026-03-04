// client/src/game/GameCanvas.tsx
// 简化版本 - 用于调试 PixiJS 问题
import React, { useRef, useEffect, useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Text } from 'pixi.js';
import { GameState, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

// 注册组件
extend({ Container, Graphics, Text });

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  onCellClick?: (cellId: string, position: Position) => void;
}

// 简单的绘制函数
const drawRect = (g: Graphics) => {
  g.clear();
  g.rect(0, 0, 100, 100);
  g.fill({ color: 0xff0000 });
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState: _gameState,
  currentPlayerId: _currentPlayerId,
  onCellClick: _onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
        setReady(true);
      }
    };

    // 等待 DOM 完全加载
    requestAnimationFrame(() => {
      requestAnimationFrame(update);
    });

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#f5f5f5',
        borderRadius: DESIGN_TOKENS.radius.lg,
      }}
    >
      {ready && (
        <Application width={size.w} height={size.h} backgroundColor={0xf5f5f5}>
          <pixiGraphics draw={drawRect} />
        </Application>
      )}
    </div>
  );
};
