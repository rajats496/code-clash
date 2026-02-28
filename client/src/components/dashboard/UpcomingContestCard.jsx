import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

/**
 * Formats ms until a date as "Xh Ym" or "Starts in Xd" or "Starting soon".
 */
function useCountdown(startTime) {
  const [now, setNow] = useState(() => Date.now());
  const start = useMemo(() => (startTime ? new Date(startTime).getTime() : 0), [startTime]);

  useEffect(() => {
    if (!start) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);

  if (!start || now >= start) return 'Starting soon';
  const diff = Math.max(0, start - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Real upcoming contest card. No prize pool.
 * Shows title, description, countdown, participants, CTA.
 */
const UpcomingContestCard = ({ contest }) => {
  const countdown = useCountdown(contest.startTime);
  const participantCount = contest.participantCount ?? 0;

  return (
    <div
      className="lc-card overflow-hidden min-h-[200px]"
      style={{
        background: 'linear-gradient(135deg, #007aff 0%, #00b8a3 100%)',
      }}
    >
      <div className="relative px-6 sm:px-8 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="z-10">
          <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-3">
            🏆 FEATURED CONTEST
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
            {contest.title}
          </h1>
          <p className="text-white/90 text-sm sm:text-lg mb-4 max-w-xl line-clamp-2">
            {contest.description || 'Compete with coders worldwide. Join intense matches & climb the leaderboard.'}
          </p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4">
            <div>
              <p className="text-xs text-white/70 uppercase tracking-wide">Players</p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {participantCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/70 uppercase tracking-wide">Time Left</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{countdown}</p>
            </div>
          </div>
          <Link
            to={`/contests/${contest.id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#007aff] font-bold rounded-lg hover:bg-gray-100 transition-all uppercase tracking-wide text-sm"
          >
            🚀 View Contest
          </Link>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
          <span className="text-7xl sm:text-9xl block">🏅</span>
        </div>
      </div>
    </div>
  );
};

export default UpcomingContestCard;
