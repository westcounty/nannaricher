// client/src/components/OpponentToast.tsx
// Shows brief toast notifications for opponent major events.

import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import './OpponentToast.css';

const AUTO_DISMISS_MS = 3000;

export function OpponentToast() {
  const notifications = useGameStore((s) => s.opponentNotifications);
  const removeOpponentNotification = useGameStore((s) => s.removeOpponentNotification);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    // Set up auto-dismiss for each notification
    for (const msg of notifications) {
      if (!timersRef.current.has(msg)) {
        const timer = setTimeout(() => {
          removeOpponentNotification(msg);
          timersRef.current.delete(msg);
        }, AUTO_DISMISS_MS);
        timersRef.current.set(msg, timer);
      }
    }

    // Clean up timers for removed notifications
    for (const [msg, timer] of timersRef.current.entries()) {
      if (!notifications.includes(msg)) {
        clearTimeout(timer);
        timersRef.current.delete(msg);
      }
    }
  }, [notifications, removeOpponentNotification]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="opponent-toast-container">
      {notifications.map((msg, i) => (
        <div key={`${msg}-${i}`} className="opponent-toast">
          {msg}
        </div>
      ))}
    </div>
  );
}
