import { useGameStore } from '../stores/gameStore';
import '../styles/event-dice.css';

export function EventDiceOverlay() {
  const eventDice = useGameStore((s) => s.eventDice);
  if (!eventDice) return null;

  return (
    <div className="event-dice-overlay">
      <div className="event-dice-panel">
        <span className="event-dice-label">事件骰子</span>
        <div className="event-dice-values">
          {eventDice.values.map((v, i) => (
            <span key={i} className="event-dice-face">{v}</span>
          ))}
        </div>
        <span className="event-dice-total">= {eventDice.total}</span>
      </div>
    </div>
  );
}
