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
      // Cleanup on unmount or when token changes
      if (!token) {
        disconnectSocket();
      }
    };
  }, [token]);

    const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        console.log('✅ User data refreshed');
      }
    } catch (error) {
      console.error('❌ Error refreshing user:', error);
    }
  };

  /**
   * Login with Google ID token
   */
  const loginWithGoogle = async (googleToken) => {
    try {
      const response = await api.post('/auth/google', { token: googleToken });
      const { token: jwtToken, user: userData } = response.data;

      // Save to state
      setToken(jwtToken);
      setUser(userData);

      // Save to localStorage
      localStorage.setItem('token', jwtToken);
      localStorage.setItem('user', JSON.stringify(userData));

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
    logout,
    isAuthenticated: !!token,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};