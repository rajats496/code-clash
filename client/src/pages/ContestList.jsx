import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import contestApi from '../services/contestApi';
import { TrophyIcon } from '../components/common/Icons';

const statusConfig = {
  scheduled: { gradient: 'from-blue-500/15 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Upcoming', icon: '📅' },
  active: { gradient: 'from-emerald-500/15 to-emerald-600/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Live', icon: '🔴' },
  ended: { gradient: 'from-slate-500/15 to-slate-600/10', border: 'border-slate-600/30', text: 'text-slate-400', label: 'Ended', icon: '🏁' },
};

const ContestList = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => { fetchContests(); }, [tab]);

  const fetchContests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tab === 'upcoming') params.status = 'scheduled';
      else if (tab === 'active') params.status = 'active';
      else if (tab === 'ended') params.status = 'ended';
      else if (tab === 'all') params.status = 'all';
      const res = await contestApi.list(params);
      setContests(res.data.contests || []);
    } catch (err) {
      console.error('Failed to fetch contests:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const formatDuration = (mins) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getTimeLeft = (startTime) => {
    const diff = new Date(startTime) - new Date();
    if (diff <= 0) return 'Started';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const tabs = [
    { key: 'upcoming', label: '📅 Upcoming', activeGrad: 'from-blue-500 to-cyan-600' },
    { key: 'active', label: '🔴 Live Now', activeGrad: 'from-emerald-500 to-teal-600' },
    { key: 'ended', label: '🏁 Past', activeGrad: 'from-slate-500 to-slate-600' },
    { key: 'all', label: '📋 All', activeGrad: 'from-purple-500 to-blue-600' },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-4 pb-16">
        <div className="max-w-5xl mx-auto px-5 py-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black mb-2 flex items-center gap-3 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                <TrophyIcon size={32} className="text-[#ffa116]" /> Contests
              </h1>
              <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                Compete with others in timed coding challenges. Solve problems, climb the leaderboard, and earn your rank.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/contests/create')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}
              >
                <span className="text-lg">+</span> Create Contest
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-800/60 border border-slate-700/40 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.key
                  ? `bg-gradient-to-r ${t.activeGrad} text-white shadow-lg`
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping" />
                <div className="w-12 h-12 rounded-full border-2 border-t-transparent border-orange-500 animate-spin" />
              </div>
              <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">Loading contests...</p>
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-20 rounded-2xl bg-slate-800/30 border border-slate-700/50 backdrop-blur">
              <div className="flex justify-center mb-4 text-[#ffa116] opacity-80"><TrophyIcon size={64} /></div>
              <p className="text-lg font-bold text-slate-300 mb-2">
                No {tab === 'all' ? '' : tab} contests found
              </p>
              <p className="text-sm text-slate-500 mb-6">Be the first to create a challenge!</p>
              {isAdmin && (
                <button
                  onClick={() => navigate('/contests/create')}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/30"
                  style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}
                >
                  Create the first one!
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {contests.map((c) => {
                const st = statusConfig[c.status] || statusConfig.scheduled;
                return (
                  <Link
                    key={c._id}
                    to={`/contests/${c._id}`}
                    className={`block rounded-xl p-5 transition-all hover:scale-[1.005] hover:shadow-xl border bg-gradient-to-r ${st.gradient} ${st.border} backdrop-blur`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-black text-slate-50 truncate">
                            {c.title}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${st.text} border ${st.border}`}
                            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                            {c.status === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 align-middle" />}
                            {st.label}
                          </span>
                        </div>

                        {c.description && (
                          <p className="text-sm text-slate-400 mb-3 line-clamp-1">{c.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <span className="text-slate-600">📅</span>
                            {formatDate(c.startTime)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-slate-600">⏱</span>
                            {formatDuration(c.duration)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-slate-600">💻</span>
                            {c.problems?.length || 0} problems
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-slate-600">👥</span>
                            {c.participantCount || 0} registered
                          </span>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="text-right shrink-0">
                        {c.status === 'scheduled' && (
                          <div>
                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Starts in</p>
                            <p className="text-xl font-black text-orange-400">{getTimeLeft(c.startTime)}</p>
                          </div>
                        )}
                        {c.status === 'active' && (
                          <div className="px-3 py-1.5 rounded-lg text-xs font-black animate-pulse bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            ● LIVE
                          </div>
                        )}
                        <div className="text-[10px] mt-2 font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50 text-slate-500 tracking-wider">
                          {c.code}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default ContestList;
