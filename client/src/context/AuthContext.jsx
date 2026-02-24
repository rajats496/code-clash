import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Auto-connect socket when token changes
  useEffect(() => {
    if (token) {
      connectSocket(token);
    }

    return () => {
      if (!token) {
        disconnectSocket();
      }
    };
  }, [token]);

  const refreshUser = async () => {
    try {
      const tk = localStorage.getItem('token');
      if (!tk) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tk}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('✅ User data refreshed');
      }
    } catch (error) {
      console.error('❌ Error refreshing user:', error);
    }
  };

  /** Save auth state after successful login/register */
  const saveAuth = (jwtToken, userData) => {
    setToken(jwtToken);
    setUser(userData);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  /**
   * Login with Google token (access_token or id_token)
   */
  const loginWithGoogle = async (googleToken, tokenType = 'id_token') => {
    try {
      const response = await api.post('/auth/google', { token: googleToken, tokenType });
      const { token: jwtToken, user: userData } = response.data;
      saveAuth(jwtToken, userData);
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  /**
   * Register with email + password
   */
  const registerWithEmail = async ({ name, email, password, role }) => {
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const { token: jwtToken, user: userData } = response.data;
      saveAuth(jwtToken, userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  /**
   * Login with email + password
   */
  const loginWithEmail = async ({ email, password, role }) => {
    try {
      const response = await api.post('/auth/login', { email, password, role });
      const { token: jwtToken, user: userData } = response.data;
      saveAuth(jwtToken, userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  /**
   * Logout
   */
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
  };

  const value = {
    user,
    token,
    loading,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};