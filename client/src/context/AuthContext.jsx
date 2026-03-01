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

      const base = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') : '';
      const response = await fetch(`${base}/api/auth/me`, {
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
   * Register with email + password. Sends OTP; does not log in until OTP verified.
   */
  const registerWithEmail = async ({ name, email, password, role }) => {
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const { success, message, email: registeredEmail } = response.data;
      return { success: !!success, message, email: registeredEmail };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  /**
   * Verify signup OTP; on success returns token + user and logs in
   */
  const verifySignupOtp = async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      const { token: jwtToken, user: userData } = response.data;
      saveAuth(jwtToken, userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Invalid or expired code',
      };
    }
  };

  /**
   * Resend signup verification OTP
   */
  const resendSignupOtp = async (email) => {
    try {
      await api.post('/auth/resend-otp', { email });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to resend code',
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
   * Request password reset email (forgot password)
   */
  const requestPasswordReset = async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return { success: true, message: response.data?.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send reset link',
      };
    }
  };

  /**
   * Reset password with token from email link
   */
  const resetPassword = async (token, newPassword, confirmPassword) => {
    try {
      await api.post('/auth/reset-password', { token, newPassword, confirmPassword });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to reset password',
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
    verifySignupOtp,
    resendSignupOtp,
    requestPasswordReset,
    resetPassword,
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