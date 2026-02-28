import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import contestApi from '../services/contestApi';
import { getSocket } from '../services/socket';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LightningIcon, TrophyIcon, UsersIcon, ClockIcon } from '../components/common/Icons';

const ContestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [contest, setContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState('problems');
  const [countdown, setCountdown] = useState('');

  const fetchContest = useCallback(async () => {
    try {
      const res = await contestApi.get(id);
      setContest(res.data.contest);
    } catch (err) {
      console.error('Failed to fetch contest:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await contestApi.leaderboard(id);
      setLeaderboard(res.data.leaderboard || []);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchContest(); }, [fetchContest]);
  useEffect(() => { if (tab === 'leaderboard') fetchLeaderboard(); }, [tab, fetchLeaderboard]);

  // Countdown timer
  useEffect(() => {
    if (!contest || contest.status !== 'scheduled') return;
    const tick = () => {
      const diff = new Date(contest.startTime) - new Date();
      if (diff <= 0) { setCountdown('Starting...'); fetchContest(); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [contest, fetchContest]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;

    socket.emit('contest-join', { contestId: id });

    const handleUpdate = () => { fetchContest(); if (tab === 'leaderboard') fetchLeaderboard(); };
    socket.on('contest-started', handleUpdate);
    socket.on('contest-ended', handleUpdate);
    socket.on('contest-participant-joined', handleUpdate);
    socket.on('contest-leaderboard-update', () => { if (tab === 'leaderboard') fetchLeaderboard(); });

    return () => {
      socket.emit('contest-leave', { contestId: id });
      socket.off('contest-started', handleUpdate);
      socket.off('contest-ended', handleUpdate);
      socket.off('contest-participant-joined', handleUpdate);
      socket.off('contest-leaderboard-update');
    };
  }, [id, tab, fetchContest, fetchLeaderboard]);

  const handleRegister = async () => {
    setRegistering(true);
    try { await contestApi.register(id); fetchContest(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to register'); }
    finally { setRegistering(false); }
  };

  const handleUnregister = async () => {
    if (!window.confirm('Unregister from this contest?')) return;
    try { await contestApi.unregister(id); fetchContest(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to unregister'); }
  };

  const handleStart = async () => {
    if (!window.confirm('Start contest now? All registered users will be able to submit.')) return;
    setStarting(true);
    try { await contestApi.start(id); fetchContest(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to start'); }
    finally { setStarting(false); }
  };

  const handleEnterArena = () => navigate(`/contests/${id}/arena`);

  const formatDate = (d) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const diffColor = { easy: '#22c55e', medium: '#ffc01e', hard: '#f87171' };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping" />
            <div className="w-14 h-14 rounded-full border-2 border-t-transparent border-orange-500 animate-spin" />
          </div>
          <p className="font-mono text-sm tracking-widest uppercase text-slate-500">Loading contest...</p>
        </div>
      </AppShell>
    );
  }

  if (!contest) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-4">
          <div className="text-5xl mb-2">😕</div>
          <p className="text-lg font-bold text-slate-300">Contest not found</p>
          <button onClick={() => navigate('/contests')} className="text-sm text-orange-400 hover:underline font-mono">← Back to contests</button>
        </div>
      </AppShell>
    );
  }

  const isActive = contest.status === 'active';
  const isScheduled = contest.status === 'scheduled';
  const isEnded = contest.status === 'ended';

  const statusGrad = isActive ? 'from-emerald-500/20 to-teal-600/10' : isScheduled ? 'from-blue-500/20 to-cyan-600/10' : 'from-slate-600/20 to-slate-700/10';
  const statusBorder = isActive ? 'border-emerald-500/30' : isScheduled ? 'border-blue-500/30' : 'border-slate-600/30';
  const statusText = isActive ? 'text-emerald-400' : isScheduled ? 'text-blue-400' : 'text-slate-400';

  const tabsConfig = [
    { key: 'problems', label: '💻 Problems', activeGrad: 'from-orange-500 to-red-600' },
    { key: 'leaderboard', label: '🏅 Leaderboard', activeGrad: 'from-emerald-500 to-teal-600' },
    { key: 'rules', label: '📜 Rules', activeGrad: 'from-blue-500 to-cyan-600' },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-4 pb-16">
        <div className="max-w-5xl mx-auto px-5 py-4">

          {/* Back link */}
          <button onClick={() => navigate('/contests')}
            className="text-sm font-mono text-slate-500 hover:text-orange-400 mb-4 transition-colors inline-flex items-center gap-1">
            ← All Contests
          </button>

          {/* Hero Card */}
          <div className={`rounded-2xl p-6 mb-6 bg-gradient-to-r ${statusGrad} border ${statusBorder} backdrop-blur shadow-xl relative overflow-hidden`}>
            {/* Decorative corner glow */}
            {isActive && <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />}
            {isScheduled && <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />}

            <div className="flex items-start justify-between gap-6 relative z-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-2xl font-black text-slate-50">{contest.title}</h1>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusText} border ${statusBorder}`}
                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 align-middle" />}
                    {isActive ? 'LIVE' : isScheduled ? 'UPCOMING' : 'ENDED'}
                  </span>
                </div>

                {contest.description && (
                  <p className="text-sm text-slate-400 mb-4 leading-relaxed">{contest.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">📅 {formatDate(contest.startTime)} — {formatDate(contest.endTime)}</span>
                  <span className="flex items-center gap-1.5">⏱ {contest.duration}min</span>
                  <span className="flex items-center gap-1.5">👥 {contest.participantCount} registered</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900/50 border border-slate-700/50 text-slate-400 uppercase tracking-wider">
                    {contest.scoringType}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50 text-slate-400 tracking-[0.15em]">
                    {contest.code}
                  </span>
                </div>
              </div>

              {/* Right: Countdown / Action */}
              <div className="text-right shrink-0 space-y-3">
                {isScheduled && countdown && (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Starts in</p>
                    <p className="text-xl font-black font-mono text-orange-400">{countdown}</p>
                  </div>
                )}

                {isAuthenticated && !isAdmin && isScheduled && !contest.isRegistered && (
                  <button onClick={handleRegister} disabled={registering}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 active:scale-95 transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}>
                    {registering ? '⏳ Registering...' : '🚀 Register'}
                  </button>
                )}
                {isAuthenticated && isScheduled && contest.isRegistered && (
                  <div className="space-y-2">
                    <div className="px-4 py-2 rounded-xl text-sm font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      ✓ Registered
                    </div>
                    <button onClick={handleUnregister}
                      className="text-xs font-mono text-slate-500 hover:text-red-400 transition-colors">
                      Unregister
                    </button>
                  </div>
                )}
                {isAuthenticated && isActive && contest.isRegistered && (
                  <button onClick={handleEnterArena}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 active:scale-95 transition-all bg-gradient-to-r from-emerald-500 to-teal-600 text-white animate-pulse">
                    ⚡ Enter Arena →
                  </button>
                )}
                {isAdmin && isScheduled && (
                  <button onClick={handleStart} disabled={starting}
                    className="mt-2 px-5 py-2 rounded-xl text-xs font-bold w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-60">
                    {starting ? '⏳ Starting...' : '▶ Start Now'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-800/60 border border-slate-700/40 w-fit">
            {tabsConfig.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.key
                  ? `bg-gradient-to-r ${t.activeGrad} text-white shadow-lg`
                  : 'text-slate-400 hover:text-slate-200'
                  }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Problems Tab ── */}
          {tab === 'problems' && (
            <div className="space-y-2">
              {/* Notice for hidden problems before contest starts */}
              {isScheduled && !contest.isCreator && !isAdmin && contest.problems?.length > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-3">
                  <span className="text-xl">🔒</span>
                  <p className="text-sm text-blue-300">
                    Problem details will be revealed when the contest starts. Only difficulty and point values are shown.
                  </p>
                </div>
              )}
              {contest.problems?.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-slate-400 font-medium">No problems added yet</p>
                </div>
              ) : (
                contest.problems?.map((cp, idx) => {
                  const p = cp.problem;
                  const myProbStatus = contest.myStatus?.find(
                    (s) => s.problem === (p?._id || cp.problem)
                  );
                  const dc = diffColor[p?.difficulty] || '#9ca3af';
                  return (
                    <div key={cp._id || idx}
                      className="flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-lg border bg-slate-800/40 border-slate-700/50 backdrop-blur group">
                      <span className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-slate-50"
                        style={{ background: `linear-gradient(135deg, ${dc}30, ${dc}10)`, border: `1px solid ${dc}50` }}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-50 truncate group-hover:text-orange-300 transition-colors">
                          {p?.title || 'Problem'}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase" style={{ color: dc, backgroundColor: dc + '18', border: `1px solid ${dc}35` }}>
                            {p?.difficulty || 'unknown'}
                          </span>
                          <span className="text-slate-500 font-mono">{cp.points} pts</span>
                        </div>
                      </div>
                      {myProbStatus?.solved && (
                        <span className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-sm">✓</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Leaderboard Tab ── */}
          {tab === 'leaderboard' && (
            <div className="rounded-2xl overflow-hidden border border-slate-700/50 backdrop-blur shadow-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="py-3.5 px-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">#</th>
                    <th className="py-3.5 px-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">User</th>
                    <th className="py-3.5 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Solved</th>
                    <th className="py-3.5 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Penalty</th>
                    <th className="py-3.5 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="text-3xl mb-2">🏅</div>
                        <p className="text-slate-500 text-sm">No submissions yet</p>
                      </td>
                    </tr>
                  ) : leaderboard.map((entry, idx) => {
                    const isMe = entry.userId === user?._id;
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                    return (
                      <tr key={entry.userId || idx}
                        className="transition-colors border-b border-slate-700/30"
                        style={{ backgroundColor: isMe ? 'rgba(255,161,22,0.08)' : idx % 2 === 0 ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.3)' }}>
                        <td className="py-3 px-4 font-black font-mono" style={{ color: idx < 3 ? '#ffa116' : '#64748b' }}>
                          {medal || (idx + 1)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold flex items-center gap-1" style={{ color: isMe ? '#ffa116' : '#f1f5f9' }}>
                            {isMe && <ArrowRightIcon size={14} />} {entry.name || entry.userId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-emerald-400">{entry.solved}</td>
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">{entry.penalty || 0}</td>
                        <td className="py-3 px-4 text-center font-black text-orange-400">{entry.score || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Rules Tab ── */}
          {tab === 'rules' && (
            <div className="rounded-2xl p-6 space-y-5 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-xl">
              <h3 className="text-lg font-black text-slate-50 flex items-center gap-2">📜 Contest Rules</h3>
              <div className="space-y-3">
                {[
                  { icon: <ClockIcon size={20} />, color: 'orange', label: 'Duration', desc: <span>Duration: <strong className="text-slate-200">{contest.duration} minutes</strong>. The contest ends automatically.</span> },
                  { icon: <TrophyIcon size={20} />, color: 'emerald', label: 'Scoring', desc: <span>Scoring: <strong className="text-slate-200">{contest.scoringType?.toUpperCase()}</strong>. {contest.scoringType === 'icpc' ? 'Rank by problems solved, then by total penalty time.' : 'Rank by total points earned.'}</span> },
                  { icon: <span className="font-bold">⚠️</span>, color: 'red', label: 'Penalty', desc: <span>Wrong submissions add <strong className="text-slate-200">{contest.wrongSubmissionPenalty || 20} minutes</strong> penalty.</span> },
                  { icon: <span className="font-bold">💻</span>, color: 'blue', label: 'Languages', desc: <span>Supported languages: <strong className="text-slate-200">Python, JavaScript, Java, C++, C</strong>.</span> },
                  { icon: <UsersIcon size={20} />, color: 'purple', label: 'Capacity', desc: <span>Max participants: <strong className="text-slate-200">{contest.maxParticipants}</strong>.</span> },
                ].map((rule, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border bg-gradient-to-r from-${rule.color}-500/10 to-${rule.color}-600/5 border-${rule.color}-500/20`}
                    style={{ backgroundColor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.2)' }}>
                    <span className="text-lg shrink-0 mt-0.5">{rule.icon}</span>
                    <p className="text-sm text-slate-400 leading-relaxed">{rule.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default ContestDetail;
