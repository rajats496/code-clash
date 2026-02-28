import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import contestApi from '../services/contestApi';
import { getSocket } from '../services/socket';
import Editor from '@monaco-editor/react';
import { CheckIcon, CrossIcon, ClockIcon, FlameIcon, SparklesIcon, TrophyIcon, ArrowLeftIcon } from '../components/common/Icons';

// Strip question link line (e.g. 🔗 https://codeforces.com/...) from description
const descriptionWithoutLink = (desc) => {
  if (!desc || typeof desc !== 'string') return desc || '';
  return desc
    .split('\n')
    .filter((line) => !/^\s*🔗?\s*https?:\/\/\S*\s*$/m.test(line.trim()))
    .join('\n')
    .trim();
};

// ── Verdict colour helper (matches Arena.jsx) ─────────────────────────────────
const vStyle = (v) => {
  if (v === 'Accepted') return { color: '#00b8a3', bg: 'rgba(0,184,163,0.08)', border: 'rgba(0,184,163,0.35)', icon: <CheckIcon size={16} /> };
  if (v === 'processing' || v === 'queued') return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.35)', icon: <span className="animate-pulse">…</span> };
  if (v === 'Compilation Error') return { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.35)', icon: <SparklesIcon size={16} /> };
  if (v === 'Time Limit Exceeded') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', icon: <ClockIcon size={16} /> };
  if (v === 'Runtime Error') return { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.35)', icon: <FlameIcon size={16} /> };
  if (v === 'Wrong Answer') return { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.35)', icon: <CrossIcon size={16} /> };
  return { color: '#9ca3af', bg: 'transparent', border: 'var(--lc-border)', icon: '?' };
};

const LANGS = [
  { id: 71, short: 'Python 3', label: 'Python', mono: 'python' },
  { id: 63, short: 'JavaScript', label: 'JavaScript', mono: 'javascript' },
  { id: 62, short: 'Java', label: 'Java', mono: 'java' },
  { id: 54, short: 'C++', label: 'C++', mono: 'cpp' },
  { id: 50, short: 'C', label: 'C', mono: 'c' },
  { id: 998, short: 'Fortran', label: 'Fortran', mono: 'plaintext' },
  { id: 999, short: 'D', label: 'D', mono: 'plaintext' },
];

