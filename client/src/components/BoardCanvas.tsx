// client/src/components/BoardCanvas.tsx
// React组件 - 棋盘Canvas渲染

import { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, BoardCell, BoardLine } from '@nannaricher/shared';
import { CanvasController } from '../canvas/CanvasController';
import type { Viewport, Point } from '../canvas/types';
import { BoardRenderer } from '../canvas/BoardRenderer';
import { CellTooltip } from './CellTooltip';
import { defaultRenderConfig } from '../canvas/types';

// 导入棋盘数据
import boardData from '../data/board';

interface BoardCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  onCellClick?: (cellId: string, cell: BoardCell | null) => void;
}

export function BoardCanvas({ gameState, currentPlayerId, onCellClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CanvasController | null>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [tooltipCell, setTooltipCell] = useState<BoardCell | null>(null);
  const [tooltipLine, setTooltipLine] = useState<BoardLine | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // 初始化Canvas和渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置Canvas尺寸
    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.scale(dpr, dpr);

      // 更新渲染器配置
      if (rendererRef.current) {
        rendererRef.current.updateConfig({
          canvasWidth: rect.width,
          canvasHeight: rect.height,
          centerX: rect.width / 2,
          centerY: rect.height / 2,
        });
      }
    };

    updateCanvasSize();

    // 创建渲染器
    rendererRef.current = new BoardRenderer(ctx, boardData, {
      ...defaultRenderConfig,
      canvasWidth: container.clientWidth,
      canvasHeight: container.clientHeight,
      centerX: container.clientWidth / 2,
      centerY: container.clientHeight / 2,
    });

    // 创建控制器
    controllerRef.current = new CanvasController(canvas, setViewport, {
      onHover: handleHover,
      onClick: handleClick,
    });

    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(container);

    return () => {
      controllerRef.current?.destroy();
      resizeObserver.disconnect();
    };
  }, []);

  // 处理悬停
  const handleHover = useCallback((screenPos: Point, boardPos: Point) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const hitCell = renderer.hitTest(boardPos.x, boardPos.y);

    if (hitCell) {
      // 找到对应的格子数据
      const cellData = findCellData(hitCell.id, boardData);

      setTooltipCell(cellData);
      setTooltipPosition({ x: screenPos.x, y: screenPos.y });
      setTooltipVisible(true);
      renderer.setHoveredCell(hitCell.id);

      // 如果是支线格子，获取支线数据
      if (hitCell.id.includes('_')) {
        const lineId = hitCell.id.split('_')[0];
        const lineData = boardData.lines[lineId];
        setTooltipLine(lineData || null);
      } else {
        setTooltipLine(null);
      }
    } else {
      setTooltipVisible(false);
      setTooltipCell(null);
      setTooltipLine(null);
      renderer.setHoveredCell(null);
    }
  }, []);

  // 处理点击
  const handleClick = useCallback((boardPos: Point) => {
    const renderer = rendererRef.current;
    if (!renderer || !onCellClick) return;

    const hitCell = renderer.hitTest(boardPos.x, boardPos.y);

    if (hitCell) {
      const cellData = findCellData(hitCell.id, boardData);
      onCellClick(hitCell.id, cellData);
    }
  }, [onCellClick]);

  // 更新当前玩家
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setCurrentPlayer(currentPlayerId);
    }
  }, [currentPlayerId]);

  // 渲染棋盘
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !gameState) return;

    renderer.render(viewport, gameState.players);
  }, [viewport, gameState]);

  // 重置视图按钮
  const handleResetView = useCallback(() => {
    controllerRef.current?.reset();
  }, []);

  // 放大按钮
  const handleZoomIn = useCallback(() => {
    const current = controllerRef.current?.getViewport();
    if (current) {
      controllerRef.current?.setViewport({ scale: current.scale + 0.2 });
    }
  }, []);

  // 缩小按钮
  const handleZoomOut = useCallback(() => {
    const current = controllerRef.current?.getViewport();
    if (current) {
      controllerRef.current?.setViewport({ scale: current.scale - 0.2 });
    }
  }, []);

  return (
    <div className="board-canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        style={{
          cursor: 'grab',
          width: '100%',
          height: '100%',
        }}
      />

      {/* 控制按钮 */}
      <div className="board-controls">
        <button
          className="board-control-btn"
          onClick={handleZoomIn}
          title="放大"
        >
          +
        </button>
        <button
          className="board-control-btn"
          onClick={handleZoomOut}
          title="缩小"
        >
          -
        </button>
        <button
          className="board-control-btn"
          onClick={handleResetView}
          title="重置视图"
        >
          R
        </button>
      </div>

      {/* 格子提示框 */}
      <CellTooltip
        cell={tooltipCell}
        lineData={tooltipLine}
        position={tooltipPosition}
        visible={tooltipVisible}
      />

      {/* 缩放指示 */}
      <div className="board-zoom-indicator">
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  );
}

// 辅助函数：根据ID查找格子数据
function findCellData(cellId: string, boardData: typeof import('../data/board').boardData): BoardCell | null {
  // 检查主棋盘
  const mainCell = boardData.mainBoard.find(cell => cell.id === cellId);
  if (mainCell) return mainCell;

  // 检查支线
  if (cellId.includes('_')) {
    const [lineId, indexStr] = cellId.split('_');
    const line = boardData.lines[lineId];
    if (line) {
      const index = parseInt(indexStr);
      const lineCell = line.cells[index];
      if (lineCell) {
        // 将支线格子转换为BoardCell格式
        return {
          index: lineCell.index,
          id: lineCell.id,
          name: lineCell.name,
          type: 'event',
        };
      }
    }
  }

  return null;
}

export default BoardCanvas;
