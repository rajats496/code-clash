import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

// Judge0 language IDs → human names
const LANG_NAMES = {
  48: 'C', 49: 'C', 50: 'C (GCC)', 51: 'C#', 52: 'C++',
  54: 'C++ (GCC)', 60: 'Go', 62: 'Java', 63: 'JavaScript',
  71: 'Python 3', 72: 'Ruby', 73: 'Rust', 74: 'TypeScript',
  78: 'Kotlin', 79: 'Obj-C', 80: 'R', 81: 'Scala', 83: 'Swift',
};

const VERDICT_STYLE = {
  Accepted: 'text-emerald-400 bg-emerald-900/30 border-emerald-500/40',
  'Wrong Answer': 'text-red-400    bg-red-900/30    border-red-500/40',
  'Time Limit Exceeded': 'text-yellow-400 bg-yellow-900/30 border-yellow-500/40',
  'Runtime Error': 'text-orange-400 bg-orange-900/30 border-orange-500/40',
  'Compilation Error': 'text-pink-400   bg-pink-900/30   border-pink-500/40',
  'Memory Limit Exceeded': 'text-purple-400 bg-purple-900/30 border-purple-500/40',
  Pending: 'text-slate-400  bg-slate-700/30  border-slate-500/40',
};

const DIFFICULTY_STYLE = {
  easy: 'text-emerald-400 bg-emerald-900/30 border-emerald-500/40',
  medium: 'text-yellow-400  bg-yellow-900/30  border-yellow-500/40',
  hard: 'text-red-400     bg-red-900/30     border-red-500/40',
};

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'problems', label: '📝 Problems' },
  { id: 'submissions', label: '💻 Code' },
  { id: 'performance', label: '📈 Performance' },
];