// ── Resizable Editor + Result Panel (matches Arena.jsx) ──
const ResizablePanels = ({ result, submitting, language, code, setCode, onSubmit }) => {
  const containerRef = useRef(null);
  const [editorHeight, setEditorHeight] = useState(100);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startEditorHeight = useRef(100);

  const hasResult = result || submitting;

  useEffect(() => {
    if (!hasResult) { setEditorHeight(100); return; }
    if (submitting && !result) { setEditorHeight(65); return; }
    setEditorHeight(38);
  }, [hasResult, result, submitting]);

  const onMouseDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startEditorHeight.current = editorHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerH = containerRef.current.getBoundingClientRect().height;
      const delta = e.clientY - startY.current;
      const deltaPercent = (delta / containerH) * 100;
      const newHeight = Math.min(85, Math.max(15, startEditorHeight.current + deltaPercent));
      setEditorHeight(newHeight);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const monacoLang =
    language === 71 ? 'python' :
      language === 63 ? 'javascript' :
        language === 50 ? 'c' :
          language === 54 ? 'cpp' :
            (language === 998 || language === 999) ? 'plaintext' : 'java';

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Editor */}
      <div style={{ height: hasResult ? `${editorHeight}%` : '100%', transition: isDragging.current ? 'none' : 'height 0.2s ease' }}
        className="overflow-hidden min-h-0">
        <Editor
          height="100%"
          language={monacoLang}
          value={code}
          theme="vs-dark"
          onMount={(editor, monaco) => {
            // Ctrl+Enter — Submit code
            editor.addAction({
              id: 'submit-code',
              label: 'Submit Code',
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
              run: () => onSubmit?.(),
            });
            // Ctrl+S — Prevent browser save dialog
            editor.addAction({
              id: 'save-code',
              label: 'Save Code',
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
              run: () => { /* code saves on every keystroke via onChange */ },
            });
          }}
          onChange={(newCode) => setCode(newCode || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
          }}
        />
      </div>

      {/* Drag handle */}
      {hasResult && (
        <div
          onMouseDown={onMouseDown}
          className="shrink-0 flex items-center justify-center cursor-row-resize group"
          style={{ height: '10px', backgroundColor: 'var(--lc-bg)', borderTop: '1px solid var(--lc-border)', borderBottom: '1px solid var(--lc-border)' }}
        >
          <div className="flex gap-1 items-center">
            <div className="w-6 h-[2px] rounded-full bg-[var(--lc-border)] group-hover:bg-[#ffa116] transition-colors" />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--lc-border)] group-hover:bg-[#ffa116] transition-colors" />
            <div className="w-6 h-[2px] rounded-full bg-[var(--lc-border)] group-hover:bg-[#ffa116] transition-colors" />
          </div>
        </div>
      )}

      {/* Result panel */}
      {hasResult && (() => {
        const v = result?.verdict || (submitting ? 'processing' : null);
        if (!v) return null;
        const vs = vStyle(v);
        const isCE = v === 'Compilation Error';
        const isLoading = v === 'processing' || v === 'queued';

        return (
          <div
            style={{ height: `${100 - editorHeight}%`, transition: isDragging.current ? 'none' : 'height 0.25s ease', backgroundColor: 'var(--lc-card)', borderTop: `2px solid ${vs.border}` }}
            className="flex flex-col overflow-hidden"
          >
            {/* Verdict header */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ backgroundColor: vs.bg, borderBottom: `1px solid ${vs.border}` }}>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
                  style={{ backgroundColor: vs.bg, border: `1px solid ${vs.border}`, color: vs.color }}>
                  {vs.icon}
                </span>
                <div>
                  <p className="font-black text-sm font-mono uppercase tracking-widest" style={{ color: vs.color }}>{v}</p>
                  {result?.message && <p className="text-[11px] text-gray-500 font-mono mt-0.5">{result.message}</p>}
                </div>
              </div>
              {v === 'Accepted' && result?.runtime && (
                <div className="flex items-center gap-2.5">
                  <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
                    <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Runtime</p>
                    <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>{result.runtime}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Compiler output */}
            {isCE && result?.compilationError && (
              <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
                <p className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest mb-2">Compiler Output</p>
                <pre className="text-xs font-mono text-red-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {result.compilationError}
                </pre>
              </div>
            )}

            {/* Loading spinner */}
            {isLoading && !result?.testResults && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-[#ffa116]/20 animate-ping" />
                    <div className="w-10 h-10 rounded-full border-2 border-t-transparent border-[#ffa116] animate-spin" />
                  </div>
                  <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Running...</p>
                </div>
              </div>
            )}

            {/* Test results */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {result?.testResults ? (
                result.testResults.map((test, index) => (
                  <div key={index} className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${test.passed ? 'rgba(0,184,163,0.25)' : 'rgba(248,113,113,0.25)'}`, backgroundColor: test.passed ? 'rgba(0,184,163,0.04)' : 'rgba(248,113,113,0.04)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderBottom: test.passed ? '1px solid rgba(0,184,163,0.15)' : '1px solid rgba(248,113,113,0.15)' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black"
                          style={{ backgroundColor: test.passed ? 'rgba(0,184,163,0.15)' : 'rgba(248,113,113,0.15)', color: test.passed ? '#00b8a3' : '#f87171' }}>
                          {test.passed ? <CheckIcon size={12} /> : <CrossIcon size={12} />}
                        </span>
                        <span className="text-xs font-mono font-bold" style={{ color: test.passed ? '#00b8a3' : '#f87171' }}>Test {test.testCase}</span>
                        {test.time && <span className="text-[10px] font-mono text-gray-500">{test.time}</span>}
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                        style={{ backgroundColor: test.passed ? 'rgba(0,184,163,0.12)' : 'rgba(248,113,113,0.12)', color: test.passed ? '#00b8a3' : '#f87171' }}>
                        {test.verdict}
                      </span>
                    </div>
                    {!test.passed && !isCE && (
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-amber-400 font-bold shrink-0 w-16">Expected</span>
                          <code className="px-2 py-0.5 rounded break-all" style={{ backgroundColor: 'var(--lc-nav)', color: '#a5b4fc', border: '1px solid var(--lc-border)' }}>{test.expectedOutput}</code>
                        </div>
                        <div className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-red-400 font-bold shrink-0 w-16">Got</span>
                          <code className="px-2 py-0.5 rounded break-all" style={{ backgroundColor: 'var(--lc-nav)', color: '#f87171', border: '1px solid var(--lc-border)' }}>{test.actualOutput || '(no output)'}</code>
                        </div>
                        {test.stderr && (
                          <div className="flex items-start gap-2 text-xs font-mono">
                            <span className="text-orange-400 font-bold shrink-0 w-16">Stderr</span>
                            <pre className="text-orange-300 text-xs rounded p-2 overflow-x-auto whitespace-pre-wrap flex-1"
                              style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(249,115,22,0.2)' }}>{test.stderr}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : null}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ContestArena — redesigned to match Arena.jsx
// ═══════════════════════════════════════════════════════════════════════════════
const ContestArena = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contest, setContest] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(0);
  const [codeMap, setCodeMap] = useState(() => {
    const saved = localStorage.getItem(`codeclash_arena_${id}_codeMap`);
    return saved ? JSON.parse(saved) : {};
  });
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(`codeclash_arena_${id}_language`);
    return saved ? parseInt(saved, 10) : 71;
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [solvedSet, setSolvedSet] = useState(new Set());
  const [activeTab, setActiveTab] = useState('Description');
  const [leftWidth, setLeftWidth] = useState(340);

  // Historical Submissions state
  const [submissionsMap, setSubmissionsMap] = useState({});
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const isDraggingLeft = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(340);
  const [eventLog, setEventLog] = useState(() => {
    const saved = localStorage.getItem(`codeclash_arena_${id}_eventLog`);
    return saved ? JSON.parse(saved) : [{ time: '--:--', msg: 'Contest joined.', color: '#6b7280' }];
  });

  // Sync state to localStorage on changes
  useEffect(() => {
    if (Object.keys(codeMap).length > 0) {
      localStorage.setItem(`codeclash_arena_${id}_codeMap`, JSON.stringify(codeMap));
    }
  }, [codeMap, id]);

  useEffect(() => {
    localStorage.setItem(`codeclash_arena_${id}_language`, language.toString());
  }, [language, id]);

  useEffect(() => {
    if (eventLog.length > 0) {
      localStorage.setItem(`codeclash_arena_${id}_eventLog`, JSON.stringify(eventLog));
    }
  }, [eventLog, id]);

  // Current code for selected problem
  const code = codeMap[selectedProblem] || '';
  const setCode = (val) => setCodeMap((prev) => ({ ...prev, [selectedProblem]: val }));

  // Event log helper
  const addEvent = (msg, color = '#9ca3af') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setEventLog(prev => [{ time, msg, color }, ...prev].slice(0, 30));
  };

  // Horizontal resize
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingLeft.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(520, Math.max(220, dragStartWidth.current + delta));
      setLeftWidth(next);
    };
    const onUp = () => {
      if (!isDraggingLeft.current) return;
      isDraggingLeft.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Fetch contest data
  const fetchContest = useCallback(async () => {
    try {
      const res = await contestApi.get(id);
      const c = res.data.contest;
      setContest(c);

      if (!c.isRegistered) { navigate(`/contests/${id}`); return; }
      if (c.status !== 'active') { navigate(`/contests/${id}`); return; }

      if (c.myStatus) {
        const solved = new Set();
        c.myStatus.forEach((s) => { if (s.solved) solved.add(s.problem); });
        setSolvedSet(solved);
      }
    } catch (err) {
      console.error('Failed to fetch contest:', err);
      navigate('/contests');
    }
  }, [id, navigate]);

  useEffect(() => { fetchContest(); }, [fetchContest]);

  // Countdown timer
  useEffect(() => {
    if (!contest) return;
    const tick = () => {
      const diff = new Date(contest.endTime) - new Date();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [contest]);

  // Fetch past submissions from DB
  const fetchSubmissions = useCallback(async () => {
    const prob = contest?.problems?.[selectedProblem];
    if (!prob) return;
    const problemId = prob.problem?._id || prob.problem;

    setLoadingSubmissions(true);
    try {
      const res = await contestApi.mySubmissions(id, problemId);
      setSubmissionsMap(prev => ({ ...prev, [selectedProblem]: res.data.submissions || [] }));
    } catch (err) {
      console.error("Failed to fetch past submissions");
    } finally {
      setLoadingSubmissions(false);
    }
  }, [id, contest, selectedProblem]);

  // Trigger fetch when swinging to Submissions tab
  useEffect(() => {
    if (activeTab === 'Submissions' && contest) {
      fetchSubmissions();
    }
  }, [activeTab, selectedProblem, contest, fetchSubmissions]);

  // Fetch leaderboard (limited to top 20)
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await contestApi.leaderboard(id, { limit: 20 });
      setLeaderboard(res.data.leaderboard || []);
    } catch { /* ignore */ }
  }, [id]);

  // Throttled leaderboard refresh — at most once every 12 seconds
  const leaderboardThrottleRef = useRef(null);
  const leaderboardPendingRef = useRef(false);

  const throttledFetchLeaderboard = useCallback(() => {
    // If a throttle timer is already running, just mark as pending
    if (leaderboardThrottleRef.current) {
      leaderboardPendingRef.current = true;
      return;
    }
    // Fetch immediately
    fetchLeaderboard();
    // Start throttle window
    leaderboardThrottleRef.current = setTimeout(() => {
      leaderboardThrottleRef.current = null;
      // If updates came in during the throttle window, fetch once more
      if (leaderboardPendingRef.current) {
        leaderboardPendingRef.current = false;
        fetchLeaderboard();
      }
    }, 12000); // 12 second throttle
  }, [fetchLeaderboard]);

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (leaderboardThrottleRef.current) clearTimeout(leaderboardThrottleRef.current);
    };
  }, []);

  // Fetch leaderboard once on mount
  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;

    socket.emit('contest-join', { contestId: id });

    const handleResult = (data) => {
      if (data.contestId === id) {
        setResult(data);
        setSubmitting(false);
        if (data.verdict === 'Accepted') {
          if (data.isSubmit) {
            setSolvedSet((prev) => new Set([...prev, data.problemId]));
            addEvent('Accepted! Problem solved.', '#00b8a3');
          } else {
            addEvent('Sample tests passed!', '#00b8a3');
          }
        } else if (data.verdict === 'Wrong Answer') {
          const p = data.passedTests || 0;
          const t = data.totalTests || 0;
          addEvent(`Wrong Answer — ${p}/${t} passed.`, '#f87171');
        } else if (data.verdict === 'Compilation Error') {
          addEvent('Compilation Error.', '#f97316');
        } else if (data.verdict === 'Time Limit Exceeded') {
          addEvent('Time Limit Exceeded.', '#f59e0b');
        } else if (data.verdict === 'Runtime Error') {
          addEvent('Runtime Error.', '#f87171');
        }
        // No fetchContest() here — solvedSet is already updated locally above
        // Leaderboard will be updated via the server-pushed socket event
        if (activeTab === 'Submissions') fetchSubmissions();
      }
    };

    const handleEnded = () => {
      fetchContest();
      fetchLeaderboard(); // Final leaderboard fetch on contest end
      setTimeLeft('Ended');
      addEvent('Contest has ended!', '#ef4444');
    };

    // Handle server-pushed leaderboard data (no REST call needed)
    const handleLeaderboardUpdate = (data) => {
      if (data.leaderboard) {
        // Server pushed the full leaderboard data — use directly
        setLeaderboard(data.leaderboard);
      } else {
        // Fallback: fetch via REST (throttled)
        throttledFetchLeaderboard();
      }
    };

    socket.on('contest-submission-result', handleResult);
    socket.on('contest-ended', handleEnded);
    socket.on('contest-leaderboard-update', handleLeaderboardUpdate);

    return () => {
      socket.off('contest-submission-result', handleResult);
      socket.off('contest-ended', handleEnded);
      socket.off('contest-leaderboard-update', handleLeaderboardUpdate);
    };
  }, [id, fetchContest, fetchLeaderboard, throttledFetchLeaderboard]);

  // Submit code
  const handleSubmit = async (isSubmit = true) => {
    if (!contest || submitting) return;
    const prob = contest.problems?.[selectedProblem];
    if (!prob) return;

    const problemId = prob.problem?._id || prob.problem;
    if (solvedSet.has(problemId)) {
      addEvent('Already solved!', '#f59e0b');
      return;
    }

    setSubmitting(true);
    setResult(null);
    addEvent('Submitted code...', '#fbbf24');

    try {
      await contestApi.submit(id, { problemId, code, language, isSubmit });
    } catch (err) {
      setSubmitting(false);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Submission failed';
      setResult({ verdict: 'Error', message: msg });
      addEvent('Submission error: ' + msg, '#f87171');
    }
  };

  // ── Loading state ──
  if (!contest) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--lc-bg)' }}>
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-[#ffa116]/20 animate-ping" />
            <div className="w-14 h-14 rounded-full border-2 border-t-transparent border-[#ffa116] animate-spin" />
          </div>
          <p className="font-mono text-sm tracking-widest uppercase" style={{ color: '#ffa116' }}>Loading Arena...</p>
        </div>
      </div>
    );
  }

  const currentProblem = contest.problems?.[selectedProblem]?.problem;
  const currentPoints = contest.problems?.[selectedProblem]?.points || 0;
  const diff = currentProblem?.difficulty?.toLowerCase();
  const diffColor = diff === 'easy' ? '#22c55e' : diff === 'hard' ? '#f87171' : '#ffc01e';
  const totalProblems = contest.problems?.length || 0;
  const solvedCount = contest.problems?.filter((cp) => solvedSet.has(cp.problem?._id || cp.problem)).length || 0;
  const userId = user?._id || user?.id;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--lc-bg)', color: 'var(--lc-text-primary)' }}>

      {/* ══════════════ HEADER (matches Arena.jsx) ══════════════ */}
      <header className="flex items-center justify-between px-4 shrink-0 z-40"
        style={{ backgroundColor: 'var(--lc-nav)', borderBottom: '1px solid var(--lc-border)', height: '48px' }}>
        {/* Left: Logo + contest info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-xs text-black"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)' }}>CC</div>
            <span className="font-black text-sm text-white">CodeClash</span>
          </div>
          <span className="text-gray-700 text-xs">|</span>
          <div className="flex items-center gap-2 min-w-0 text-xs font-mono">
            <span className="text-gray-500 uppercase tracking-wider shrink-0">CONTEST:</span>
            <span className="text-white font-bold truncate">{contest.title}</span>
            <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold font-mono"
              style={{ backgroundColor: 'rgba(0,122,255,0.15)', color: '#60a5fa', border: '1px solid rgba(0,122,255,0.2)' }}>
              {totalProblems} Problems
            </span>
          </div>
        </div>

        {/* Right: Timer + Leave + Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: timeLeft === 'Ended' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#ffa116,#ff7a00)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12,6 12,12 15.5,14" />
              </svg>
            </div>
            <span className="font-mono text-sm font-black tabular-nums"
              style={{ color: timeLeft === 'Ended' ? '#ef4444' : '#ffa116' }}>
              {timeLeft || '--:--'}
            </span>
          </div>
          <button onClick={() => navigate(`/contests/${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all hover:opacity-80"
            style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            <span className="flex items-center gap-1.5"><ArrowLeftIcon size={16} /> Leave</span>
          </button>
          {user?.picture
            ? <img src={user.picture} alt="" className="w-7 h-7 rounded-full" style={{ border: '2px solid var(--lc-border)' }} />
            : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)' }}>{user?.name?.[0] || 'U'}</div>
          }
        </div>
      </header>

      {/* ══════════════ 3-COLUMN BODY ══════════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT: Problem Panel ── */}
        <aside className="flex flex-col overflow-hidden shrink-0"
          style={{ width: leftWidth + 'px', backgroundColor: 'var(--lc-card)' }}>

          {/* Problem tabs (A, B, C…) */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
            {contest.problems?.map((cp, idx) => {
              const pid = cp.problem?._id || cp.problem;
              const solved = solvedSet.has(pid);
              const isActive = selectedProblem === idx;
              return (
                <button key={idx} onClick={() => { setSelectedProblem(idx); setResult(null); setActiveTab('Description'); }}
                  className="flex-1 py-2.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  style={{
                    color: isActive ? '#ffa116' : solved ? '#00b8a3' : '#6b7280',
                    borderBottom: isActive ? '2px solid #ffa116' : '2px solid transparent',
                    backgroundColor: 'transparent',
                  }}>
                  {solved && <span className="absolute left-2 text-emerald-400"><CheckIcon size={14} /></span>}
                  {String.fromCharCode(65 + idx)}
                </button>
              );
            })}
          </div>

          {/* Section tabs */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
            {['Description', 'Submissions'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  color: activeTab === tab ? '#ffa116' : '#6b7280',
                  borderBottom: activeTab === tab ? '2px solid #ffa116' : '2px solid transparent',
                  backgroundColor: 'transparent',
                }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'Description' && currentProblem && (
              <div className="px-5 py-4 space-y-5">
                {/* Title + Difficulty + Points */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono"
                      style={{ color: diffColor, backgroundColor: diffColor + '18', border: '1px solid ' + diffColor + '35' }}>
                      {diff?.charAt(0).toUpperCase() + diff?.slice(1)}
                    </span>
                    {currentPoints > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{ backgroundColor: 'rgba(0,184,163,0.12)', color: '#00b8a3', border: '1px solid rgba(0,184,163,0.2)' }}>
                        {currentPoints} pts
                      </span>
                    )}
                  </div>
                  <h1 className="text-base font-black text-white leading-snug">{currentProblem.title}</h1>
                </div>

                {/* Description text */}
                <div className="text-sm leading-[1.85] font-sans whitespace-pre-wrap"
                  style={{ color: '#d1d5db', letterSpacing: '0.01em' }}>
                  {descriptionWithoutLink(currentProblem.description) || 'No description available.'}
                </div>

                {/* Examples */}
                {(currentProblem.testCases || []).filter(tc => !tc.isHidden).map((tc, i) => (
                  <div key={i}>
                    <p className="text-xs font-mono font-black text-white mb-2">Example {i + 1}:</p>
                    <div className="rounded-lg p-3 space-y-1.5 text-sm font-mono"
                      style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
                      <div><span className="text-gray-500">Input: </span><span className="text-gray-200">{tc.input}</span></div>
                      <div><span className="text-gray-500">Output: </span><span style={{ color: '#00b8a3' }}>{tc.expectedOutput}</span></div>
                    </div>
                  </div>
                ))}

                {/* Constraints */}
                <div>
                  <p className="text-xs font-mono font-black text-white mb-2">Constraints:</p>
                  <ul className="space-y-1.5">
                    {[
                      'Time limit: ' + (currentProblem.timeLimit ?? 2) + 's per test case',
                      'Memory: ' + (currentProblem.memoryLimit ?? 256) + ' MB',
                      'Languages: Python, JS, Java, C++, C, Fortran, D',
                    ].map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-mono text-gray-400">
                        <span style={{ color: '#ffa116' }}>•</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'Submissions' && (
              <div className="p-4 space-y-3">
                {loadingSubmissions ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#ffa116] animate-spin" />
                  </div>
                ) : submissionsMap[selectedProblem]?.length > 0 ? (
                  submissionsMap[selectedProblem].map((sub, idx) => {
                    const vs = vStyle(sub.verdict);
                    return (
                      <div key={sub._id || idx} className="rounded-xl p-4" style={{ backgroundColor: vs.bg, border: '1px solid ' + vs.border }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-lg">{vs.icon}</span>
                            <span className="font-black text-sm font-mono" style={{ color: vs.color }}>{sub.verdict}</span>
                          </div>
                          <span className="text-[10px] font-mono text-gray-500">{new Date(sub.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex gap-4 text-xs font-mono text-gray-400">
                          <span>{sub.language === 71 ? 'Python' : sub.language === 63 ? 'JavaScript' : sub.language === 54 ? 'C++' : sub.language === 50 ? 'C' : sub.language === 998 ? 'Fortran' : sub.language === 999 ? 'D' : 'Java'}</span>
                          {sub.verdict === 'Accepted' && sub.runtime && <span>⏱ {sub.runtime}</span>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
                    <p className="text-sm font-bold text-white">No submissions yet</p>
                    <p className="text-xs text-gray-500 font-mono">Submit your code to see results here.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Description' && !currentProblem && (
              <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-16">
                <p className="text-sm font-bold text-white">Select a problem</p>
                <p className="text-xs text-gray-500 font-mono">Choose a problem from the tabs above.</p>
              </div>
            )}
          </div>
        </aside>

        {/* ── Vertical resize handle ── */}
        <div
          onMouseDown={(e) => {
            isDraggingLeft.current = true;
            dragStartX.current = e.clientX;
            dragStartWidth.current = leftWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          className="shrink-0 flex items-center justify-center cursor-col-resize group"
          style={{ width: '6px', backgroundColor: 'var(--lc-bg)', borderLeft: '1px solid var(--lc-border)', borderRight: '1px solid var(--lc-border)' }}
        >
          <div className="w-[2px] h-8 rounded-full bg-[var(--lc-border)] group-hover:bg-[#ffa116] transition-colors duration-150" />
        </div>

        {/* ── CENTER: Editor Panel ── */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ backgroundColor: 'var(--lc-bg)' }}>

          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
            style={{ backgroundColor: 'var(--lc-nav)', borderBottom: '1px solid var(--lc-border)' }}>
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ backgroundColor: 'var(--lc-bg)', border: '1px solid var(--lc-border)' }}>
              {LANGS.map(l => (
                <button key={l.id} onClick={() => setLanguage(l.id)}
                  className="px-3 py-1 text-[11px] font-mono font-bold rounded-md transition-all duration-200"
                  style={language === l.id
                    ? { background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }
                    : { color: '#6b7280', backgroundColor: 'transparent' }}>
                  {l.short}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: '#00b8a3' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00b8a3] animate-pulse inline-block" />
                Live
              </span>
              <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all" title="Settings">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              </button>
            </div>
          </div>

          {/* Resizable Editor + Results (matches Arena.jsx pattern) */}
          <ResizablePanels result={result} submitting={submitting} language={language} code={code} setCode={setCode} onSubmit={handleSubmit} />

          {/* Bottom action bar */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ backgroundColor: 'var(--lc-nav)', borderTop: '1px solid var(--lc-border)' }}>
            <span className="text-[10px] font-mono text-gray-600">
              Problem {String.fromCharCode(65 + selectedProblem)} · {solvedCount}/{totalProblems} Solved
            </span>
            <div className="flex items-center gap-2">
              {/* ACTION BUTTONS */}
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || !code.trim() || timeLeft === 'Ended'}
                className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)', color: '#9ca3af' }}>
                Run
              </button>
              <button onClick={() => handleSubmit(true)}
                disabled={submitting || !code.trim() || timeLeft === 'Ended'}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a', boxShadow: '0 0 12px rgba(255,161,22,0.25)' }}>
                {submitting
                  ? <><span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /><span>Running...</span></>
                  : 'Submit'
                }
              </button>
            </div>
          </div>
        </main>

        {/* ── RIGHT: Contest Sidebar (leaderboard + progress + event log) ── */}
        <aside className="flex flex-col overflow-hidden shrink-0"
          style={{ width: '240px', backgroundColor: 'var(--lc-card)', borderLeft: '1px solid var(--lc-border)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--lc-border)' }}>
            <span className="text-[10px] font-mono font-black text-white uppercase tracking-widest">Leaderboard</span>
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold" style={{ color: '#00b8a3' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00b8a3] animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Leaderboard list */}
          <div className="overflow-y-auto shrink-0" style={{ maxHeight: '240px', borderBottom: '1px solid var(--lc-border)' }}>
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <TrophyIcon size={32} className="text-[#ffa116]" />
                <p className="text-xs font-mono text-gray-500">No submissions yet</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--lc-border)' }}>
                {leaderboard.map((entry, idx) => {
                  const isMe = entry.userId === userId;
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                  return (
                    <div key={entry.userId || idx}
                      className="flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                      style={{ backgroundColor: isMe ? 'rgba(255,161,22,0.08)' : 'transparent' }}>
                      <span className="w-6 text-center font-black font-mono"
                        style={{ color: idx < 3 ? '#ffa116' : '#6b7280' }}>
                        {medal || (idx + 1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono font-bold truncate block"
                          style={{ color: isMe ? '#ffa116' : '#fff' }}>
                          {isMe ? '(You)' : ''} {entry.name || 'User'}
                        </span>
                      </div>
                      <span className="font-mono font-black shrink-0" style={{ color: '#00b8a3' }}>
                        {entry.solved || 0}
                      </span>
                      {entry.penalty > 0 && (
                        <span className="text-[9px] font-mono text-gray-500 shrink-0">
                          {entry.penalty}m
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Your Progress */}
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
            <p className="text-[9px] font-mono font-black text-white uppercase tracking-widest mb-3">Your Progress</p>

            {/* Solved progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-gray-400">{user?.name?.split(' ')[0] || 'You'}</span>
                <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: '#00b8a3' }}>
                  {solvedCount}/{totalProblems} Solved
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--lc-bg)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: totalProblems > 0 ? ((solvedCount / totalProblems) * 100) + '%' : '0%',
                    background: 'linear-gradient(90deg,#00b8a3,#00968a)'
                  }} />
              </div>
            </div>

            {/* Problem status pills */}
            <div className="flex gap-1.5 flex-wrap">
              {contest.problems?.map((cp, idx) => {
                const pid = cp.problem?._id || cp.problem;
                const solved = solvedSet.has(pid);
                return (
                  <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold"
                    style={{
                      backgroundColor: solved ? 'rgba(0,184,163,0.12)' : 'var(--lc-nav)',
                      color: solved ? '#00b8a3' : '#6b7280',
                      border: `1px solid ${solved ? 'rgba(0,184,163,0.25)' : 'var(--lc-border)'}`,
                    }}>
                    {solved ? <CheckIcon size={14} className="text-emerald-400" /> : '○'} {String.fromCharCode(65 + idx)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Log */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <p className="text-[9px] font-mono font-black text-white uppercase tracking-widest px-4 pt-3 pb-2 shrink-0">Event Log</p>
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2.5">
              {eventLog.map((ev, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-[9px] font-mono text-gray-600 shrink-0 mt-0.5 tabular-nums">{ev.time}</span>
                  <span className="text-[10px] font-mono leading-relaxed" style={{ color: ev.color }}>{ev.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer: Rank + Solved */}
          <div className="flex shrink-0" style={{ borderTop: '1px solid var(--lc-border)' }}>
            <div className="flex-1 flex flex-col items-center py-3"
              style={{ borderRight: '1px solid var(--lc-border)' }}>
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">Rank</p>
              <p className="text-sm font-black text-white font-mono">
                #{leaderboard.findIndex(e => e.userId === userId) + 1 || '—'}
              </p>
            </div>
            <div className="flex-1 flex flex-col items-center py-3">
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">Solved</p>
              <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>
                {solvedCount}/{totalProblems}
              </p>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
};

export default ContestArena;
