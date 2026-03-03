// client/src/game/GameCanvas.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Container } from '@pixi/react';
import { GameState, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

// 占位组件 - 后续任务会实现
const BoardRendererPlaceholder: React.FC<{ gameState: GameState; onCellClick?: (cellId: string, position: Position) => void }> = () => null;
const PlayerPiecePlaceholder: React.FC<{ player: any; isCurrentPlayer: boolean }> = () => null;

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  onCellClick?: (cellId: string, position: Position) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  currentPlayerId,
  onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [scale, setScale] = React.useState(1);

  // 响应式调整
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        // 计算缩放比例以适应容器
        const minDim = Math.min(clientWidth, clientHeight);
        setScale(minDim / 800);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleCellClick = useCallback((cellId: string, position: Position) => {
    onCellClick?.(cellId, position);
  }, [onCellClick]);

  return (
    <div
      ref={containerRef}
      className="game-canvas-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#f5f5f5',
        borderRadius: DESIGN_TOKENS.radius.lg,
        overflow: 'hidden',
      }}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{
          backgroundColor: 0xf5f5f5,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container scale={scale}>
          {/* BoardRenderer 会在 Task 3.2 中实现 */}
          {/* PlayerPiece 会在 Task 3.4 中实现 */}
        </Container>
      </Stage>
    </div>
  );
};
