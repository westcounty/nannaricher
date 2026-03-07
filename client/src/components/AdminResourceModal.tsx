import { useState } from 'react';
import type { Player } from '@nannaricher/shared';
import { useSocket } from '../context/SocketContext';
import '../styles/admin-modal.css';

interface AdminResourceModalProps {
  players: Player[];
  onClose: () => void;
}

export function AdminResourceModal({ players, onClose }: AdminResourceModalProps) {
  const { socket } = useSocket();
  const [values, setValues] = useState(
    players.map(p => ({ playerId: p.id, money: p.money, gpa: p.gpa, exploration: p.exploration }))
  );

  const handleChange = (index: number, field: 'money' | 'gpa' | 'exploration', value: string) => {
    setValues(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: parseFloat(value) || 0 };
      return next;
    });
  };

  const handleSubmit = () => {
    if (!socket) return;
    socket.emit('admin:modify-resources', { changes: values });
    onClose();
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <h3 className="admin-modal__title">修改玩家资源</h3>
        <div className="admin-modal__list">
          {players.map((player, i) => (
            <div key={player.id} className="admin-modal__player">
              <div className="admin-modal__player-name">
                <span className="admin-modal__color-dot" style={{ backgroundColor: player.color }} />
                {player.name}
              </div>
              <div className="admin-modal__fields">
                <label className="admin-modal__field">
                  <span className="admin-modal__field-label">金钱</span>
                  <input
                    type="number"
                    value={values[i].money}
                    onChange={e => handleChange(i, 'money', e.target.value)}
                    className="admin-modal__input"
                  />
                </label>
                <label className="admin-modal__field">
                  <span className="admin-modal__field-label">GPA</span>
                  <input
                    type="number"
                    step="0.1"
                    value={values[i].gpa}
                    onChange={e => handleChange(i, 'gpa', e.target.value)}
                    className="admin-modal__input"
                  />
                </label>
                <label className="admin-modal__field">
                  <span className="admin-modal__field-label">探索</span>
                  <input
                    type="number"
                    value={values[i].exploration}
                    onChange={e => handleChange(i, 'exploration', e.target.value)}
                    className="admin-modal__input"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="admin-modal__actions">
          <button className="admin-modal__btn admin-modal__btn--confirm" onClick={handleSubmit}>确认修改</button>
          <button className="admin-modal__btn admin-modal__btn--cancel" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
