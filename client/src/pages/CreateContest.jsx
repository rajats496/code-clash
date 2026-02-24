import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import contestApi from '../services/contestApi';
import { useAuth } from '../context/AuthContext';

const CreateContest = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    duration: 90,
    scoringType: 'icpc',
    isPublic: true,
    maxParticipants: 1000,
    wrongSubmissionPenalty: 20,
    startTime: '',
    selectedProblems: [],
  });

  useEffect(() => {
    if (!isAdmin) {
      navigate('/contests', { replace: true });
      return;
    }

    const fetchProblems = async () => {
      try {
        const res = await contestApi.getProblems();
        setProblems(res.data.problems || res.data || []);
      } catch (err) {
        console.error('Failed to fetch problems:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProblems();

    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm((f) => ({ ...f, startTime: local }));
  }, [isAdmin, navigate]);

  const toggleProblem = (id) => {
    setForm((f) => {
      const sel = f.selectedProblems;
      if (sel.includes(id)) return { ...f, selectedProblems: sel.filter((p) => p !== id) };
      if (sel.length >= 10) return f;
      return { ...f, selectedProblems: [...sel, id] };
    });
  };

  const moveProblem = (idx, dir) => {
    setForm((f) => {
      const arr = [...f.selectedProblems];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return f;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...f, selectedProblems: arr };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (form.selectedProblems.length === 0) { setError('Select at least one problem'); return; }
    if (!form.startTime) { setError('Start time is required'); return; }

    setCreating(true);
    try {
      const res = await contestApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        problemIds: form.selectedProblems,
        startTime: new Date(form.startTime).toISOString(),
        duration: parseInt(form.duration),
        scoringType: form.scoringType,
        isPublic: form.isPublic,
        maxParticipants: parseInt(form.maxParticipants),
        wrongSubmissionPenalty: parseInt(form.wrongSubmissionPenalty),
      });
      navigate(`/contests/${res.data.contest.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create contest');
    } finally {
      setCreating(false);
    }
  };

  const diffColor = { easy: '#22c55e', medium: '#ffc01e', hard: '#f87171' };

  const inputClasses = "w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all font-mono";
  const labelClasses = "block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-4 pb-16">
        <div className="max-w-4xl mx-auto px-5 py-4">

          {/* Back link */}
          <button onClick={() => navigate('/contests')}
            className="text-sm font-mono text-slate-500 hover:text-orange-400 mb-4 transition-colors inline-flex items-center gap-1">
            ← Back to Contests
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              ✨ Create Contest
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Set up a timed coding challenge for up to 10,000 participants.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl text-sm font-bold flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 backdrop-blur">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Title & Description */}
            <div className="rounded-2xl p-6 space-y-4 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-lg">📝</div>
                <div>
                  <h2 className="text-base font-bold text-slate-50">Basic Info</h2>
                  <p className="text-xs text-slate-500">Give your contest a name and description</p>
                </div>
              </div>
              <div>
                <label className={labelClasses}>Contest Title *</label>
                <input type="text" className={inputClasses} placeholder="Weekly Contest #1"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={labelClasses}>Description</label>
                <textarea className={inputClasses} style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Optional description..."
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-2xl p-6 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-lg">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-lg">⚙️</div>
                <div>
                  <h2 className="text-base font-bold text-slate-50">Settings</h2>
                  <p className="text-xs text-slate-500">Configure timing, scoring, and capacity</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Start Time *</label>
                  <input type="datetime-local" className={inputClasses}
                    value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClasses}>Duration</label>
                  <select className={inputClasses} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                    {[30, 60, 90, 120, 150, 180, 240, 300].map((m) => (
                      <option key={m} value={m}>{m}min ({m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Scoring Type</label>
                  <select className={inputClasses} value={form.scoringType} onChange={(e) => setForm({ ...form, scoringType: e.target.value })}>
                    <option value="icpc">ICPC (solved + penalty)</option>
                    <option value="leetcode">LeetCode (points)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Wrong Penalty (min)</label>
                  <input type="number" className={inputClasses} min={0} max={60}
                    value={form.wrongSubmissionPenalty} onChange={(e) => setForm({ ...form, wrongSubmissionPenalty: e.target.value })} />
                </div>
                <div>
                  <label className={labelClasses}>Max Participants</label>
                  <input type="number" className={inputClasses} min={2} max={10000}
                    value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 self-end pb-2">
                  <input type="checkbox" id="isPublic" checked={form.isPublic}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-orange-500"
                    onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
                  <label htmlFor="isPublic" className="text-sm font-bold text-slate-300">
                    Public Contest
                  </label>
                </div>
              </div>
            </div>

            {/* Problem Selection */}
            <div className="rounded-2xl p-6 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-lg">
              <div className="flex items-center justify-between mb-5 border-b pb-4" style={{ borderColor: 'var(--lc-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-lg">💻</div>
                  <div>
                    <h2 className="text-base font-bold text-slate-50">Select Problems</h2>
                    <p className="text-xs text-slate-500">Choose and order up to 10 problems</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => navigate('/admin/problems/new')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:bg-opacity-80"
                    style={{ backgroundColor: 'rgba(0,184,163,0.1)', border: '1px solid rgba(0,184,163,0.2)', color: '#00b8a3' }}>
                    + NEW PROBLEM
                  </button>
                  <span className="px-3 py-1 rounded-lg text-xs font-black font-mono bg-slate-900/60 border border-slate-700/50"
                    style={{ color: form.selectedProblems.length > 0 ? '#ffa116' : '#64748b' }}>
                    {form.selectedProblems.length}/10
                  </span>
                </div>
              </div>

              {/* Selected problems (ordered) */}
              {form.selectedProblems.length > 0 && (
                <div className="mb-5 space-y-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Selected (drag to reorder)</p>
                  {form.selectedProblems.map((pid, idx) => {
                    const p = problems.find((pr) => pr.id === pid);
                    const dc = diffColor[p?.difficulty] || '#9ca3af';
                    return (
                      <div key={pid} className="flex items-center gap-2 p-3 rounded-xl text-sm bg-slate-900/60 border border-orange-500/20 shadow-sm">
                        <span className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black"
                          style={{ background: `linear-gradient(135deg, ${dc}30, ${dc}10)`, border: `1px solid ${dc}50`, color: dc }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 truncate font-bold text-slate-200">{p?.title || pid}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ color: dc, backgroundColor: dc + '18', border: `1px solid ${dc}35` }}>
                          {p?.difficulty}
                        </span>
                        <button type="button" onClick={() => moveProblem(idx, -1)} disabled={idx === 0}
                          className="px-1.5 py-0.5 rounded text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-30">▲</button>
                        <button type="button" onClick={() => moveProblem(idx, 1)} disabled={idx === form.selectedProblems.length - 1}
                          className="px-1.5 py-0.5 rounded text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-30">▼</button>
                        <button type="button" onClick={() => toggleProblem(pid)}
                          className="px-1.5 py-0.5 rounded text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Available problems */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping" />
                    <div className="w-10 h-10 rounded-full border-2 border-t-transparent border-orange-500 animate-spin" />
                  </div>
                  <p className="text-xs font-mono text-slate-500">Loading problems...</p>
                </div>
              ) : problems.length === 0 ? (
                <div className="text-center py-10 rounded-xl bg-slate-900/40 border border-slate-700/30">
                  <div className="text-3xl mb-2">📝</div>
                  <p className="text-sm text-slate-400 font-medium">No problems in database.</p>
                  <p className="text-xs text-slate-600 mt-1 font-mono">Run the seed script first.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                  {problems.filter((p) => !form.selectedProblems.includes(p.id)).map((p) => {
                    const dc = diffColor[p.difficulty] || '#9ca3af';
                    return (
                      <button key={p.id} type="button" onClick={() => toggleProblem(p.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-all border bg-slate-900/30 border-slate-700/40 hover:border-orange-500/30 hover:bg-slate-800/50 group">
                        <span className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 group-hover:text-emerald-400 transition-colors text-lg font-bold border border-slate-700/50 group-hover:border-emerald-500/30">+</span>
                        <span className="flex-1 truncate text-slate-300 group-hover:text-slate-100 font-medium transition-colors">{p.title}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ color: dc, backgroundColor: dc + '18', border: `1px solid ${dc}35` }}>
                          {p.difficulty}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={creating}
              className="w-full py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}>
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span className="text-lg group-hover:scale-110 transition-transform">🚀</span>
                {creating ? 'Creating Contest...' : 'Create Contest'}
              </span>
              <span className="absolute inset-0 -z-10 bg-gradient-to-r from-orange-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
};

export default CreateContest;
