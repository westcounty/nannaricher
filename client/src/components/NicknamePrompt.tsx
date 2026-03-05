// client/src/components/NicknamePrompt.tsx — Prompt SMS users to set a nickname
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import './AuthScreen.css';

export function NicknamePrompt() {
  const { user, setNickname } = useAuthStore();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请输入昵称');
      return;
    }
    if (trimmed.length < 2) {
      setError('昵称至少2个字符');
      return;
    }
    if (trimmed.length > 16) {
      setError('昵称最多16个字符');
      return;
    }
    setNickname(trimmed);
  };

  return (
    <div className="auth-screen">
      <motion.div
        className="auth-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        <h1>菜根人生</h1>
        <p className="subtitle">设置你的游戏昵称</p>
      </motion.div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <motion.p
            style={{
              color: 'rgba(176, 176, 176, 0.7)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              marginBottom: 24,
              textAlign: 'center',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            欢迎！请为自己取一个游戏昵称
            <br />
            <span style={{ fontSize: '0.82rem', color: 'rgba(176, 176, 176, 0.4)' }}>
              当前显示为 {user?.nickname || user?.phone || '未知用户'}
            </span>
          </motion.p>

          <div className="auth-field">
            <label>昵称</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="2-16个字符"
              maxLength={16}
              autoComplete="nickname"
            />
          </div>

          {error && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {error}
            </motion.div>
          )}

          <motion.button
            type="submit"
            className="auth-submit"
            disabled={!name.trim()}
            whileHover={name.trim() ? { scale: 1.02 } : {}}
            whileTap={name.trim() ? { scale: 0.98 } : {}}
          >
            确认昵称
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
