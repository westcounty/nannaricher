// client/src/components/CellTooltip.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BoardCell, BoardLine } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

interface CellTooltipProps {
  cell: BoardCell | null;
  lineData?: BoardLine | null;
  position: { x: number; y: number };
  visible: boolean;
  imageUrl?: string;
}

function getCornerDescription(cornerType: string): string {
  switch (cornerType) {
    case 'start':
      return '起点/休息站: 经过时获得津贴';
    case 'hospital':
      return '校医院: 停在这里需要掷骰子或付费才能离开';
    case 'ding':
      return '丁字路口: 可以选择进入特定路线或继续前进';
    case 'waiting_room':
      return '候车室: 停留时可以前往鼓楼或仙林校区';
    default:
      return cornerType;
  }
}

function getCellTypeLabel(type: string): string {
  switch (type) {
    case 'corner':
      return '角落格';
    case 'event':
      return '事件格';
    case 'chance':
      return '机会卡';
    case 'line_entry':
      return '路线入口';
    default:
      return type;
  }
}

function getCellTypeColor(type: string): string {
  switch (type) {
    case 'corner':
      return '#f59e0b'; // amber
    case 'event':
      return '#8b5cf6'; // purple
    case 'chance':
      return '#06b6d4'; // cyan
    case 'line_entry':
      return '#10b981'; // emerald
    default:
      return '#6b7280'; // gray
  }
}

export function CellTooltip({ cell, lineData, position, visible, imageUrl }: CellTooltipProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const prevCellId = useRef<string | null>(null);

  // Reset image state when cell changes
  useEffect(() => {
    const currentId = cell?.id ?? null;
    if (currentId !== prevCellId.current) {
      prevCellId.current = currentId;
      setImgLoaded(false);
      setImgError(false);
    }
  }, [cell?.id]);

  const handleImgLoad = useCallback(() => setImgLoaded(true), []);
  const handleImgError = useCallback(() => setImgError(true), []);

  if (!cell || !visible) return null;

  const showImage = !!imageUrl && !imgError;

  // Smart positioning: avoid viewport overflow
  // Account for image height in tooltip size estimation
  const estimatedHeight = showImage ? 440 : 200;
  const tooltipWidth = 260;

  let left = position.x + 15;
  let top = position.y + 15;

  // Clamp to viewport
  if (left + tooltipWidth > window.innerWidth - 10) {
    left = position.x - tooltipWidth - 15;
  }
  if (left < 10) left = 10;

  if (top + estimatedHeight > window.innerHeight - 10) {
    top = position.y - estimatedHeight - 15;
  }
  if (top < 10) top = 10;

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left,
    top,
    zIndex: 1000,
    pointerEvents: 'none',
    backgroundColor: 'rgba(36, 28, 24, 0.95)',
    color: DESIGN_TOKENS.color.text.primary,
    padding: '0',
    borderRadius: '10px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
    maxWidth: '260px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
  };

  return (
    <div ref={tooltipRef} style={tooltipStyle} className="cell-tooltip">
      {/* Image preview */}
      {showImage && (
        <div className="cell-tooltip__image-wrap">
          {!imgLoaded && (
            <div className="cell-tooltip__image-placeholder" />
          )}
          <img
            src={imageUrl}
            alt={cell.name}
            className={`cell-tooltip__image ${imgLoaded ? 'cell-tooltip__image--loaded' : ''}`}
            onLoad={handleImgLoad}
            onError={handleImgError}
            draggable={false}
          />
        </div>
      )}

      {/* Text content */}
      <div style={{ padding: '12px 16px' }}>
        <h4 style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: 600,
          color: DESIGN_TOKENS.color.text.primary,
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          paddingBottom: '8px',
        }}>
          {cell.name}
        </h4>

        <div style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          marginBottom: '8px',
          backgroundColor: getCellTypeColor(cell.type),
        }}>
          {getCellTypeLabel(cell.type)}
        </div>

        {cell.type === 'line_entry' && (
          <div style={{ marginTop: '8px' }}>
            {lineData && (
              <p style={{ margin: '4px 0', color: DESIGN_TOKENS.color.text.secondary }}>
                <strong>路线:</strong> {lineData.name}
              </p>
            )}
            <p style={{ margin: '4px 0', color: '#4ade80' }}>
              <strong>入场费:</strong> ${cell.entryFee || 0}
            </p>
            {cell.forceEntry && (
              <p style={{ margin: '4px 0', color: '#f87171' }}>
                <strong>强制进入</strong>
              </p>
            )}
          </div>
        )}

        {cell.cornerType && (
          <div style={{ marginTop: '8px' }}>
            <p style={{ margin: '4px 0', color: '#fbbf24', fontSize: '13px' }}>
              {getCornerDescription(cell.cornerType)}
            </p>
          </div>
        )}

        {cell.type === 'event' && (
          <p style={{ margin: '8px 0 0 0', color: '#a78bfa', fontSize: '13px' }}>
            停留时触发事件
          </p>
        )}

        {cell.type === 'chance' && (
          <p style={{ margin: '8px 0 0 0', color: '#67e8f9', fontSize: '13px' }}>
            停留时抽取机会卡
          </p>
        )}

        {lineData && lineData.cells && (
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
            <p style={{ margin: '0 0 4px 0', color: '#a78bfa', fontSize: '12px', fontWeight: 600 }}>
              {lineData.name}
            </p>
            {lineData.experienceCard && cell.id === lineData.experienceCard.id && (
              <p style={{ margin: '4px 0', color: '#fbbf24', fontSize: '12px' }}>
                {lineData.experienceCard.description}
              </p>
            )}
            {lineData.cells.find(c => c.id === cell.id)?.description && (
              <p style={{ margin: '4px 0', color: DESIGN_TOKENS.color.text.secondary, fontSize: '12px' }}>
                {lineData.cells.find(c => c.id === cell.id)!.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CellTooltip;
