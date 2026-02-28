import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';
import TournamentBanner from '../components/dashboard/TournamentBanner';
import UpcomingClashes from '../components/dashboard/UpcomingClashes';
import { LightningIcon, TrophyIcon, FlameIcon, TargetIcon } from '../components/common/Icons';

const Tournament = () => {
  const { isAuthenticated } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(false);
        // For now, we'll use mock data. Replace with API call when ready
        setTournaments([]);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto p-6 space-y-8">
          {/* Featured Tournament Banner */}
          <TournamentBanner />

          {/* Upcoming Tournaments Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <LightningIcon className="text-[#ffa116]" size={32} /> Ongoing Tournaments
              </h2>
              <p className="text-gray-400">Join live tournaments and compete with players worldwide</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tournament Card 1 */}
              <div className="lc-card p-6 hover:border-accent-orange/50 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Spring Code Championship</h3>
                    <p className="text-xs text-gray-400">Tier: Professional</p>
                  </div>
                  <TrophyIcon size={24} className="text-[#ffa116]" />
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Players</span>
                    <span className="font-bold">1,234</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ends in</span>
                    <span className="font-bold text-yellow-400">2d 5h</span>
                  </div>
                </div>
                <button className="lc-btn-primary w-full text-sm py-2">
                  View Details
                </button>
              </div>

              {/* Tournament Card 2 */}
              <div className="lc-card p-6 hover:border-accent-orange/50 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Weekly Speed Challenge</h3>
                    <p className="text-xs text-gray-400">Tier: Intermediate</p>
                  </div>
                  <LightningIcon size={24} className="text-[#ffa116]" />
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Players</span>
                    <span className="font-bold">567</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ends in</span>
                    <span className="font-bold text-yellow-400">5h 30m</span>
                  </div>
                </div>
                <button className="lc-btn-primary w-full text-sm py-2">
                  View Details
                </button>
              </div>

              {/* Tournament Card 3 */}
              <div className="lc-card p-6 hover:border-accent-orange/50 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Beginner's Marathon</h3>
                    <p className="text-xs text-gray-400">Tier: Beginner</p>
                  </div>
                  <TargetIcon size={24} className="text-[#ffa116]" />
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Players</span>
                    <span className="font-bold">892</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ends in</span>
                    <span className="font-bold text-yellow-400">1d 12h</span>
                  </div>
                </div>
                <button className="lc-btn-primary w-full text-sm py-2">
                  View Details
                </button>
              </div>
            </div>
          </div>

          {/* Available Clashes Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <FlameIcon className="text-[#ffa116]" size={32} /> Available Clashes
              </h2>
              <p className="text-gray-400">Quick 1-on-1 competitive matches</p>
            </div>
            <UpcomingClashes />
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Tournament;
