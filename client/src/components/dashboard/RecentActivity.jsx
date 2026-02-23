import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const RecentActivity = () => {
    const { isAuthenticated } = useAuth();
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        const fetchRecent = async () => {
            try {
                const res = await api.get('/matches/recent');
                if (res.data.success) {
                    setActivity(res.data.activity);
                }
            } catch (err) {
                console.error('Failed to load recent activity:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, [isAuthenticated]);

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="lc-card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--lc-border)' }}>
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
            </div>

            {/* Activity list */}
            <div className="p-4 space-y-4">
                {loading && (
                    <p className="text-xs text-gray-500 text-center py-4">Loading...</p>
                )}

                {!loading && activity.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">
                        {isAuthenticated ? 'No recent activity. Play a match!' : 'Sign in to see your activity.'}
                    </p>
                )}

                {activity.map((act) => {
                    const isVictory = act.type === 'victory';
                    return (
                        <div key={act.id} className="flex items-center gap-4 text-sm">
                            <div
                                className="p-2 rounded"
                                style={{
                                    backgroundColor: isVictory ? 'rgba(0,184,163,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: isVictory ? 'var(--lc-accent-green)' : '#ef4444',
                                }}
                            >
                                <span className="material-symbols-outlined">
                                    {isVictory ? 'check_circle' : 'cancel'}
                                </span>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <span className="text-white font-medium">
                                        {isVictory ? 'Victory' : 'Defeat'} vs. {act.opponent}
                                    </span>
                                    <span className="text-xs text-gray-500">{formatTimeAgo(act.createdAt)}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Problem: {act.problem} • Time: {formatDuration(act.duration)} •{' '}
                                    <span style={{ color: isVictory ? 'var(--lc-accent-yellow)' : '#f87171' }}>
                                        {act.ratingChange} LP
                                    </span>
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RecentActivity;
