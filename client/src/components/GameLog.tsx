// client/src/components/GameLog.tsx
import React, { useState, useMemo } from 'react';
import type { GameLogEntry, Player } from '@nannaricher/shared';

interface GameLogProps {
  entries: GameLogEntry[];
  players: Player[];
}

export function GameLog({ entries, players }: GameLogProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Create a map of player IDs to player info for quick lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    players.forEach((player) => {
      map.set(player.id, { name: player.name, color: player.color });
    });
    return map;
  }, [players]);

  // Filter entries by selected player
  const filteredEntries = useMemo(() => {
    if (!selectedPlayerId) return entries;
    return entries.filter((entry) => entry.playerId === selectedPlayerId);
  }, [entries, selectedPlayerId]);

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
          <div className="log-filter">
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
                return (
                  <div key={`${entry.timestamp}-${index}`} className="log-entry">
                    <div className="entry-header">
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
