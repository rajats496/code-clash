import { Link } from 'react-router-dom';

/** Placeholder when no upcoming contest. No prize pool. */
const DummyContestCard = () => (
  <div
    className="lc-card overflow-hidden min-h-[200px] flex flex-col justify-center"
    style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      border: '1px solid var(--lc-border)',
    }}
  >
    <div className="relative px-6 sm:px-8 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
      <div className="z-10">
        <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-slate-400 text-xs font-bold mb-3">
          📅 No Upcoming Contest
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Check Back Soon</h2>
        <p className="text-slate-400 text-sm sm:text-base mb-4 max-w-lg">
          New contests are added regularly. Browse existing contests or join a 1v1 clash while you wait.
        </p>
        <Link
          to="/contests"
          className="inline-block px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors text-sm border border-white/20"
        >
          Browse Contests →
        </Link>
      </div>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
        <span className="text-7xl block">📋</span>
      </div>
    </div>
  </div>
);

export default DummyContestCard;
