import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import { getSocket } from '../../services/socket';

const ROUND_OPTIONS = [
  { value: 1, label: '1v1', full: 'Quick 1v1', icon: '⚡' },
  { value: 3, label: 'Bo3', full: 'Best of 3', icon: '🔥' },
  { value: 5, label: 'Bo5', full: 'Best of 5', icon: '🏆' },
  { value: 7, label: 'Bo7', full: 'Best of 7', icon: '🌟' },
];

const PrivateRoomCard = () => {
  const { isAuthenticated } = useAuth();
  const { resetMatchState } = useMatch();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('idle'); // 'idle' | 'creating' | 'waiting' | 'joining'
  const [selectedRounds, setSelectedRounds] = useState(1);
  const [myCode, setMyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('create'); // 'create' | 'join'
  const copyTimer = useRef(null);

  // Queue timer tick
  // (removed — no public queue in this card)

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCreated = ({ code }) => { setMyCode(code); setPhase('waiting'); };
    const onCancelled = () => { setPhase('idle'); setMyCode(''); };
    const onExpired = () => { setPhase('idle'); setMyCode(''); };
    const onMatchFound = (data) => {
      setPhase('idle');
      setMyCode('');
      localStorage.removeItem('currentMatch');
      sessionStorage.removeItem('currentTimer');
      resetMatchState();
      localStorage.setItem('currentMatch', JSON.stringify(data));
      navigate('/arena');
    };
    const onError = (data) => {
      if (phase === 'joining') { setJoinError(data.message); setPhase('idle'); }
    };

    socket.on('private-room-created', onCreated);
    socket.on('private-room-cancelled', onCancelled);
    socket.on('private-room-expired', onExpired);
    socket.on('match-found', onMatchFound);
    socket.on('error', onError);

    return () => {
      socket.off('private-room-created', onCreated);
      socket.off('private-room-cancelled', onCancelled);
      socket.off('private-room-expired', onExpired);
      socket.off('match-found', onMatchFound);
      socket.off('error', onError);
    };
  }, [phase, navigate, resetMatchState]);

  const handleCreate = () => {
    const socket = getSocket();
    if (!socket) return;
    setPhase('creating');
    socket.emit('create-private-room', { totalRounds: selectedRounds });
  };

  const handleCancel = () => {
    const socket = getSocket();
    if (socket && myCode) socket.emit('cancel-private-room', { code: myCode });
    setPhase('idle');
    setMyCode('');
  };

  const handleJoin = () => {
    const socket = getSocket();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 6) { setJoinError('Enter a 6-letter code'); return; }
    setJoinError('');
    setPhase('joining');
    socket.emit('join-private-room', { code });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(myCode).catch(() => {});
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="lc-card rounded-xl border border-[var(--lc-border)] p-6 text-center space-y-3">
        <div className="text-3xl">⚡</div>
        <p className="text-sm font-semibold text-[var(--lc-text-bright)]">Quick Match</p>
        <p className="text-xs text-[var(--lc-text-primary)]">Sign in to jump into a 1v1 match or create a private room.</p>
      </div>
    );
  }

  /* ── Waiting for friend ───────────────────────────────── */
  if (phase === 'waiting') {
    return (
      <div className="lc-card rounded-xl border border-purple-500/40 bg-purple-900/10 p-6 space-y-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-2xl">🔒</div>
          <h3 className="text-base font-bold text-[var(--lc-text-bright)]">Room Created!</h3>
          <p className="text-xs text-[var(--lc-text-primary)]">Share this code with your friend</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-black tracking-[0.3em] font-mono text-purple-300 bg-slate-900/60 px-5 py-2.5 rounded-xl border border-purple-500/30 select-all">
            {myCode}
          </span>
          <button
            onClick={handleCopy}
            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              copied
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                : 'border-slate-600/50 bg-slate-800/50 text-slate-300 hover:border-purple-400/50 hover:text-purple-300'
            }`}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--lc-text-primary)]">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Waiting for friend to join...
        </div>
        <button
          onClick={handleCancel}
          className="w-full py-2 rounded-lg bg-slate-700/50 border border-slate-600/40 text-slate-300 hover:bg-red-900/30 hover:border-red-500/40 hover:text-red-400 text-xs font-bold transition-all"
        >
          Cancel Room
        </button>
      </div>
    );
  }

  /* ── Idle / Main view ─────────────────────────────────── */
  return (
    <div className="lc-card rounded-xl border border-[var(--lc-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔒</span>
          <h3 className="text-sm font-bold text-[var(--lc-text-bright)]">Private Room</h3>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="px-5 pb-3">
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--lc-bg)] border border-[var(--lc-border)]">
          <button
            onClick={() => { setView('create'); setJoinError(''); }}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
              view === 'create'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow'
                : 'text-[var(--lc-text-primary)] hover:text-[var(--lc-text-bright)]'
            }`}
          >
            ✦ Create
          </button>
          <button
            onClick={() => { setView('join'); setJoinError(''); }}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
              view === 'join'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
                : 'text-[var(--lc-text-primary)] hover:text-[var(--lc-text-bright)]'
            }`}
          >
            → Join
          </button>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {view === 'create' && (
          <>
            {/* Round picker — 2×2 grid */}
            <div className="grid grid-cols-2 gap-2">
              {ROUND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedRounds(opt.value)}
                  className={`py-2 rounded-lg border text-center text-xs font-bold transition-all ${
                    selectedRounds === opt.value
                      ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                      : 'border-[var(--lc-border)] text-[var(--lc-text-primary)] hover:border-purple-400/50 hover:text-purple-300'
                  }`}
                >
                  <div className="text-base">{opt.icon}</div>
                  <div>{opt.label}</div>
                  <div className="text-[10px] opacity-70">{opt.full}</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={phase === 'creating'}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {phase === 'creating' ? '⏳ Creating...' : '🔒 Create Room & Get Code'}
            </button>
          </>
        )}

        {view === 'join' && (
          <>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full bg-[var(--lc-bg)] border border-[var(--lc-border)] rounded-xl px-4 py-2.5 text-center text-xl font-black font-mono tracking-[0.3em] text-blue-300 placeholder-slate-600 focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 uppercase transition-all"
            />
            {joinError && (
              <p className="text-[11px] font-semibold text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-1.5">
                ⚠️ {joinError}
              </p>
            )}
            <button
              onClick={handleJoin}
              disabled={joinCode.length < 6 || phase === 'joining'}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === 'joining' ? '⏳ Joining...' : '→ Join Room'}
            </button>
          </>
        )}

        <p className="text-[10px] text-center text-[var(--lc-text-primary)]/60">
          Private matches don&apos;t affect your rating
        </p>
      </div>
    </div>
  );
};

export default PrivateRoomCard;
