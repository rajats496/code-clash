import axios from 'axios';

// In production on Render, use relative URLs (proxied through Render to backend)
// In local dev, use the direct backend URL
const IS_LOCAL = import.meta.env.VITE_API_URL?.includes('localhost');
const API_URL = IS_LOCAL ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') : '';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if we are currently trying to log in or register
      const isAuthEndpoint = error.config.url.includes('/auth/login') || error.config.url.includes('/auth/register');

      if (!isAuthEndpoint) {
        // Token expired or invalid for a protected route, safely redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;