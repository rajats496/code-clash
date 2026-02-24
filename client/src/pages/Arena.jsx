import { useEffect, useState, useRef } from 'react';
import { useMatch } from '../context/MatchContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MatchTimer from '../components/arena/MatchTimer';
import MatchEndModal from '../components/arena/MatchEndModal';
import { getSocket } from '../services/socket';
import Editor from '@monaco-editor/react';
import { CheckIcon, CrossIcon, ClockIcon, FlameIcon, SparklesIcon, TrophyIcon, CopyIcon, ArrowLeftIcon } from '../components/common/Icons';

// ── Verdict colour helper ─────────────────────────────────────────────────────
const vStyle = (v) => {
  if (v === 'Accepted') return { color: '#00b8a3', bg: 'rgba(0,184,163,0.08)', border: 'rgba(0,184,163,0.35)', icon: <CheckIcon size={16} /> };
  if (v === 'processing' || v === 'pending') return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.35)', icon: <span className="animate-pulse">…</span> };
  if (v === 'Compilation Error') return { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.35)', icon: <SparklesIcon size={16} /> };
  if (v === 'Time Limit Exceeded') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', icon: <ClockIcon size={16} /> };
  if (v === 'Runtime Error') return { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.35)', icon: <FlameIcon size={16} /> };
  if (v === 'Wrong Answer') return { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.35)', icon: <CrossIcon size={16} /> };
  return { color: '#9ca3af', bg: 'transparent', border: 'var(--lc-border)', icon: '?' };
};

const LANGS = [
  { id: 71, short: 'PY', label: 'Python', mono: 'python' },
  { id: 63, short: 'JS', label: 'JavaScript', mono: 'javascript' },
  { id: 62, short: 'Java', label: 'Java', mono: 'java' },
  { id: 54, short: 'C++', label: 'C++', mono: 'cpp' },
  { id: 50, short: 'C', label: 'C', mono: 'c' },
  { id: 998, short: 'Fortran', label: 'Fortran', mono: 'plaintext' },
  { id: 999, short: 'D', label: 'D', mono: 'plaintext' },
];

