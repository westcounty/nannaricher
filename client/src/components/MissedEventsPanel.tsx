// client/src/components/MissedEventsPanel.tsx
// Shows a recap of events that happened while the tab was hidden.

import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import '../styles/missed-events.css';

export function MissedEventsPanel() {
  const missedEvents = useGameStore((s) => s.missedEvents);
  const clearMissedEvents = useGameStore((s) => s.clearMissedEvents);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (missedEvents.length > 0) {
      timerRef.current = setTimeout(() => {
        clearMissedEvents();
      }, 8000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [missedEvents.length, clearMissedEvents]);

  // Clear missed events when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab is being hidden — reset the timer if any
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
      // When tab becomes visible, the auto-dismiss timer starts via the length effect above
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (missedEvents.length === 0) return null;

  // Deduplicate consecutive identical events
  const dedupedEvents: string[] = [];
  for (const evt of missedEvents) {
    if (dedupedEvents[dedupedEvents.length - 1] !== evt) {
      dedupedEvents.push(evt);
    }
  }

  return (
    <div className="missed-events-panel">
      <div className="missed-events-panel__header">
        <span className="missed-events-panel__title">你错过了:</span>
        <button className="missed-events-panel__dismiss" onClick={clearMissedEvents}>
          知道了
        </button>
      </div>
      <ul className="missed-events-panel__list">
        {dedupedEvents.map((event, i) => (
          <li key={i} className="missed-events-panel__item">{event}</li>
        ))}
      </ul>
    </div>
  );
}
