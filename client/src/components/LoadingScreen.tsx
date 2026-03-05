import { useState, useEffect } from 'react';
import './LoadingScreen.css';

/**
 * Loading screen types
 */
export type LoadingType =
  | 'connecting' // Initial server connection
  | 'waiting' // Waiting for other players
  | 'calculating' // Game calculation in progress
  | 'loading' // General loading state
  | 'custom'; // Custom message

interface LoadingScreenProps {
  type?: LoadingType;
  message?: string;
  subMessage?: string;
  progress?: number; // 0-100, if undefined shows indeterminate
  showTips?: boolean;
  onComplete?: () => void;
}

/**
 * Default messages for each loading type
 */
const DEFAULT_MESSAGES: Record<LoadingType, { title: string; subtitle: string }> = {
  connecting: {
    title: '正在连接服务器',
    subtitle: '建立连接中...',
  },
  waiting: {
    title: '等待玩家',
    subtitle: '等待其他玩家加入...',
  },
  calculating: {
    title: '处理中',
    subtitle: '计算游戏状态...',
  },
  loading: {
    title: '加载中',
    subtitle: '请稍候...',
  },
  custom: {
    title: '',
    subtitle: '',
  },
};

/**
 * Game tips to show during loading
 */
const GAME_TIPS = [
  '平衡你的GPA和金钱——两者都很重要！',
  '访问不同类型的格子可以提高探索值。',
  '事件卡牌可以扭转局势——在关键时刻使用！',
  '与其他玩家走到同一格子可能触发特殊事件。',
  '培养计划提供长期收益——谨慎选择！',
  '高GPA可以获得奖学金。',
  '管好你的钱包是避免破产的关键。',
  '校医院格子会让你暂停行动。',
  '探索值可以解锁特殊结局。',
  '注意对手的行动——他们可能影响你的策略！',
];

/**
 * LoadingScreen Component
 * Displays various loading states with animations and tips
 */
export function LoadingScreen({
  type = 'loading',
  message,
  subMessage,
  progress,
  showTips = true,
}: LoadingScreenProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [dots, setDots] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Fade in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Rotate tips every 4 seconds
  useEffect(() => {
    if (!showTips) return;

    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % GAME_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [showTips]);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Get display messages
  const defaultMessage = DEFAULT_MESSAGES[type];
  const displayMessage = message ?? defaultMessage.title;
  const displaySubMessage = subMessage ?? defaultMessage.subtitle;

  return (
    <div className={`loading-screen loading-screen--${type} ${isVisible ? 'loading-screen--visible' : ''}`}>
      <div className="loading-screen__content">
        {/* Animated Icon */}
        <div className="loading-screen__icon">
          {type === 'connecting' && <ConnectingIcon />}
          {type === 'waiting' && <WaitingIcon />}
          {type === 'calculating' && <CalculatingIcon />}
          {type === 'loading' && <LoadingIcon />}
          {type === 'custom' && <LoadingIcon />}
        </div>

        {/* Main Message */}
        <h2 className="loading-screen__title">
          {displayMessage}
          {dots}
        </h2>

        {/* Sub Message */}
        {displaySubMessage && (
          <p className="loading-screen__subtitle">{displaySubMessage}</p>
        )}

        {/* Progress Bar */}
        <div className="loading-screen__progress-container">
          {progress !== undefined ? (
            <div className="loading-screen__progress-bar">
              <div
                className="loading-screen__progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          ) : (
            <div className="loading-screen__spinner">
              <div className="loading-screen__spinner-ring" />
              <div className="loading-screen__spinner-ring" />
              <div className="loading-screen__spinner-ring" />
            </div>
          )}
        </div>

        {/* Progress Percentage */}
        {progress !== undefined && (
          <span className="loading-screen__percentage">{Math.round(progress)}%</span>
        )}

        {/* Game Tips */}
        {showTips && (
          <div className="loading-screen__tips">
            <p className="loading-screen__tip" key={currentTip}>
              {GAME_TIPS[currentTip]}
            </p>
          </div>
        )}

        {/* Player count for waiting type */}
        {type === 'waiting' && (
          <div className="loading-screen__waiting-indicator">
            <span className="loading-screen__pulse-dot" />
            <span className="loading-screen__pulse-dot" />
            <span className="loading-screen__pulse-dot" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Connecting animation icon
 */
function ConnectingIcon() {
  return (
    <svg className="loading-icon" viewBox="0 0 100 100" width="80" height="80">
      <circle
        className="loading-icon__circle loading-icon__circle--outer"
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="70 200"
        strokeLinecap="round"
      />
      <circle
        className="loading-icon__circle loading-icon__circle--inner"
        cx="50"
        cy="50"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="50 150"
        strokeLinecap="round"
      />
      <circle
        className="loading-icon__dot"
        cx="50"
        cy="50"
        r="8"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Waiting animation icon
 */
function WaitingIcon() {
  return (
    <div className="loading-icon--waiting">
      <span className="waiting-dot" />
      <span className="waiting-dot" />
      <span className="waiting-dot" />
    </div>
  );
}

/**
 * Calculating animation icon
 */
function CalculatingIcon() {
  return (
    <svg className="loading-icon" viewBox="0 0 100 100" width="80" height="80">
      <g className="calculating-gear calculating-gear--large">
        <path
          fill="currentColor"
          d="M50 20 L55 35 L70 30 L65 45 L80 50 L65 55 L70 70 L55 65 L50 80 L45 65 L30 70 L35 55 L20 50 L35 45 L30 30 L45 35 Z"
        />
        <circle cx="50" cy="50" r="10" fill="var(--color-bg, #f5f5f5)" />
      </g>
      <g className="calculating-gear calculating-gear--small">
        <path
          fill="currentColor"
          opacity="0.6"
          transform="translate(60, 60) scale(0.5)"
          d="M50 20 L55 35 L70 30 L65 45 L80 50 L65 55 L70 70 L55 65 L50 80 L45 65 L30 70 L35 55 L20 50 L35 45 L30 30 L45 35 Z"
        />
      </g>
    </svg>
  );
}

/**
 * Generic loading icon
 */
function LoadingIcon() {
  return (
    <div className="loading-icon--spinner">
      <div className="spinner-segment" />
      <div className="spinner-segment" />
      <div className="spinner-segment" />
      <div className="spinner-segment" />
    </div>
  );
}

/**
 * Inline loading indicator for use within components
 */
export function InlineLoading({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <div className={`inline-loading inline-loading--${size}`}>
      <div className="inline-loading__spinner" />
    </div>
  );
}

/**
 * Skeleton loading placeholder
 */
export function Skeleton({ width, height, borderRadius }: {
  width?: string;
  height?: string;
  borderRadius?: string;
}) {
  return (
    <div
      className="skeleton"
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius: borderRadius || '4px',
      }}
    />
  );
}

export default LoadingScreen;
