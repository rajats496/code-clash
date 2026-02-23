import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MatchProvider } from './context/MatchContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Matchmaking from './pages/Matchmaking';
import Arena from './pages/Arena';
import MatchHistory from './pages/MatchHistory';
import Profile from './pages/Profile';
import PostMatchChat from './pages/PostMatchChat';
import Tournament from './pages/Tournament';
import Leaderboard from './pages/Leaderboard';
import Friends from './pages/Friends';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

/**
 * If the user has an active (non-expired) match in localStorage and is
 * authenticated, redirect them to /arena automatically — regardless of
 * which page they land on after closing/refreshing the tab.
 */
const ActiveMatchRedirect = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (location.pathname === '/arena') return; // already there

    try {
      const stored = localStorage.getItem('currentMatch');
      if (!stored) return;

      const data = JSON.parse(stored);
      const matchAge = data.createdAt ? Date.now() - data.createdAt : 0;
      const MATCH_MAX_AGE = 60 * 60 * 1000; // 1 hour — matches expire after this

      if (matchAge > MATCH_MAX_AGE) {
        localStorage.removeItem('currentMatch');
        sessionStorage.removeItem('currentTimer');
        return;
      }

      // Valid active match — send them back to arena
      navigate('/arena', { replace: true });
    } catch {
      localStorage.removeItem('currentMatch');
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <MatchProvider>
        <Router>
          <ActiveMatchRedirect />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <MatchHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={<Leaderboard />}
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <Friends />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournament"
              element={
                <ProtectedRoute>
                  <Tournament />
                </ProtectedRoute>
              }
            />
            <Route
              path="/matchmaking"
              element={
                <ProtectedRoute>
                  <Matchmaking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/arena"
              element={
                <ProtectedRoute>
                  <Arena />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:roomId"
              element={
                <ProtectedRoute>
                  <PostMatchChat />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </MatchProvider>
    </AuthProvider>
  );
}

export default App;