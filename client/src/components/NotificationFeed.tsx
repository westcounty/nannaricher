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

export function NotificationFeed() {
  const notifications = useGameStore((s) => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-feed">
      {notifications.map((item) => (
        <NotificationEntry key={item.id} item={item} />
      ))}
    </div>
  );
}
