import { useState, useEffect } from 'react';
import api from '../../services/api';

const DailyChallenge = () => {
    const [challenge, setChallenge] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDaily = async () => {
            try {
                const res = await api.get('/problems/daily');
                if (res.data.success && res.data.problem) {
                    setChallenge(res.data.problem);
                }
            } catch (err) {
                console.error('Failed to load daily challenge:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDaily();
    }, []);

    const difficultyColors = {
        easy: { bg: 'rgba(0,184,163,0.2)', text: 'var(--lc-accent-green)' },
        medium: { bg: 'rgba(255,192,30,0.2)', text: 'var(--lc-accent-yellow)' },
        hard: { bg: 'rgba(239,68,68,0.2)', text: '#ef4444' },
    };

    const diff = challenge?.difficulty || 'medium';
    const colors = difficultyColors[diff] || difficultyColors.medium;

    return (
        <div className="lc-card p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Daily Challenge</h3>

            {loading && (
                <p className="text-xs text-gray-500 text-center py-4">Loading...</p>
            )}

            {!loading && !challenge && (
                <p className="text-xs text-gray-500 text-center py-4">No challenge available today.</p>
            )}

            {!loading && challenge && (
                <>
                    <div className="p-3 rounded border" style={{ backgroundColor: '#1a1a1a', borderColor: 'var(--lc-border)' }}>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--lc-accent-orange)' }}>
                            {challenge.date}
                        </p>
                        <p className="text-sm text-white font-bold mb-3">{challenge.title}</p>
                        <div className="flex items-center gap-2">
                            <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                                {diff}
                            </span>
                            <span className="text-[10px] text-gray-500">
                                Solved by {challenge.solvedCount?.toLocaleString() || 0}
                            </span>
                        </div>
                    </div>

                    <button
                        className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white py-2 rounded text-xs font-medium transition-all"
                        onClick={() => window.location.href = '/matchmaking'}
                    >
                        Solve Now
                    </button>
                </>
            )}
        </div>
    );
};

export default DailyChallenge;