// ── Resizable Editor + Result Panel ──
const ResizablePanels = ({ submissionStatus, language, code, setCode, matchState, onSubmit }) => {
  const containerRef = useRef(null);
  const [editorHeight, setEditorHeight] = useState(100);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startEditorHeight = useRef(100);

  useEffect(() => {
    const s = submissionStatus?.status;
    if (!s) {
      setEditorHeight(100);
    } else if (s === 'processing' || s === 'pending') {
      // Show a peek of the loading spinner while code runs
      setEditorHeight(65);
    } else {
      // Final verdict — give result panel the majority of space
      setEditorHeight(38);
    }
  }, [submissionStatus?.status]);

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
      <div style={{ height: submissionStatus ? `${editorHeight}%` : '100%', transition: isDragging.current ? 'none' : 'height 0.2s ease' }}
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
            // Ctrl+S — Prevent browser save dialog (code already auto-saves)
            editor.addAction({
              id: 'save-code',
              label: 'Save Code',
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
              run: () => { /* code auto-saves on every keystroke */ },
            });
          }}
          onChange={(newCode) => {
            setCode(newCode || '');
            const stored = JSON.parse(localStorage.getItem('currentMatch') || '{}');
            localStorage.setItem('currentMatch', JSON.stringify({
              ...stored,
              savedCode: newCode || ''
            }));
          }}
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

      {submissionStatus && (
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

      {submissionStatus && (() => {
        const v = submissionStatus.status;
        const vs = vStyle(v);
        const isCE = v === 'Compilation Error';
        const isLoading = v === 'processing' || v === 'pending';
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
                  {submissionStatus.message && <p className="text-[11px] text-gray-500 font-mono mt-0.5">{submissionStatus.message}</p>}
                </div>
              </div>
              {v === 'Accepted' && (submissionStatus.runtime || submissionStatus.memory) && (
                <div className="flex items-center gap-2.5">
                  {submissionStatus.runtime && (
                    <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
                      <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Runtime</p>
                      <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>{submissionStatus.runtime}</p>
                    </div>
                  )}
                  {submissionStatus.memory && (
                    <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
                      <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Memory</p>
                      <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>{submissionStatus.memory}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compiler output */}
            {isCE && submissionStatus.compilationError && (
              <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
                <p className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest mb-2">Compiler Output</p>
                <pre className="text-xs font-mono text-red-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {submissionStatus.compilationError}
                </pre>
              </div>
            )}

            {isLoading && !submissionStatus.testResults && (
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

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {submissionStatus.testResults ? (
                submissionStatus.testResults.map((test, index) => (
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
                          <pre className="px-2 py-0.5 rounded break-all whitespace-pre-wrap" style={{ backgroundColor: 'var(--lc-nav)', color: '#a5b4fc', border: '1px solid var(--lc-border)', margin: 0, fontFamily: 'inherit', fontSize: 'inherit' }}>{test.expectedOutput}</pre>
                        </div>
                        <div className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-red-400 font-bold shrink-0 w-16">Got</span>
                          <pre className="px-2 py-0.5 rounded break-all whitespace-pre-wrap" style={{ backgroundColor: 'var(--lc-nav)', color: '#f87171', border: '1px solid var(--lc-border)', margin: 0, fontFamily: 'inherit', fontSize: 'inherit' }}>{test.actualOutput || '(no output)'}</pre>
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

const Arena = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    joinMatch, submitCode, updateCode, matchEndResult, submissionStatus, resetMatchState, matchState,
    currentRound, totalRounds, roundScores, roundWonResult, setMatchEndResult,
  } = useMatch();
  const [code, setCode] = useState('// Write your code here\n');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [language, setLanguage] = useState(71);
  const [matchData, setMatchData] = useState(null);
  const [activeProblem, setActiveProblem] = useState(null);
  const [activeTab, setActiveTab] = useState('Description');
  const [leftWidth, setLeftWidth] = useState(300);
  const isDraggingLeft = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(300);
  const [opponentStatus, setOpponentStatus] = useState('idle'); // 'idle' | 'typing' | 'submitted'
  const opponentTypingTimer = useRef(null);

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

  // ── Persistent event log (keyed by roomId so it survives refresh) ──
  const getLogKey = () => {
    try { return 'eventLog_' + (JSON.parse(localStorage.getItem('currentMatch') || '{}').roomId || 'default'); }
    catch { return 'eventLog_default'; }
  };
  const [eventLog, setEventLog] = useState(() => {
    try {
      const key = 'eventLog_' + (JSON.parse(localStorage.getItem('currentMatch') || '{}').roomId || 'default');
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [{ time: '--:--', msg: 'Match started.', color: '#6b7280' }];
    } catch { return [{ time: '--:--', msg: 'Match started.', color: '#6b7280' }]; }
  });

  const addEvent = (msg, color = '#9ca3af') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setEventLog(prev => {
      const next = [{ time, msg, color }, ...prev].slice(0, 30);
      try { localStorage.setItem(getLogKey(), JSON.stringify(next)); } catch { }
      return next;
    });
  };

  useEffect(() => {
    const storedMatch = localStorage.getItem('currentMatch');
    if (!storedMatch) { navigate('/matchmaking'); return; }
    try {
      const data = JSON.parse(storedMatch);
      const matchAge = data.createdAt ? (Date.now() - data.createdAt) : 0;
      if (matchAge > 3600000) {
        localStorage.removeItem('currentMatch');
        sessionStorage.removeItem('currentTimer');
        navigate('/matchmaking');
        return;
      }
      setMatchData(data);
      const round = data.currentRound || 0;
      if (data.currentProblem) setActiveProblem(data.currentProblem);
      else if (data.problems?.[round]) setActiveProblem(data.problems[round]);
      else if (data.problem) setActiveProblem(data.problem);
      if (data.savedCode) setCode(data.savedCode);
      joinMatch(data.roomId);
    } catch {
      localStorage.removeItem('currentMatch');
      navigate('/matchmaking');
    }
  }, [navigate]);

  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('currentMatch') || '{}');
        if (stored.currentProblem) {
          setActiveProblem(stored.currentProblem);
          setCode('// Write your code here\n');
          setMatchData(prev => ({ ...prev, ...stored }));
        }
      } catch { }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!matchData) return;
    try {
      const stored = JSON.parse(localStorage.getItem('currentMatch') || '{}');
      if (stored.currentProblem && currentRound > 0) {
        setActiveProblem(stored.currentProblem);
        setCode('// Write your code here\n'); setOpponentStatus('idle'); addEvent('Round ' + (currentRound + 1) + ' started.', '#ffa116');
      }
    } catch { }
  }, [currentRound]);

  useEffect(() => {
    if (!matchEndResult) return;
    if (matchEndResult.autoRedirect) {
      // Error case — silently redirect
      setTimeout(() => navigate('/matchmaking'), 100);
      return;
    }
    // Normal match-end — clear event log so next match starts fresh
    try {
      const stored = JSON.parse(localStorage.getItem('currentMatch') || '{}');
      if (stored.roomId) localStorage.removeItem('eventLog_' + stored.roomId);
    } catch { }
  }, [matchEndResult, navigate]);

  // Track opponent live typing activity
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onTyping = () => {
      setOpponentStatus('typing');
      if (opponentTypingTimer.current) clearTimeout(opponentTypingTimer.current);
      // Reset to idle after 5s of no updates
      opponentTypingTimer.current = setTimeout(() => setOpponentStatus('idle'), 5000);
    };
    socket.on('opponent-typing', onTyping);
    return () => { socket.off('opponent-typing', onTyping); };
  }, []);

  useEffect(() => {
    if (!matchState) return;
    const timeout = setTimeout(() => {
      if (matchState.status === 'in-progress') updateCode(code, language);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [code, language, matchState]);

  useEffect(() => {
    if (!submissionStatus) return;
    const s = submissionStatus.status;
    if (s === 'processing' || s === 'pending') {
      addEvent('You submitted your code.', '#fbbf24');
    } else if (s === 'Accepted') {
      addEvent('You passed all test cases!', '#00b8a3');
    } else if (s === 'Wrong Answer') {
      const passed = submissionStatus.testResults?.filter(t => t.passed).length || 0;
      const total = submissionStatus.testResults?.length || 0;
      addEvent('Wrong Answer — ' + passed + '/' + total + ' tests passed.', '#f87171');
    } else if (s === 'Compilation Error') {
      addEvent('Compilation Error in your code.', '#f97316');
    } else if (s && s !== 'processing' && s !== 'pending') {
      addEvent(s, '#f87171');
    }
  }, [submissionStatus?.status]);

  useEffect(() => {
    if (!roundWonResult) return;
    const uid = user?._id || user?.id;
    const oppName = matchData?.opponent?.name?.split(' ')[0] || 'Opponent';
    if (roundWonResult.winnerId === uid) {
      addEvent('You won Round ' + currentRound + '!', '#00b8a3');
    } else {
      addEvent(oppName + ' won Round ' + currentRound + '.', '#f87171');
      setOpponentStatus('solved');
      // Reset after 4s (next round starts soon)
      setTimeout(() => setOpponentStatus('idle'), 4000);
    }
  }, [roundWonResult]);

  const handleSubmit = (isSubmit = true) => submitCode(code, language, isSubmit);

  if (!matchData || !activeProblem) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--lc-bg)' }}>
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

  const diff = activeProblem.difficulty?.toLowerCase();
  const userId = user?._id || user?.id;
  const myScore = roundScores[userId] || 0;
  const opponentScore = Object.entries(roundScores).find(([k]) => k !== userId)?.[1] || 0;
  const isMultiRound = (matchData.totalRounds || totalRounds || 1) > 1;
  const displayTotalRounds = matchData.totalRounds || totalRounds || 1;
  const diffColor = diff === 'easy' ? '#22c55e' : diff === 'medium' ? '#ffc01e' : '#f87171';
  const opponentName = matchData?.opponent?.name?.split(' ')[0] || 'Opponent';
  const myPassed = submissionStatus?.testResults?.filter(t => t.passed).length || 0;
  const myTotal = submissionStatus?.testResults?.length || 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--lc-bg)', color: 'var(--lc-text-primary)' }}>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 shrink-0 z-40"
        style={{ backgroundColor: 'var(--lc-nav)', borderBottom: '1px solid var(--lc-border)', height: '48px' }}>
        {/* Left: Logo + match info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-xs text-black"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)' }}>CC</div>
            <span className="font-black text-sm text-white">CodeClash</span>
          </div>
          <span className="text-gray-700 text-xs">|</span>
          <div className="flex items-center gap-2 min-w-0 text-xs font-mono">
            <span className="text-gray-500 uppercase tracking-wider shrink-0">MATCH:</span>
            <span className="text-white font-bold truncate">{activeProblem.title}</span>
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black"
              style={{
                color: diffColor,
                backgroundColor: diffColor + '18',
                border: '1px solid ' + diffColor + '35'
              }}>
              {diff?.charAt(0).toUpperCase() + diff?.slice(1)}
            </span>
            {isMultiRound && (
              <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{ backgroundColor: 'rgba(0,122,255,0.15)', color: '#60a5fa', border: '1px solid rgba(0,122,255,0.2)' }}>
                R{currentRound + 1}/{displayTotalRounds}
              </span>
            )}
          </div>
        </div>

        {/* Right: Timer + Surrender + Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timer — orange coin icon + bold time */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12,6 12,12 15.5,14" />
              </svg>
            </div>
            <MatchTimer />
          </div>
          <button onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all hover:opacity-80"
            style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            &#9872; Surrender
          </button>
          {user?.picture
            ? <img src={user.picture} alt="" className="w-7 h-7 rounded-full" style={{ border: '2px solid var(--lc-border)' }} />
            : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)' }}>{user?.name?.[0] || 'Y'}</div>
          }
        </div>
      </header>

      {/* Round Won Overlay */}
      {roundWonResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl p-8 text-center w-80 shadow-2xl"
            style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)', boxShadow: '0 0 60px rgba(255,161,22,0.12)' }}>
            <div className="flex justify-center mb-4">{roundWonResult.winnerId === userId ? <TrophyIcon size={64} className="text-[#ffa116]" /> : <FlameIcon size={64} className="text-red-500 opacity-60" />}</div>
            <h2 className="text-xl font-black text-white mb-1">
              {roundWonResult.winnerId === userId ? 'Round Won!' : 'Round Lost'}
            </h2>
            <p className="text-xs font-mono text-gray-500 mb-5">Solved in <span className="text-white font-bold">{roundWonResult.solveTime}s</span></p>
            <div className="flex items-center justify-center gap-8 p-4 rounded-xl"
              style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">You</p>
                <p className="text-3xl font-black font-mono" style={{ color: '#00b8a3' }}>{myScore}</p>
              </div>
              <span className="text-gray-700 text-xl">—</span>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Them</p>
                <p className="text-3xl font-black font-mono text-red-400">{opponentScore}</p>
              </div>
            </div>
            {currentRound < displayTotalRounds - 1 && (
              <p className="mt-4 text-xs font-mono animate-pulse" style={{ color: '#ffa116' }}>⟳ Next round loading...</p>
            )}
          </div>
        </div>
      )}

      {/* ── 3-COLUMN BODY ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT: Problem Panel */}
        <aside className="flex flex-col overflow-hidden shrink-0"
          style={{ width: leftWidth + 'px', backgroundColor: 'var(--lc-card)' }}>

          {/* Tabs */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
            {['Description', 'Solutions', 'Submissions'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  color: activeTab === tab ? '#ffa116' : '#6b7280',
                  borderBottom: activeTab === tab ? '2px solid #ffa116' : '2px solid transparent',
                  backgroundColor: 'transparent',
                }}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'Description' && (
              <div className="px-5 py-4 space-y-5">

                {/* Title */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono"
                      style={{ color: diffColor, backgroundColor: diffColor + '18', border: '1px solid ' + diffColor + '35' }}>
                      {diff?.charAt(0).toUpperCase() + diff?.slice(1)}
                    </span>
                    {isMultiRound && (
                      <span className="text-[10px] font-mono text-gray-500">Round {currentRound + 1}/{displayTotalRounds}</span>
                    )}
                  </div>
                  <h1 className="text-base font-black text-white leading-snug">{activeProblem.title}</h1>
                </div>

                {/* Description text */}
                <div className="text-sm leading-[1.85] font-sans whitespace-pre-wrap"
                  style={{ color: '#d1d5db', letterSpacing: '0.01em' }}>
                  {activeProblem.description}
                </div>

                {/* Examples */}
                {(activeProblem.testCases || []).filter(tc => !tc.isHidden).map((tc, i) => (
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
                      'Time limit: ' + (activeProblem.timeLimit ?? 2) + 's per test case',
                      'Memory: ' + (activeProblem.memoryLimit ?? 256) + ' MB',
                      'Languages: Python, JS, Java, C++',
                    ].map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-mono text-gray-400">
                        <span style={{ color: '#ffa116' }}>•</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            )}

            {activeTab === 'Solutions' && (
              <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-16">
                <div className="text-4xl mb-1">&#128274;</div>
                <p className="text-sm font-bold text-white">Solutions locked</p>
                <p className="text-xs text-gray-500 font-mono leading-relaxed">Solutions are revealed<br />after the match ends.</p>
              </div>
            )}

            {activeTab === 'Submissions' && (
              <div className="p-4">
                {submissionStatus ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">Latest Submission</p>
                    {(() => {
                      const vs = vStyle(submissionStatus.status);
                      return (
                        <div className="rounded-xl p-4" style={{ backgroundColor: vs.bg, border: '1px solid ' + vs.border }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-black text-lg">{vs.icon}</span>
                            <span className="font-black text-sm font-mono" style={{ color: vs.color }}>{submissionStatus.status}</span>
                          </div>
                          {submissionStatus.testResults && (
                            <p className="text-xs font-mono text-gray-400">
                              {submissionStatus.testResults.filter(t => t.passed).length} / {submissionStatus.testResults.length} test cases passed
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
                    <p className="text-sm font-bold text-white">No submissions yet</p>
                    <p className="text-xs text-gray-500 font-mono">Submit your code to see results here.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Vertical resize handle */}
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

        {/* CENTER: Editor Panel */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ backgroundColor: 'var(--lc-bg)' }}>

          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
            style={{ backgroundColor: 'var(--lc-nav)', borderBottom: '1px solid var(--lc-border)' }}>
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ backgroundColor: 'var(--lc-bg)', border: '1px solid var(--lc-border)' }}>
              {[{ id: 71, s: 'Python 3' }, { id: 63, s: 'JavaScript' }, { id: 62, s: 'Java' }, { id: 54, s: 'C++' }].map(l => (
                <button key={l.id} onClick={() => setLanguage(l.id)}
                  className="px-3 py-1 text-[11px] font-mono font-bold rounded-md transition-all duration-200"
                  style={language === l.id
                    ? { background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }
                    : { color: '#6b7280', backgroundColor: 'transparent' }}>
                  {l.s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {matchState?.status === 'in-progress' && (
                <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: '#00b8a3' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00b8a3] animate-pulse inline-block" />
                  Live
                </span>
              )}
              <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all" title="Settings">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              </button>
              <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all" title="Fullscreen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,3 21,3 21,9" /><polyline points="9,21 3,21 3,15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
              </button>
            </div>
          </div>

          {/* Resizable Editor + Results */}
          <ResizablePanels submissionStatus={submissionStatus} language={language} code={code} setCode={setCode} matchState={matchState} onSubmit={handleSubmit} />

          {/* Bottom action bar */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ backgroundColor: 'var(--lc-nav)', borderTop: '1px solid var(--lc-border)' }}>
            <span className="text-[10px] font-mono text-gray-600">
              {isMultiRound ? 'Round ' + (currentRound + 1) + ' / ' + displayTotalRounds : 'CodeClash'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmit(false)}
                disabled={submissionStatus?.status === 'processing' || submissionStatus?.status === 'pending'}
                className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)', color: '#9ca3af' }}>
                Run
              </button>
              <button onClick={() => handleSubmit(true)}
                disabled={submissionStatus?.status === 'processing' || submissionStatus?.status === 'pending'}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a', boxShadow: '0 0 12px rgba(255,161,22,0.25)' }}>
                {submissionStatus?.status === 'processing' || submissionStatus?.status === 'pending'
                  ? <><span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /><span>Running...</span></>
                  : 'Submit'
                }
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT: Opponent Feed */}
        <aside className="flex flex-col overflow-hidden shrink-0"
          style={{ width: '215px', backgroundColor: 'var(--lc-card)', borderLeft: '1px solid var(--lc-border)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--lc-border)' }}>
            <span className="text-[10px] font-mono font-black text-white uppercase tracking-widest">Opponent Feed</span>
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Opponent card */}
          <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)' }}>
              {matchData?.opponent?.picture
                ? <img src={matchData.opponent.picture} alt="" className="w-10 h-10 rounded-full shrink-0"
                  style={{ border: '2px solid #f87171', boxShadow: '0 0 10px rgba(248,113,113,0.2)' }} />
                : <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#f87171,#dc2626)' }}>
                  {opponentName[0]}
                </div>
              }
              <div className="min-w-0">
                <p className="text-xs font-bold text-white font-mono truncate">@{opponentName}</p>
                <p className="text-[10px] font-mono mt-0.5"
                  style={{
                    color: opponentStatus === 'typing' ? '#ffa116'
                      : opponentStatus === 'solved' ? '#00b8a3'
                        : matchState?.status === 'in-progress' ? '#6b7280'
                          : '#4b5563'
                  }}>
                  {opponentStatus === 'typing'
                    ? '● Coding...'
                    : opponentStatus === 'solved'
                      ? <span className="flex items-center gap-1"><CheckIcon size={14} /> Solved!</span>
                      : matchState?.status === 'in-progress'
                        ? '○ Connected'
                        : '○ Waiting'}
                </p>
              </div>
            </div>
          </div>

          {/* Match Progress */}
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--lc-border)' }}>
            <p className="text-[9px] font-mono font-black text-white uppercase tracking-widest mb-3">Match Progress</p>

            {/* You */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-gray-400 truncate">{user?.name?.split(' ')[0] || 'You'}</span>
                {myTotal > 0 && (
                  <span className="text-[10px] font-mono font-bold shrink-0 ml-1" style={{ color: '#00b8a3' }}>
                    {myPassed}/{myTotal} Passed
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--lc-bg)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: myTotal > 0 ? ((myPassed / myTotal) * 100) + '%'
                      : isMultiRound ? ((myScore / displayTotalRounds) * 100) + '%' : '0%',
                    background: 'linear-gradient(90deg,#00b8a3,#00968a)'
                  }} />
              </div>
            </div>

            {/* Opponent */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-gray-400 truncate">{opponentName}</span>
                {isMultiRound && (
                  <span className="text-[10px] font-mono font-bold text-red-400 shrink-0 ml-1">{opponentScore}/{displayTotalRounds} Won</span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--lc-bg)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: isMultiRound ? ((opponentScore / displayTotalRounds) * 100) + '%' : '0%',
                    background: 'linear-gradient(90deg,#f87171,#dc2626)'
                  }} />
              </div>
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

          {/* Footer: Rank + Win Rate */}
          <div className="flex shrink-0" style={{ borderTop: '1px solid var(--lc-border)' }}>
            <div className="flex-1 flex flex-col items-center py-3"
              style={{ borderRight: '1px solid var(--lc-border)' }}>
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">Rank</p>
              <p className="text-sm font-black text-white font-mono">#{user?.rank || '—'}</p>
            </div>
            <div className="flex-1 flex flex-col items-center py-3">
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">Win Rate</p>
              <p className="text-sm font-black font-mono" style={{ color: '#00b8a3' }}>
                {user?.wins && user?.totalMatches
                  ? Math.round((user.wins / user.totalMatches) * 100) + '%'
                  : '—'}
              </p>
            </div>
          </div>

        </aside>

      </div>

      {/* Match End Modal — shown when match-end fires (win / loss / forfeit) */}
      {matchEndResult && !matchEndResult.autoRedirect && (
        <MatchEndModal result={matchEndResult} />
      )}

      {/* Leave Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl w-[360px] overflow-hidden shadow-2xl"
            style={{ backgroundColor: 'var(--lc-nav)', border: '1px solid var(--lc-border)', boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--lc-border)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>&#9872;</div>
              <h2 className="text-lg font-black text-white mb-1">Leave Match?</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--lc-text-primary)' }}>
                Your opponent will be declared the winner. This cannot be undone.
              </p>
            </div>
            <div className="p-4 space-y-2.5">
              <button
                onClick={() => {
                  const socket = getSocket();
                  const stored = JSON.parse(localStorage.getItem('currentMatch') || '{}');
                  if (socket && stored.roomId) socket.emit('leave-match', { roomId: stored.roomId });
                  try { localStorage.removeItem('eventLog_' + (stored.roomId || 'default')); } catch { }
                  localStorage.removeItem('currentMatch');
                  sessionStorage.removeItem('currentTimer');
                  resetMatchState();
                  navigate('/matchmaking');
                }}
                className="w-full py-3 rounded-xl font-mono font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 16px rgba(220,38,38,0.3)' }}>
                Yes, Forfeit Match
              </button>
              <button onClick={() => setShowLeaveConfirm(false)}
                className="w-full py-3 rounded-xl font-mono font-bold text-sm transition-all hover:text-white"
                style={{ color: 'var(--lc-text-primary)', border: '1px solid var(--lc-border)', backgroundColor: 'transparent' }}>
                Stay in Match
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Arena;
