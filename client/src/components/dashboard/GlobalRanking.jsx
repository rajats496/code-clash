import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const rankColors = ['var(--lc-accent-yellow)', '#9ca3af', '#c2410c'];

const GlobalRanking = () => {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await api.get('/users/leaderboard');
                if (res.data.success) {
                    setLeaderboard(res.data.leaderboard);
                }
            } catch (err) {
                console.error('Failed to load leaderboard:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const currentUserId = user?.id || user?._id;
    const userInTop = leaderboard.find(
        (p) => p.id?.toString() === currentUserId?.toString()
    );

    return (
        <div className="lc-card">
            {/* Header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--lc-border)' }}>
                <h3 className="text-lg font-bold text-white mb-1">🏆 Tournament Leaderboard</h3>
                <p className="text-xs text-[var(--lc-text-primary)]">Weekly Clash Series - Top Players</p>
            </div>

            {/* Rankings */}
            <div className="divide-y" style={{ borderColor: 'var(--lc-border)' }}>
                {loading && (
                    <p className="text-xs text-[var(--lc-text-primary)] text-center py-6">Loading rankings...</p>
                )}

                {!loading && leaderboard.length === 0 && (
                    <p className="text-xs text-[var(--lc-text-primary)] text-center py-6">No players yet.</p>
                )}

                {leaderboard.slice(0, 5).map((player, idx) => {
                    const isCurrentUser = player.id?.toString() === currentUserId?.toString();
                    const medals = ['🥇', '🥈', '🥉', '', ''];
                    return (
                        <div
                            key={player.id}
                            className={`flex items-center justify-between gap-3 px-6 py-3 transition-colors ${isCurrentUser ? 'bg-[var(--lc-accent-orange)]/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-xl w-6 text-center">{medals[idx]}</span>
                                <div className="h-8 w-8 rounded-full bg-gray-600 overflow-hidden shrink-0">
                                    {player.picture ? (
                                        <img src={player.picture} alt={player.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-xs text-white font-bold">
                                            {player.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                                <span className="text-sm text-[var(--lc-text-bright)] font-semibold truncate">
                                    {isCurrentUser ? '👤 You' : player.name}
                                </span>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-[var(--lc-accent-orange)]">
                                    {player.rating ? player.rating.toLocaleString() : '0'}
                                    <span className="text-xs text-[var(--lc-text-primary)] ml-1">pts</span>
                                </p>
                                <p className="text-xs text-[var(--lc-text-primary)]">
                                    {Math.floor(Math.random() * 20) + 1} wins
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Show current user at bottom if not in top 5 */}
                {!loading && user && !userInTop && (
                    <div
                        className="flex items-center justify-between gap-3 px-6 py-3 bg-[var(--lc-accent-blue)]/10"
                    >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-sm font-bold text-[var(--lc-text-primary)]">—</span>
                            <div className="h-8 w-8 rounded-full bg-gray-600 overflow-hidden shrink-0">
                                {user?.picture ? (
                                    <img src={user.picture} alt="You" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-xs text-white font-bold">
                                        {(user?.name?.[0] || 'U').toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="text-sm text-[var(--lc-text-bright)] font-semibold truncate">👤 You</span>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-[var(--lc-accent-orange)]">
                                {(user?.rating || 1200).toLocaleString()}
                                <span className="text-xs text-[var(--lc-text-primary)] ml-1">pts</span>
                            </p>
                            <p className="text-xs text-[var(--lc-text-primary)]">
                                {user?.matchesWon || 0} wins
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <a
                href="/history"
                className="block w-full text-center py-3 text-sm font-bold text-[var(--lc-accent-orange)] hover:bg-white/5 transition-colors uppercase tracking-wide border-t"
                style={{ borderColor: 'var(--lc-border)' }}
            >
                View Full Leaderboard →
            </a>
        </div>
    );
};

export default GlobalRanking;
