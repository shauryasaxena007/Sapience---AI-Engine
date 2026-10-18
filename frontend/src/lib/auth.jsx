import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { applyTheme } from './theme.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api.get('/user/profile');
      setUser(p);
      localStorage.setItem('theme', p.settings.theme);
      applyTheme(p.settings.theme);
    } catch { setUser(null); }
  }, []);

  useEffect(() => { loadProfile().finally(() => setLoading(false)); }, [loadProfile]);

  const login = async (email, password) => { await api.post('/auth/login', { email, password }); await loadProfile(); };
  const register = async (displayName, email, password) => { await api.post('/auth/register', { displayName, email, password }); await loadProfile(); };
  const logout = async () => { await api.post('/auth/logout').catch(() => {}); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, reload: loadProfile, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
