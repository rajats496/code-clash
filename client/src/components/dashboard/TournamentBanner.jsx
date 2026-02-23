const TournamentBanner = () => {
    return (
        <div
            className="lc-card overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #007aff 0%, #00b8a3 100%)',
            }}
        >
            <div className="relative px-8 py-10 flex items-center justify-between">
                {/* Left Content */}
                <div className="z-10">
                    <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-3">
                        🏆 FEATURED TOURNAMENT
                    </span>
                    <h1 className="text-4xl font-bold text-white mb-2">Weekly Clash Series</h1>
                    <p className="text-white/90 text-lg mb-6">
                        Compete with coders worldwide. Join intense 1v1 matches & climb the leaderboard.
                    </p>
                    <div className="flex items-center gap-4 mb-6">
                        <div>
                            <p className="text-xs text-white/70 uppercase tracking-wide">Prize Pool</p>
                            <p className="text-2xl font-bold text-white">$1,000</p>
                        </div>
                        <div>
                            <p className="text-xs text-white/70 uppercase tracking-wide">Players</p>
                            <p className="text-2xl font-bold text-white">2,847</p>
                        </div>
                        <div>
                            <p className="text-xs text-white/70 uppercase tracking-wide">Time Left</p>
                            <p className="text-2xl font-bold text-white">06h 23m</p>
                        </div>
                    </div>
                    <button
                        className="px-8 py-3 bg-white text-[#007aff] font-bold rounded-lg hover:bg-gray-100 transition-all uppercase tracking-wide text-sm"
                    >
                        🚀 Join Tournament Now
                    </button>
                </div>

                {/* Right Icon/Visual */}
                <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
                    <span className="text-9xl block">🏅</span>
                </div>
            </div>
        </div>
    );
};

export default TournamentBanner;
