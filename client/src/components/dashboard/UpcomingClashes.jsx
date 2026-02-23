const clashes = [
    { name: '⚡ Binary Search Blitz', startsIn: '14m 20s', players: '421 / 1000', hot: true, level: 'Advanced' },
    { name: '🔥 Dynamic Programming Duel', startsIn: '48m 10s', players: '189 / 250', hot: true, level: 'Intermediate' },
    { name: '📊 Graph Theory Gauntlet', startsIn: '02h 15m', players: '42 / 100', hot: false, level: 'Expert' },
    { name: '🎯 Quick Clash Challenge', startsIn: '03h 45m', players: '856 / 999', hot: true, level: 'Beginner' },
];

const UpcomingClashes = () => {
    return (
        <div className="lc-card">
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--lc-border)' }}>
                <div>
                    <h3 className="text-lg font-bold text-white">🎮 Upcoming Clashes</h3>
                    <p className="text-xs text-[var(--lc-text-primary)] mt-1">Join a clash match and showcase your coding skills</p>
                </div>
                <a href="/matchmaking" className="text-sm font-bold hover:underline px-4 py-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--lc-accent-orange)' }}>
                    View All →
                </a>
            </div>

            {/* Clashes List */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-white/5 text-[var(--lc-text-primary)]">
                            <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Clash Name</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Level</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Starts In</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Participants</th>
                            <th className="px-6 py-3 text-right font-bold uppercase tracking-wider text-xs">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--lc-border)' }}>
                        {clashes.map((clash) => (
                            <tr key={clash.name} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-[var(--lc-text-bright)] font-semibold">{clash.name}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-white/10 text-[var(--lc-text-primary)]">
                                        {clash.level}
                                    </span>
                                </td>
                                <td 
                                    className="px-6 py-4 font-mono text-sm"
                                    style={{ color: clash.hot ? 'var(--lc-accent-yellow)' : 'var(--lc-text-primary)' }}
                                >
                                    {clash.hot && '🔴 '}{clash.startsIn}
                                </td>
                                <td className="px-6 py-4 text-[var(--lc-text-primary)] font-mono">
                                    <progress value={clash.players.split('/')[0]} max={clash.players.split('/')[1]} className="w-20 h-2" />
                                    <span className="ml-2 text-xs">{clash.players}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="px-4 py-1.5 font-bold rounded-lg lc-btn-primary text-xs uppercase tracking-wide hover:opacity-90 transition-opacity">
                                        Join Clash
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer CTA */}
            <div className="px-6 py-4 bg-white/5 border-t text-center" style={{ borderColor: 'var(--lc-border)' }}>
                <p className="text-xs text-[var(--lc-text-primary)] mb-2">Ready to test your skills?</p>
                <a href="/matchmaking" className="inline-block px-6 py-2 bg-[var(--lc-accent-orange)] text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
                    🚀 Start a Clash Now
                </a>
            </div>
        </div>
    );
};

export default UpcomingClashes;
