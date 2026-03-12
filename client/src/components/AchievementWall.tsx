// client/src/components/AchievementWall.tsx — Achievement wall display
import { useEffect, useState } from 'react';
import { useAchievementStore } from '../stores/achievementStore';
import type { AchievementDef, AchievementCategory, AchievementRarity } from '@nannaricher/shared';
import '../styles/achievement-wall.css';

// ── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  all:      { label: '全部', icon: '📋' },
  beginner: { label: '新手', icon: '🎓' },
  academic: { label: '学业', icon: '📚' },
  wealth:   { label: '财富', icon: '💰' },
  explorer: { label: '探索', icon: '🗺️' },
  cards:    { label: '卡牌', icon: '🃏' },
  plans:    { label: '计划', icon: '🎓' },
  survival: { label: '生存', icon: '💪' },
  social:   { label: '社交', icon: '👥' },
  food:     { label: '食堂', icon: '🍜' },
  composite:{ label: '综合', icon: '🏆' },
  hidden:   { label: '隐藏', icon: '🔮' },
};

const CATEGORY_ORDER = [
  'all', 'beginner', 'academic', 'wealth', 'explorer',
  'cards', 'plans', 'survival', 'social', 'food', 'composite', 'hidden',
] as const;

// ── Rarity helpers ───────────────────────────────────────────────────────────

const RARITY_STARS: Record<AchievementRarity, number> = {
  common:    1,
  rare:      2,
  epic:      3,
  legendary: 4,
};

