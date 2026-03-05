// client/src/components/BattleHistory.tsx — Game history viewer
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import './BattleHistory.css';

const GAME_API = import.meta.env.VITE_API_URL || '';

interface GameResult {
  id: string;
  room_id: string;
  username: string;
  nickname: string;
  player_color: string;
  final_money: number;
  final_gpa: number;
  final_exploration: number;
  is_winner: boolean;
  training_plans: string[];
  lines_visited: string[];
  rounds_played: number;
  total_players: number;
  played_at: string;
}

interface Stats {
  total_games: number;
  total_wins: number;
  avg_gpa: number;
  avg_money: number;
  avg_exploration: number;
  best_gpa: number;
  max_money: number;
  max_exploration: number;
}

export function BattleHistory({ onBack }: { onBack: () => void }) {
  const { accessToken, getDisplayName } = useAuthStore();
  const [results, setResults] = useState<GameResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    const headers = { 'Authorization': `Bearer ${accessToken}` };

    Promise.all([
      fetch(`${GAME_API}/api/history?limit=50`, { headers }).then(r => r.json()),
      fetch(`${GAME_API}/api/history/stats`, { headers }).then(r => r.json()),
    ]).then(([historyData, statsData]) => {
      setResults(historyData.results || []);
      setStats(statsData);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [accessToken]);

  const winRate = stats && stats.total_games > 0
    ? Math.round((stats.total_wins / stats.total_games) * 100)
    : 0;

  return (
    <div className="history-screen">
      <motion.div
        className="history-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>

        <h2>战绩记录</h2>
        <p className="history-username">{getDisplayName()}</p>

        {/* Stats summary */}
        {stats && stats.total_games > 0 && (
          <motion.div
            className="history-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-item">
              <span className="stat-value">{stats.total_games}</span>
              <span className="stat-label">总场次</span>
            </div>
            <div className="stat-item stat-highlight">
              <span className="stat-value">{stats.total_wins}</span>
              <span className="stat-label">胜利</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{winRate}%</span>
              <span className="stat-label">胜率</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.avg_gpa?.toFixed(1) || '—'}</span>
              <span className="stat-label">平均GPA</span>
            </div>
          </motion.div>
        )}

        {/* Game list */}
        <div className="history-list">
          {loading ? (
            <div className="history-loading">加载中...</div>
          ) : results.length === 0 ? (
            <div className="history-empty">
              <p>还没有游戏记录</p>
              <p className="history-empty-hint">完成一场游戏后，战绩会出现在这里</p>
            </div>
          ) : (
            <AnimatePresence>
              {results.map((result, i) => (
                <motion.div
                  key={result.id}
                  className={`history-item ${result.is_winner ? 'is-winner' : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="history-item-header">
                    <div className="history-item-left">
                      {result.is_winner && <span className="winner-badge">Victory</span>}
                      <span className="history-date">
                        {formatDate(result.played_at)}
                      </span>
                    </div>
                    <span className="history-players">
                      {result.total_players}人局
                    </span>
                  </div>

                  <div className="history-item-stats">
                    <span className="history-stat">
                      <span className="history-stat-icon">💰</span>
                      {result.final_money}
                    </span>
                    <span className="history-stat">
                      <span className="history-stat-icon">📊</span>
                      {result.final_gpa.toFixed(1)}
                    </span>
                    <span className="history-stat">
                      <span className="history-stat-icon">🧭</span>
                      {result.final_exploration}
                    </span>
                  </div>

                  {result.training_plans.length > 0 && (
                    <div className="history-item-plans">
                      {result.training_plans.map((plan, j) => (
                        <span key={j} className="plan-tag">{plan}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHr < 24) return `${diffHr}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;

    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}
