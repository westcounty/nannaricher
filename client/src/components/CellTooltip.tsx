// client/src/components/CellTooltip.tsx
import React from 'react';
import { BoardCell, BoardLine } from '@nannaricher/shared';

interface CellTooltipProps {
  cell: BoardCell | null;
  lineData?: BoardLine | null;
  position: { x: number; y: number };
  visible: boolean;
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

export function CellTooltip({ cell, lineData, position, visible }: CellTooltipProps) {
  if (!cell || !visible) return null;

  // Calculate position to avoid going off-screen
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x + 15, window.innerWidth - 260),
    top: Math.min(position.y + 15, window.innerHeight - 200),
    zIndex: 1000,
    pointerEvents: 'none',
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    maxWidth: '250px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  };

  return (
    <div style={tooltipStyle} className="cell-tooltip">
      <h4 style={{
        margin: '0 0 8px 0',
        fontSize: '16px',
        fontWeight: 600,
        color: '#fff',
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
            <p style={{ margin: '4px 0', color: '#ccc' }}>
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
            <p style={{ margin: '4px 0', color: '#ccc', fontSize: '12px' }}>
              {lineData.cells.find(c => c.id === cell.id)!.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
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

export default CellTooltip;