// ── Date formatter ───────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffDay < 1) return '今天';
    if (diffDay < 7) return `${diffDay}天前`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;

    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  } catch {
    return dateStr;
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface RarityStarsProps {
  rarity: AchievementRarity;
}

function RarityStars({ rarity }: RarityStarsProps) {
  const filled = RARITY_STARS[rarity];
  return (
    <div className="achievement-wall__stars">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`achievement-wall__star ${n <= filled ? 'achievement-wall__star--filled' : ''}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

interface AchievementCardProps {
  def: AchievementDef;
  unlockedAt?: string;
  progressCurrent?: number;
  progressMax?: number;
}

function AchievementCard({ def, unlockedAt, progressCurrent, progressMax }: AchievementCardProps) {
  const isUnlocked = Boolean(unlockedAt);
  const isHiddenLocked = def.hidden && !isUnlocked;

  let cardClass = `achievement-wall__card achievement-wall__card--${def.rarity}`;
  if (isUnlocked) {
    cardClass += ' achievement-wall__card--unlocked';
  } else if (isHiddenLocked) {
    cardClass += ' achievement-wall__card--hidden-locked';
  } else {
    cardClass += ' achievement-wall__card--locked';
  }

  // For hidden locked, mask everything
  const displayIcon = isHiddenLocked ? '🔮' : def.icon;
  const displayName = isHiddenLocked ? '???' : def.name;
  const displayDesc = isHiddenLocked ? '达成条件: 隐藏' : def.description;

  const showProgress =
    !isUnlocked &&
    !isHiddenLocked &&
    def.maxProgress !== undefined &&
    progressMax !== undefined &&
    progressCurrent !== undefined;

  const pct = showProgress ? Math.min(100, Math.round((progressCurrent! / progressMax!) * 100)) : 0;

  const progressText =
    showProgress && def.progressLabel
      ? def.progressLabel.replace('{n}', String(progressCurrent!)).replace('{max}', String(progressMax!))
      : showProgress
        ? `${progressCurrent}/${progressMax}`
        : null;

  return (
    <div className={cardClass}>
      {/* Icon */}
      <div className="achievement-wall__card-icon">{displayIcon}</div>

      {/* Rarity stars */}
      <RarityStars rarity={def.rarity} />

      {/* Name */}
      <div className="achievement-wall__card-name">{displayName}</div>

      {/* Description */}
      <div className="achievement-wall__card-desc">{displayDesc}</div>

      {/* Points (unlocked only) */}
      {isUnlocked && (
        <div className="achievement-wall__card-points">
          <span>✦</span>
          <span>{def.points} 分</span>
        </div>
      )}

      {/* Unlock date */}
      {unlockedAt && (
        <div className="achievement-wall__card-date">
          {formatDate(unlockedAt)}
        </div>
      )}

      {/* Progress bar (locked, non-hidden, has progress) */}
      {showProgress && (
        <div className="achievement-wall__progress">
          <div className="achievement-wall__progress-track">
            <div
              className="achievement-wall__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progressText && (
            <div className="achievement-wall__progress-label">{progressText}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AchievementWall() {
  const { definitions, summary, isLoading } = useAchievementStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Fetch on mount
  useEffect(() => {
    useAchievementStore.getState().fetchAll();
  }, []);

  // Build lookup maps from summary
  const unlockedMap = new Map<string, string>(); // achievementId -> unlockedAt
  const progressMap = new Map<string, { current: number; max: number }>(); // achievementId -> progress

  if (summary) {
    for (const u of summary.unlocked) {
      unlockedMap.set(u.achievementId, u.unlockedAt);
    }
    for (const p of summary.progress) {
      progressMap.set(p.achievementId, { current: p.current, max: p.max });
    }
  }

  // Filter definitions by category
  const filtered: AchievementDef[] =
    activeCategory === 'all'
      ? definitions
      : definitions.filter((d) => d.category === (activeCategory as AchievementCategory));

  // Sort: unlocked first (by unlock date desc), then locked alphabetically
  const sorted = [...filtered].sort((a, b) => {
    const aUnlocked = unlockedMap.has(a.id);
    const bUnlocked = unlockedMap.has(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    if (aUnlocked && bUnlocked) {
      const aDate = unlockedMap.get(a.id)!;
      const bDate = unlockedMap.get(b.id)!;
      return bDate.localeCompare(aDate); // newest first
    }
    return 0;
  });

  const totalCount = definitions.length;
  const unlockedCount = summary?.unlocked.length ?? 0;
  const totalPoints = summary?.totalPoints ?? 0;
  const rankIcon = summary?.rankIcon ?? '🥚';
  const rankName = summary?.rank ?? '萌新';

  // Loading
  if (isLoading && definitions.length === 0) {
    return (
      <div className="achievement-wall">
        <div className="achievement-wall__loading">
          <div className="achievement-wall__loading-spinner" />
          <div className="achievement-wall__loading-text">加载成就中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="achievement-wall">
      {/* Header */}
      <div className="achievement-wall__header">
        <div className="achievement-wall__rank">
          <span className="achievement-wall__rank-icon">{rankIcon}</span>
          <div className="achievement-wall__rank-info">
            <div className="achievement-wall__rank-name">{rankName}</div>
          </div>
        </div>

        <div className="achievement-wall__stats">
          <div className="achievement-wall__stat">
            <span className="achievement-wall__stat-value">
              {unlockedCount}/{totalCount}
            </span>
            <span className="achievement-wall__stat-label">已解锁</span>
          </div>
          <div className="achievement-wall__stat-divider" />
          <div className="achievement-wall__stat">
            <span className="achievement-wall__stat-value">{totalPoints}</span>
            <span className="achievement-wall__stat-label">总积分</span>
          </div>
        </div>

        <div className="achievement-wall__points-badge">
          ✦ {totalPoints} 成就点
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="achievement-wall__tabs" role="tablist">
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_LABELS[cat];
          if (!meta) return null;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              className={`achievement-wall__tab${activeCategory === cat ? ' achievement-wall__tab--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="achievement-wall__body">
        {sorted.length === 0 ? (
          <div className="achievement-wall__empty">
            <div className="achievement-wall__empty-icon">🏆</div>
            <div className="achievement-wall__empty-title">暂无成就</div>
            <div className="achievement-wall__empty-hint">
              开始游戏来解锁成就吧！
            </div>
          </div>
        ) : (
          <>
            <div className="achievement-wall__count">
              显示 {sorted.length} 个成就
            </div>
            <div className="achievement-wall__grid">
              {sorted.map((def) => {
                const prog = progressMap.get(def.id);
                return (
                  <AchievementCard
                    key={def.id}
                    def={def}
                    unlockedAt={unlockedMap.get(def.id)}
                    progressCurrent={prog?.current}
                    progressMax={prog?.max}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
