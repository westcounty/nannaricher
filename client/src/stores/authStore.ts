// client/src/stores/authStore.ts — Authentication state management
import { create } from 'zustand';

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || 'https://admin.nju.top';

const STORAGE_KEYS = {
  accessToken: 'nannaricher_access_token',
  refreshToken: 'nannaricher_refresh_token',
  user: 'nannaricher_user',
  deviceFingerprint: 'nannaricher_device_fp',
} as const;

export interface AuthUser {
  userId: string;
  username?: string;
  phone?: string;
  nickname?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  sendSmsCode: (phone: string) => Promise<string>;
  loginWithSms: (phone: string, code: string, smsToken: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  loadFromStorage: () => void;
  setError: (error: string | null) => void;
  getDisplayName: () => string;
}

function getDeviceFingerprint(): string {
  let fp = localStorage.getItem(STORAGE_KEYS.deviceFingerprint);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.deviceFingerprint, fp);
  }
  return fp;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function saveToStorage(accessToken: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}

async function fetchUserProfile(accessToken: string): Promise<{ nickname?: string; username?: string } | null> {
  try {
    const res = await fetch(`${AUTH_API}/v1/users/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        nickname: data.nickname || data.nicknameDisplay || data.nickname_display,
        username: data.usernameDisplay || data.username_display || data.username,
      };
    }
  } catch { /* ignore */ }
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${AUTH_API}/v1/auth/password/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          deviceFingerprint: getDeviceFingerprint(),
          deviceName: 'NannaRicher Web',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `登录失败 (${res.status})`);
      }

      const { accessToken, refreshToken } = await res.json();
      const payload = decodeJwtPayload(accessToken);
      const userId = payload?.sub as string;

      // Try to fetch profile for nickname
      const profile = await fetchUserProfile(accessToken);

      const user: AuthUser = {
        userId,
        username,
        phone: payload?.phone as string | undefined,
        nickname: profile?.nickname || username,
      };

      saveToStorage(accessToken, refreshToken, user);
      set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${AUTH_API}/v1/auth/password/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          deviceFingerprint: getDeviceFingerprint(),
          deviceName: 'NannaRicher Web',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `注册失败 (${res.status})`);
      }

      const { accessToken, refreshToken } = await res.json();
      const payload = decodeJwtPayload(accessToken);
      const userId = payload?.sub as string;

      const user: AuthUser = {
        userId,
        username,
        nickname: username,
      };

      saveToStorage(accessToken, refreshToken, user);
      set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  sendSmsCode: async (phone: string): Promise<string> => {
    set({ error: null });
    try {
      const res = await fetch(`${AUTH_API}/v1/auth/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `发送验证码失败 (${res.status})`);
      }

      const { smsToken } = await res.json();
      return smsToken;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  loginWithSms: async (phone: string, code: string, smsToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${AUTH_API}/v1/auth/sms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          code,
          smsToken,
          deviceFingerprint: getDeviceFingerprint(),
          deviceName: 'NannaRicher Web',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `验证码验证失败 (${res.status})`);
      }

      const { accessToken, refreshToken } = await res.json();
      const payload = decodeJwtPayload(accessToken);
      const userId = payload?.sub as string;

      const profile = await fetchUserProfile(accessToken);

      const user: AuthUser = {
        userId,
        phone,
        username: profile?.username,
        nickname: profile?.nickname || phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      };

      saveToStorage(accessToken, refreshToken, user);
      set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  refreshAccessToken: async (): Promise<boolean> => {
    const { refreshToken: currentRefreshToken } = get();
    if (!currentRefreshToken) return false;

    try {
      const res = await fetch(`${AUTH_API}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: currentRefreshToken,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });

      if (!res.ok) {
        clearStorage();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        return false;
      }

      const { accessToken, refreshToken } = await res.json();
      const user = get().user;
      if (user) {
        saveToStorage(accessToken, refreshToken, user);
      }
      set({ accessToken, refreshToken });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    const { refreshToken: currentRefreshToken } = get();
    // Fire-and-forget logout call
    if (currentRefreshToken) {
      fetch(`${AUTH_API}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      }).catch(() => {});
    }
    clearStorage();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, error: null });
  },

  loadFromStorage: () => {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    const userJson = localStorage.getItem(STORAGE_KEYS.user);

    if (accessToken && refreshToken && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        // Check if token is expired
        const payload = decodeJwtPayload(accessToken);
        const now = Math.floor(Date.now() / 1000);
        if (payload?.exp && (payload.exp as number) < now) {
          // Token expired, try refresh
          set({ user, refreshToken, isAuthenticated: false });
          get().refreshAccessToken().then(ok => {
            if (ok) set({ isAuthenticated: true });
            else clearStorage();
          });
          return;
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      } catch {
        clearStorage();
      }
    }
  },

  setError: (error) => set({ error }),

  getDisplayName: () => {
    const { user } = get();
    if (!user) return '游客';
    return user.nickname || user.username || user.phone || '未知用户';
  },
}));
