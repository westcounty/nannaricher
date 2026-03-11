// client/src/components/AuthScreen.tsx — Login/Register screen
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import './AuthScreen.css';

type AuthTab = 'password' | 'sms';
type AuthMode = 'login' | 'register';

const tabVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>('password');
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <div className="auth-screen">
      <motion.div
        className="auth-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        <img src="/art/nanna-emblem/best.webp" alt="菜根人生" style={{ width: 120, height: 120, margin: '0 auto 12px', display: 'block', borderRadius: '24px' }} />
        <h1>菜根人生</h1>
        <p className="subtitle">南大版大富翁</p>
      </motion.div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'password' ? 'active' : ''}`}
            onClick={() => { setTab('password'); setMode('login'); }}
          >
            账号登录
          </button>
          <button
            className={`auth-tab ${tab === 'sms' ? 'active' : ''}`}
            onClick={() => { setTab('sms'); setMode('login'); }}
          >
            短信登录
          </button>
          <div
            className="auth-tab-indicator"
            style={{ transform: `translateX(${tab === 'password' ? '0%' : '100%'})` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {tab === 'password' ? (
            <motion.div
              key="password"
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <PasswordForm mode={mode} onToggleMode={() => setMode(m => m === 'login' ? 'register' : 'login')} />
            </motion.div>
          ) : (
            <motion.div
              key="sms"
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <SmsForm />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.p
        className="auth-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        账号与图禅 PhotoZen 通用
      </motion.p>
    </div>
  );
}

function PasswordForm({ mode, onToggleMode }: { mode: AuthMode; onToggleMode: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const { login, register, isLoading, error, setError } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
  }, [mode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    if (mode === 'register') {
      if (password !== confirmPwd) {
        setError('两次输入的密码不一致');
        return;
      }
      if (password.length < 8) {
        setError('密码至少8位，需包含字母和数字');
        return;
      }
    }

    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch { /* error is set in store */ }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label>用户名</label>
        <input
          ref={inputRef}
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="请输入用户名"
          maxLength={32}
          disabled={isLoading}
          autoComplete="username"
        />
      </div>

      <div className="auth-field">
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={mode === 'register' ? '至少8位，需包含字母和数字' : '请输入密码'}
          disabled={isLoading}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      <AnimatePresence>
        {mode === 'register' && (
          <motion.div
            className="auth-field"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
          >
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="再次输入密码"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </motion.div>
        )}
      </AnimatePresence>

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
        disabled={isLoading || !username.trim() || !password}
        whileHover={!isLoading ? { scale: 1.02 } : {}}
        whileTap={!isLoading ? { scale: 0.98 } : {}}
      >
        {isLoading ? (
          <span className="auth-spinner" />
        ) : (
          mode === 'login' ? '登录' : '注册'
        )}
      </motion.button>

      <button type="button" className="auth-toggle" onClick={onToggleMode}>
        {mode === 'login' ? '没有账号？注册一个' : '已有账号？去登录'}
      </button>
    </form>
  );
}

function SmsForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [smsToken, setSmsToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const { sendSmsCode, loginWithSms, isLoading, error, setError } = useAuthStore();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!phone.trim() || countdown > 0) return;
    try {
      const token = await sendSmsCode(phone.trim());
      setSmsToken(token);
      setCountdown(60);
      codeRef.current?.focus();
    } catch { /* error is set in store */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !code.trim() || !smsToken) return;
    try {
      await loginWithSms(phone.trim(), code.trim(), smsToken);
    } catch { /* error is set in store */ }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label>手机号</label>
        <div className="auth-phone-row">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="请输入手机号"
            maxLength={11}
            disabled={isLoading}
            autoComplete="tel"
          />
          <button
            type="button"
            className="auth-send-code"
            onClick={handleSendCode}
            disabled={!phone.trim() || phone.trim().length < 11 || countdown > 0 || isLoading}
          >
            {countdown > 0 ? `${countdown}s` : '获取验证码'}
          </button>
        </div>
      </div>

      <div className="auth-field">
        <label>验证码</label>
        <input
          ref={codeRef}
          type="text"
          inputMode="numeric"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="请输入6位验证码"
          maxLength={6}
          disabled={isLoading}
          autoComplete="one-time-code"
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
        disabled={isLoading || !phone.trim() || !code.trim() || !smsToken}
        whileHover={!isLoading ? { scale: 1.02 } : {}}
        whileTap={!isLoading ? { scale: 0.98 } : {}}
      >
        {isLoading ? <span className="auth-spinner" /> : '登录'}
      </motion.button>
    </form>
  );
}