const fmtTime = (s) => {
  if (s == null || s === 0) return '--';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const fmtClock = (s) => {
  if (!s) return '--:--';
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
const MatchDetailModal = ({ matchId, isOpen, onClose }) => {
  const { token, user } = useAuth();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [expandedSub, setExpandedSub] = useState(null);

  // Fetch on open
  useEffect(() => {
    if (!isOpen || !matchId) return;
    setLoading(true);
    setDetails(null);
    setFetchError(null);
    setTab('overview');
    setExpandedSub(null);

    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/matches/${matchId}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDetails(data);
        else setFetchError(data.message || 'Failed to load details.');
      })
      .catch(() => setFetchError('Network error.'))
      .finally(() => setLoading(false));
  }, [isOpen, matchId, token]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ── Loading ── */
  if (loading || (!details && !fetchError)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="lc-card rounded-2xl border border-[var(--lc-border)] p-10 text-center">
          <div className="w-8 h-8 border-2 border-t-transparent border-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--lc-text-primary)] font-mono">Loading match details…</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (fetchError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="lc-card rounded-2xl border border-red-700/40 p-8 text-center space-y-3 max-w-sm" onClick={(e) => e.stopPropagation()}>
          <p className="text-red-400 text-sm font-mono">{fetchError}</p>
          <button onClick={onClose} className="text-xs text-[var(--lc-text-primary)] underline">Close</button>
        </div>
      </div>
    );
  }

  const { match, submissions } = details;
  const userId = user?.id || user?._id;
  const me = match.players?.find((p) => p.user?._id?.toString() === userId?.toString());
  const opponent = match.players?.find((p) => p.user?._id?.toString() !== userId?.toString());
  const won = match.winner?._id?.toString() === userId?.toString();
  const problems = match.problems?.length ? match.problems : (match.problem ? [match.problem] : []);
  const rounds = match.totalRounds || 1;

  const avatar = (person, colour) =>
    person?.user?.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(person?.user?.name || '?')}&background=${colour}&color=fff`;

  /* ── Main modal ── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[94vh] sm:max-h-[90vh] lc-card rounded-t-2xl sm:rounded-2xl border border-[var(--lc-border)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className={`px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-[var(--lc-border)] ${won ? 'bg-emerald-900/20' : 'bg-red-900/20'
            }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`px-3 py-1 rounded-lg text-sm font-black border flex-shrink-0 ${won
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40'
                  : 'text-red-400 bg-red-500/15 border-red-500/40'
                }`}
            >
              {won ? '✓ YOU WON' : '✗ YOU LOST'}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--lc-text-primary)] font-mono truncate">
                vs {opponent?.user?.name || 'Opponent'} &nbsp;·&nbsp;{' '}
                {new Date(match.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
                {rounds > 1 ? ` · Bo${rounds}` : ' · 1v1'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700/60 text-[var(--lc-text-primary)] transition-all text-lg flex-shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 px-5 pt-2 pb-0 border-b border-[var(--lc-border)] flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 pb-2 pt-1 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${tab === t.id
                  ? 'border-blue-400 text-blue-300'
                  : 'border-transparent text-[var(--lc-text-primary)] hover:text-[var(--lc-text-bright)]'
                }`}
            >
              {t.id === 'submissions' ? `💻 Code (${submissions.length})` : t.label}
            </button>
          ))}
        </div>

        {/* ── Tab body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ════════════ OVERVIEW ════════════ */}
          {tab === 'overview' && (
            <>
              {/* Players score card */}
              <div className="grid grid-cols-3 gap-3 items-center rounded-2xl border border-[var(--lc-border)] bg-[var(--lc-bg)] p-4">
                {/* Me */}
                <div className="text-center">
                  <img
                    src={avatar(me, '1e3a5f')}
                    className="w-14 h-14 rounded-full border-2 border-blue-400/50 mx-auto mb-2 object-cover"
                    alt="me"
                  />
                  <p className="text-xs font-bold text-[var(--lc-text-bright)] truncate">
                    {me?.user?.name?.split(' ')[0] || 'You'}
                  </p>
                  <p className="text-3xl font-black mt-1 text-blue-300">{me?.solvedCount ?? (won ? 1 : 0)}</p>
                  <p className="text-[10px] text-[var(--lc-text-primary)]">solved</p>
                </div>
                {/* VS */}
                <div className="text-center space-y-1">
                  <p className="text-xl font-black text-[var(--lc-text-primary)]">VS</p>
                  <div
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${won
                        ? 'text-emerald-400 border-emerald-500/40 bg-emerald-900/30'
                        : 'text-red-400 border-red-500/40 bg-red-900/30'
                      }`}
                  >
                    {won ? 'WIN' : 'LOSS'}
                  </div>
                  <p className="text-sm font-mono text-[var(--lc-text-primary)]">{fmtClock(match.duration)}</p>
                </div>
                {/* Opponent */}
                <div className="text-center">
                  <img
                    src={avatar(opponent, '3a1e5f')}
                    className="w-14 h-14 rounded-full border-2 border-purple-400/50 mx-auto mb-2 object-cover"
                    alt="opp"
                  />
                  <p className="text-xs font-bold text-[var(--lc-text-bright)] truncate">
                    {opponent?.user?.name?.split(' ')[0] || 'Opponent'}
                  </p>
                  <p className="text-3xl font-black mt-1 text-purple-300">{opponent?.solvedCount ?? (won ? 0 : 1)}</p>
                  <p className="text-[10px] text-[var(--lc-text-primary)]">solved</p>
                </div>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: '📅', label: 'Date', value: new Date(match.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
                  { icon: '⏱', label: 'Duration', value: fmtClock(match.duration) },
                  { icon: '🎮', label: 'Format', value: rounds === 1 ? '1v1' : `Bo${rounds}` },
                  { icon: match.isPrivate ? '🔒' : '🏆', label: 'Type', value: match.isPrivate ? 'Private' : 'Ranked' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] p-3 text-center">
                    <p className="text-xl mb-1">{s.icon}</p>
                    <p className="text-sm font-bold text-[var(--lc-text-bright)]">{s.value}</p>
                    <p className="text-[10px] text-[var(--lc-text-primary)]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Accuracy / wrong sub comparison */}
              <div className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] p-4">
                <p className="text-xs font-bold text-[var(--lc-text-bright)] mb-3">Wrong Submissions</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: me?.user?.name?.split(' ')[0] || 'You', val: me?.wrongSubmissions ?? 0, colour: 'blue' },
                    { label: opponent?.user?.name?.split(' ')[0] || 'Opponent', val: opponent?.wrongSubmissions ?? 0, colour: 'purple' },
                  ].map((p) => (
                    <div key={p.label} className={`rounded-lg border border-${p.colour}-500/20 bg-${p.colour}-900/10 px-3 py-2 flex items-center justify-between`}>
                      <span className="text-xs text-[var(--lc-text-primary)] truncate">{p.label}</span>
                      <span className={`text-sm font-black text-${p.colour}-300`}>{p.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ════════════ PROBLEMS ════════════ */}
          {tab === 'problems' && (
            <div className="space-y-3">
              {problems.length === 0 && (
                <p className="text-center text-sm text-[var(--lc-text-primary)] py-10">No problem data available.</p>
              )}
              {problems.map((prob, i) => {
                if (!prob) return null;
                const myR = me?.roundResults?.[i];
                const oppR = opponent?.roundResults?.[i];
                const diff = prob.difficulty || 'medium';
                return (
                  <div key={prob._id || i} className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] overflow-hidden">
                    {/* Problem header */}
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-xs font-black text-blue-300 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-[var(--lc-text-bright)]">{prob.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY_STYLE[diff]}`}>
                            {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </span>
                        </div>
                        {prob.description && (
                          <p className="text-xs text-[var(--lc-text-primary)] mt-1.5 leading-relaxed line-clamp-3">
                            {prob.description.replace(/<[^>]*>/g, '')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Who solved it */}
                    <div className="grid grid-cols-2 divide-x divide-[var(--lc-border)] border-t border-[var(--lc-border)]">
                      {[
                        { label: me?.user?.name?.split(' ')[0] || 'You', r: myR, colour: 'emerald', border: 'border-emerald-500/40 bg-emerald-900/15' },
                        { label: opponent?.user?.name?.split(' ')[0] || 'Opponent', r: oppR, colour: 'purple', border: 'border-purple-500/40  bg-purple-900/15' },
                      ].map((p) => (
                        <div
                          key={p.label}
                          className={`px-4 py-3 text-center ${p.r?.solved ? p.border : 'bg-slate-800/20'}`}
                        >
                          <p className={`text-xs font-black ${p.r?.solved ? `text-${p.colour}-400` : 'text-slate-500'}`}>
                            {p.r?.solved ? '✓ Solved' : '✗ Unsolved'}
                          </p>
                          {p.r?.solved && p.r?.solveTime != null && (
                            <p className="text-[10px] text-[var(--lc-text-primary)] mt-0.5">{fmtTime(p.r.solveTime)}</p>
                          )}
                          <p className="text-[10px] text-[var(--lc-text-primary)] mt-0.5">{p.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ════════════ SUBMISSIONS ════════════ */}
          {tab === 'submissions' && (
            <div className="space-y-2">
              {submissions.length === 0 && (
                <p className="text-center text-sm text-[var(--lc-text-primary)] py-10">No submissions recorded for this match.</p>
              )}
              {submissions.map((sub, i) => {
                const expanded = expandedSub === (sub._id || i);
                const style = VERDICT_STYLE[sub.verdict] || VERDICT_STYLE.Pending;
                const accepted = sub.verdict === 'Accepted';
                return (
                  <div
                    key={sub._id || i}
                    className={`rounded-xl border bg-[var(--lc-bg)] overflow-hidden transition-all ${accepted ? 'border-emerald-500/35' : 'border-[var(--lc-border)]'
                      }`}
                  >
                    {/* Row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700/20 transition-all select-none"
                      onClick={() => setExpandedSub(expanded ? null : (sub._id || i))}
                    >
                      {/* Verdict */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${style}`}>
                        {sub.verdict || 'Pending'}
                      </span>
                      {/* Problem + lang */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-[var(--lc-text-primary)] bg-slate-700/50 px-2 py-0.5 rounded-full border border-slate-600/40">
                            {LANG_NAMES[sub.language] || `Lang ${sub.language}`}
                          </span>
                          {sub.problem?.title && (
                            <span className="text-xs text-[var(--lc-text-bright)] truncate">{sub.problem.title}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--lc-text-primary)] mt-0.5 font-mono">
                          {new Date(sub.submittedAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                          {sub.executionTime ? ` · ${sub.executionTime}ms` : ''}
                          {sub.memory ? ` · ${sub.memory}KB` : ''}
                        </p>
                      </div>
                      {/* Expand icon */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[var(--lc-text-primary)]">{expanded ? 'Hide' : 'View'} code</span>
                        <svg
                          className={`w-4 h-4 text-[var(--lc-text-primary)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Code viewer */}
                    {expanded && (
                      <div className="border-t border-[var(--lc-border)]">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-700/40">
                          <span className="text-[10px] font-mono text-slate-400">
                            {LANG_NAMES[sub.language] || `Language ${sub.language}`}
                            {sub.problem?.title ? ` · ${sub.problem.title}` : ''}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(sub.code).catch(() => { })}
                            className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                          >
                            📋 Copy
                          </button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-slate-300 bg-slate-900/80 overflow-x-auto leading-relaxed whitespace-pre max-h-80">
                          {sub.code}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ════════════ PERFORMANCE ════════════ */}
          {tab === 'performance' && (
            <div className="space-y-3">
              {/* My stats */}
              <div className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] p-4">
                <h4 className="text-xs font-bold text-[var(--lc-text-bright)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Your Performance
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Rounds Won', value: me?.solvedCount ?? 0 },
                    { label: 'Wrong Sub', value: me?.wrongSubmissions ?? 0 },
                    {
                      label: 'Avg Solve',
                      value: (() => {
                        const solved = me?.roundResults?.filter((r) => r.solved && r.solveTime);
                        if (!solved?.length) return '--';
                        return fmtTime(Math.round(solved.reduce((a, r) => a + r.solveTime, 0) / solved.length));
                      })(),
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-blue-500/20 bg-blue-900/10 p-3 text-center">
                      <p className="text-lg font-black text-blue-300">{s.value}</p>
                      <p className="text-[10px] text-[var(--lc-text-primary)]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Round-by-round table */}
              {rounds > 1 && me?.roundResults?.length > 0 && (
                <div className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--lc-border)] flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--lc-text-bright)]">Round-by-Round</h4>
                    <div className="flex gap-3 text-[10px] text-[var(--lc-text-primary)]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />You</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Opponent</span>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--lc-border)]">
                    {me.roundResults.map((r, i) => {
                      const oppR = opponent?.roundResults?.[i];
                      const prob = problems[i];
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-5 h-5 rounded-md bg-slate-700/60 flex items-center justify-center text-[10px] font-bold text-[var(--lc-text-primary)] flex-shrink-0">
                            {i + 1}
                          </div>
                          <p className="flex-1 text-xs text-[var(--lc-text-bright)] truncate min-w-0">
                            {prob?.title || `Round ${i + 1}`}
                          </p>
                          {/* My result */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${r.solved
                              ? 'text-emerald-400 bg-emerald-900/30 border-emerald-500/40'
                              : 'text-red-400 bg-red-900/30 border-red-500/40'
                            }`}>
                            {r.solved ? `✓ ${fmtTime(r.solveTime)}` : '✗'}
                          </span>
                          {/* Opp result */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${oppR?.solved
                              ? 'text-purple-400 bg-purple-900/30 border-purple-500/40'
                              : 'text-slate-500 bg-slate-800/30 border-slate-600/40'
                            }`}>
                            {oppR?.solved ? `✓ ${fmtTime(oppR.solveTime)}` : '✗'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opponent stats */}
              <div className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] p-4">
                <h4 className="text-xs font-bold text-[var(--lc-text-bright)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                  {opponent?.user?.name?.split(' ')[0] || 'Opponent'}&apos;s Performance
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Rounds Won', value: opponent?.solvedCount ?? 0 },
                    { label: 'Wrong Sub', value: opponent?.wrongSubmissions ?? 0 },
                    {
                      label: 'Avg Solve',
                      value: (() => {
                        const solved = opponent?.roundResults?.filter((r) => r.solved && r.solveTime);
                        if (!solved?.length) return '--';
                        return fmtTime(Math.round(solved.reduce((a, r) => a + r.solveTime, 0) / solved.length));
                      })(),
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-purple-500/20 bg-purple-900/10 p-3 text-center">
                      <p className="text-lg font-black text-purple-300">{s.value}</p>
                      <p className="text-[10px] text-[var(--lc-text-primary)]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;
