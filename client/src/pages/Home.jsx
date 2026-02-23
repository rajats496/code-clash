import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import UserProfileCard from '../components/dashboard/UserProfileCard';
import FriendsList from '../components/dashboard/FriendsList';
import TournamentBanner from '../components/dashboard/TournamentBanner';
import UpcomingClashes from '../components/dashboard/UpcomingClashes';
import GlobalRanking from '../components/dashboard/GlobalRanking';
import PrivateRoomCard from '../components/dashboard/PrivateRoomCard';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Check for active match on mount
  useEffect(() => {
    if (isAuthenticated) {
      const activeMatch = localStorage.getItem('currentMatch');
      if (activeMatch) {
        console.log('🎮 Active match found, redirecting to arena...');
        navigate('/arena');
      }
    }
  }, [isAuthenticated, navigate]);

  return (
    <AppShell>
      <main className="max-w-[1200px] mx-auto p-6 pb-14 space-y-6">
        {/* Featured Tournament Banner */}
        <TournamentBanner />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - User Info & Rankings */}
          <div className="space-y-6">
            <UserProfileCard />
            <GlobalRanking />
            <PrivateRoomCard />
          </div>

          {/* Center - Clash Schedule */}
          <div className="lg:col-span-2">
            <UpcomingClashes />
          </div>
        </div>

        {/* Bottom - Friends & Social */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <FriendsList />
          </div>
        </div>
      </main>
    </AppShell>
  );
};

export default Home;