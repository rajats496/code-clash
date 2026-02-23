import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const UserProfileCard = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) return;
        const fetchStats = async () => {
            try {
                const res = await api.get('/users/stats');
                if (res.data.success) {
                    setStats(res.data.stats);
                }
            } catch (err) {
                console.error('Failed to load user stats:', err);
            }
        };
        fetchStats();
    }, [isAuthenticated]);

    const username = stats?.name || user?.name || 'Guest';
    const rating = stats?.rating || user?.rating || 1200;
    const played = stats?.matchesPlayed || user?.matchesPlayed || 0;
    const won = stats?.matchesWon || user?.matchesWon || 0;
    const losses = stats?.losses || 0;
    const winRate = stats?.winRate || 0;
    const progressPercent = played > 0 ? Math.min(((played / 100) * 100), 100).toFixed(0) : 0;

    return (
        <div className="lc-card p-4">
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-lg overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--lc-border)' }}>
                    {(stats?.picture || user?.picture) ? (
                        <img src={stats?.picture || user?.picture} alt={username} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full bg-gray-600 flex items-center justify-center text-xl text-white font-bold">
                            {username[0]?.toUpperCase() || 'G'}
                        </div>
                    )}
                </div>
                <div>
                    <h2 className="text-white font-bold text-lg">{username}</h2>
                    <p className="text-xs font-medium" style={{ color: 'var(--lc-accent-yellow)' }}>
                        Rating {rating}
                    </p>
                </div>
            </div>

            {/* Match stats */}
            <div className="space-y-3">
                <div className="flex justify-between text-xs">
                    <span>Matches Played</span>
                    <span className="text-white font-medium">{played}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#3e3e3e' }}>
                    <div
                        className="h-full transition-all duration-500"
                        style={{ backgroundColor: 'var(--lc-accent-green)', width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span style={{ color: 'var(--lc-accent-green)' }}>Won {won}</span>
                    <span className="text-red-500">Lost {losses}</span>
                    <span style={{ color: 'var(--lc-accent-yellow)' }}>Win Rate {winRate}%</span>
                </div>
            </div>

            {/* Quick actions */}
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--lc-border)' }}>
                <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider text-gray-500">Quick Actions</h3>
                <div className="space-y-2">
                    <button
                        onClick={() => navigate(isAuthenticated ? '/matchmaking' : '/login')}
                        className="w-full lc-btn-primary py-2.5 rounded flex items-center justify-center gap-2 text-sm"
                        style={{ boxShadow: '0 10px 15px -3px rgba(255, 161, 22, 0.1)' }}
                    >
                        <span className="material-symbols-outlined text-lg">bolt</span>
                        Quick Match
                    </button>
                    <button
                        onClick={() => navigate(isAuthenticated ? '/matchmaking' : '/login', { state: { tab: 'private' } })}
                        className="w-full bg-[#3e3e3e] hover:bg-[#4e4e4e] text-white py-2.5 rounded text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">lock</span>
                        Create Private Room
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserProfileCard;
