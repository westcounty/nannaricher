// client/src/components/GameLog.tsx
import React, { useState, useMemo } from 'react';
import type { GameLogEntry, Player } from '@nannaricher/shared';

// ── Severity types ──────────────────────────────────────────────
type Severity = 'info' | 'important' | 'critical';
type SeverityFilter = 'all' | 'important+' | 'critical';

// ── Infer severity from message content ─────────────────────────
function inferSeverity(message: string): Severity {
  if (/胜利|破产|获胜|计划完成|强制结算|回合上限/.test(message)) return 'critical';
  if (/金钱|GPA|探索|抽卡|卡牌|得分/.test(message)) return 'important';
  return 'info';
}

// ── Infer icon type from message content ────────────────────────
type IconType = 'dice' | 'coin' | 'card' | 'star' | 'trophy' | 'default';

function inferIconType(message: string): IconType {
  if (/胜利|获胜|计划完成|强制结算/.test(message)) return 'trophy';
  if (/计划|培养/.test(message)) return 'star';
  if (/抽卡|卡牌|使用/.test(message)) return 'card';
  if (/金钱|薪水|费用|奖励|得分/.test(message)) return 'coin';
  if (/掷骰|骰子|移动/.test(message)) return 'dice';
  return 'default';
}

// ── Inline SVG icons (16x16) ────────────────────────────────────
const ICONS: Record<IconType, string> = {
  dice: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/></svg>`,
  coin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a3.5 3.5 0 0 0-5 0"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`,
  card: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="14" y2="10"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`,
  trophy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  default: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

// ── Severity styling config ─────────────────────────────────────
const SEVERITY_STYLES: Record<Severity, {
  borderColor: string;
  fontWeight: string;
  background: string;
  glow: string;
}> = {
  info: {
    borderColor: 'var(--color-text-muted, #707070)',
    fontWeight: 'normal',
    background: 'transparent',
    glow: 'none',
  },
  important: {
    borderColor: 'var(--color-accent, #C9A227)',
    fontWeight: '500',
    background: 'rgba(201, 162, 39, 0.05)',
    glow: 'none',
  },
  critical: {
    borderColor: 'var(--color-danger, #EF5350)',
    fontWeight: '700',
    background: 'rgba(239, 83, 80, 0.08)',
    glow: '0 0 6px rgba(239, 83, 80, 0.3)',
  },
};

const SEVERITY_FILTER_LABELS: Record<SeverityFilter, string> = {
  all: '全部等级',
  'important+': '重要及以上',
  critical: '仅关键',
};

// ── Props ───────────────────────────────────────────────────────
interface GameLogProps {
  entries: GameLogEntry[];
  players: Player[];
}

export function GameLog({ entries, players }: GameLogProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  // Create a map of player IDs to player info for quick lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    players.forEach((player) => {
      map.set(player.id, { name: player.name, color: player.color });
    });
    return map;
  }, [players]);

  // Filter entries by selected player and severity
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Player filter
      if (selectedPlayerId && entry.playerId !== selectedPlayerId) return false;
      // Severity filter
      if (severityFilter === 'all') return true;
      const severity = inferSeverity(entry.message);
      if (severityFilter === 'important+') return severity === 'important' || severity === 'critical';
      if (severityFilter === 'critical') return severity === 'critical';
      return true;
    });
  }, [entries, selectedPlayerId, severityFilter]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handlePlayerFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedPlayerId(value === '' ? null : value);
  };

  const handleSeverityFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSeverityFilter(e.target.value as SeverityFilter);
  };

  return (
    <div className={`game-log ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="log-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="log-header-left">
          <h3>游戏日志</h3>
          <span className="log-count">{entries.length} 条记录</span>
        </div>
        <button className="log-toggle-button">
          {isExpanded ? '收起' : '展开'}
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="log-filter" style={{ display: 'flex', gap: 'var(--spacing-sm, 8px)', flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="filter-label">筛选玩家:</label>
            <select
              className="filter-select"
              value={selectedPlayerId || ''}
              onChange={handlePlayerFilterChange}
            >
              <option value="">全部玩家</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>

            <label className="filter-label" style={{ marginLeft: 'var(--spacing-sm, 8px)' }}>等级:</label>
            <select
              className="filter-select"
              value={severityFilter}
              onChange={handleSeverityFilterChange}
            >
              {(Object.keys(SEVERITY_FILTER_LABELS) as SeverityFilter[]).map((key) => (
                <option key={key} value={key}>
                  {SEVERITY_FILTER_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="log-entries">
            {filteredEntries.length === 0 ? (
              <div className="log-empty">
                <span className="empty-icon">📋</span>
                <span className="empty-text">
                  {selectedPlayerId ? '该玩家暂无游戏记录' : '暂无游戏记录'}
                </span>
              </div>
            ) : (
              filteredEntries.map((entry, index) => {
                const playerInfo = playerMap.get(entry.playerId);
                const severity = inferSeverity(entry.message);
                const iconType = inferIconType(entry.message);
                const styles = SEVERITY_STYLES[severity];

                return (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className={`log-entry log-entry--${severity}`}
                    style={{
                      borderLeft: `3px solid ${styles.borderColor}`,
                      fontWeight: styles.fontWeight,
                      background: styles.background,
                      boxShadow: styles.glow,
                      padding: 'var(--spacing-xs, 4px) var(--spacing-sm, 8px)',
                      marginBottom: '2px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      transition: 'var(--transition-fast, 0.15s ease)',
                    }}
                  >
                    <div className="entry-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs, 4px)' }}>
                      <span
                        className="entry-icon"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: styles.borderColor,
                          flexShrink: 0,
                        }}
                        dangerouslySetInnerHTML={{ __html: ICONS[iconType] }}
                      />
                      <span className="entry-turn">回合 {entry.turn}</span>
                      <span className="entry-time">{formatTime(entry.timestamp)}</span>
                    </div>
                    <div className="entry-content">
                      {playerInfo && (
                        <span
                          className="entry-player"
                          style={{ color: playerInfo.color }}
                        >
                          {playerInfo.name}
                        </span>
                      )}
                      <span className="entry-message">{entry.message}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
