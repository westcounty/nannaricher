// client/src/components/CellDetailDrawer.tsx
// Bottom drawer showing full cell details when a cell is clicked/tapped.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { BoardCell, BoardLine } from '@nannaricher/shared';
import '../styles/cell-detail-drawer.css';

interface CellDetailDrawerProps {
  cell: BoardCell | null;
  lineData?: BoardLine | null;
  imageUrl?: string;
  onClose: () => void;
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
      return '#f59e0b';
    case 'event':
      return '#8b5cf6';
    case 'chance':
      return '#06b6d4';
    case 'line_entry':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

export function CellDetailDrawer({ cell, lineData, imageUrl, onClose }: CellDetailDrawerProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
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

  const isOpen = !!cell;
  const showImage = !!imageUrl && !imgError;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`cell-detail-backdrop ${isOpen ? 'cell-detail-backdrop--visible' : ''}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`cell-detail-drawer ${isOpen ? 'cell-detail-drawer--open' : ''}`}>
        {cell && (
          <>
            {/* Image */}
            {showImage && (
              !imgLoaded ? (
                <div className="cell-detail-drawer__image-placeholder" />
              ) : null
            )}
            {showImage && (
              <img
                src={imageUrl}
                alt={cell.name}
                className="cell-detail-drawer__image"
                onLoad={handleImgLoad}
                onError={handleImgError}
                draggable={false}
                style={!imgLoaded ? { position: 'absolute', opacity: 0 } : undefined}
              />
            )}

            {/* Header: name + close button */}
            <div className="cell-detail-drawer__header">
              <h3 className="cell-detail-drawer__name">{cell.name}</h3>
              <button className="cell-detail-drawer__close" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Type badge */}
            <span
              className="cell-detail-drawer__badge"
              style={{ backgroundColor: getCellTypeColor(cell.type) }}
            >
              {getCellTypeLabel(cell.type)}
            </span>

            {/* Body */}
            <div className="cell-detail-drawer__body">
              {/* Corner description */}
              {cell.cornerType && (
                <p className="cell-detail-drawer__desc" style={{ color: '#fbbf24' }}>
                  {getCornerDescription(cell.cornerType)}
                </p>
              )}

              {/* Event description */}
              {cell.type === 'event' && (
                <p className="cell-detail-drawer__desc" style={{ color: '#a78bfa' }}>
                  停留时触发事件
                </p>
              )}

              {/* Chance description */}
              {cell.type === 'chance' && (
                <p className="cell-detail-drawer__desc" style={{ color: '#67e8f9' }}>
                  停留时抽取机会卡
                </p>
              )}

              {/* Line entry info */}
              {cell.type === 'line_entry' && (
                <div className="cell-detail-drawer__entry-info">
                  {lineData && (
                    <p style={{ color: '#ccc' }}>
                      <strong>路线:</strong> {lineData.name}
                    </p>
                  )}
                  <p style={{ color: '#4ade80' }}>
                    <strong>入场费:</strong> ${cell.entryFee || 0}
                  </p>
                  {cell.forceEntry && (
                    <p style={{ color: '#f87171' }}>
                      <strong>强制进入</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Line cell details */}
              {lineData && lineData.cells && (
                <div className="cell-detail-drawer__line-section">
                  <p className="cell-detail-drawer__line-name">{lineData.name}</p>
                  {lineData.experienceCard && cell.id === lineData.experienceCard.id && (
                    <p className="cell-detail-drawer__line-desc" style={{ color: '#fbbf24' }}>
                      {lineData.experienceCard.description}
                    </p>
                  )}
                  {lineData.cells.find(c => c.id === cell.id)?.description && (
                    <p className="cell-detail-drawer__line-desc">
                      {lineData.cells.find(c => c.id === cell.id)!.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default CellDetailDrawer;
