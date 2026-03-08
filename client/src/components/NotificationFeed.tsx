// client/src/components/NotificationFeed.tsx
// Stacked notification feed — each notification auto-dismisses independently
import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import type { NotificationItem } from '../stores/gameStore';
import '../styles/notification-feed.css';

const DISMISS_MS = 6000;

function NotificationEntry({ item }: { item: NotificationItem }) {
  const removeNotification = useGameStore((s) => s.removeNotification);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      removeNotification(item.id);
    }, DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, removeNotification]);

  return (
    <div className={`notif-item notif-item--${item.type}`}>
      <span className="notif-item__text">{item.message}</span>
      <button
        className="notif-item__close"
        onClick={() => removeNotification(item.id)}
        aria-label="关闭"
      >
        &times;
      </button>
    </div>
  );
}

const MAX_VISIBLE = 5;

export function NotificationFeed() {
  const notifications = useGameStore((s) => s.notifications);

  if (notifications.length === 0) return null;

  const visible = notifications.slice(-MAX_VISIBLE);
  const hiddenCount = notifications.length - visible.length;

  return (
    <div className="notification-feed">
      {hiddenCount > 0 && (
        <div className="notif-item notif-item--collapsed">
          还有 {hiddenCount} 条通知
        </div>
      )}
      {visible.map((item) => (
        <NotificationEntry key={item.id} item={item} />
      ))}
    </div>
  );
}
