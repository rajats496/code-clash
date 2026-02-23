import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { getSocket } from '../services/socket';
import AppShell from '../components/layout/AppShell';

const Matchmaking = () => {
  const { user, logout, refreshUser } = useAuth();
  const { resetMatchState } = useMatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [inQueue, setInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate');
  const [selectedRounds, setSelectedRounds] = useState(null);
  const [matchTimer, setMatchTimer] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [onlineCount, setOnlineCount] = useState(null);

  // Private room state
  const [activeTab, setActiveTab] = useState(
    location.state?.tab === 'private' ? 'private' : 'ranked'
  ); // 'ranked' | 'private'
  const [privatePhase, setPrivatePhase] = useState('idle'); // 'idle' | 'creating' | 'waiting' | 'joining'
  const [myRoomCode, setMyRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const copyTimer = useRef(null);

  // Timer effect
  useEffect(() => {
    let interval;
    if (inQueue) {
      interval = setInterval(() => {
        setMatchTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [inQueue]);

  // Mount - clear old match data
  useEffect(() => {
    console.log('🧹 Matchmaking mounted - clearing old match data');
    localStorage.removeItem('currentMatch');
    sessionStorage.removeItem('currentTimer');
    resetMatchState();
    refreshUser();
  }, []);

  // Live player count
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCount = (data) => setOnlineCount(data.count);
    socket.on('player-count', handleCount);
    socket.on('user-online',  handleCount);
    socket.on('user-offline', handleCount);

    return () => {
      socket.off('player-count', handleCount);
      socket.off('user-online',  handleCount);
      socket.off('user-offline', handleCount);
    };
  }, []);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('queue-joined', (data) => {
      console.log('✅ Joined queue:', data);
      setInQueue(true);
      setQueuePosition(data.position);
      setMatchTimer(0);
    });

    socket.on('queue-left', (data) => {
      console.log('🚪 Left queue:', data);
      setInQueue(false);
      setQueuePosition(null);
      setMatchTimer(0);
    });

    socket.on('match-found', (data) => {
      console.log('🎮 Match found!', data);
      setInQueue(false);
      setPrivatePhase('idle');
      setMyRoomCode('');
      localStorage.removeItem('currentMatch');
      sessionStorage.removeItem('currentTimer');
      resetMatchState();
      localStorage.setItem('currentMatch', JSON.stringify(data));
      navigate('/arena');
    });

    // Private room events
    socket.on('private-room-created', ({ code, totalRounds }) => {
      setMyRoomCode(code);
      setPrivatePhase('waiting');
    });

    socket.on('private-room-cancelled', () => {
      setPrivatePhase('idle');
      setMyRoomCode('');
    });

    socket.on('private-room-expired', () => {
      setPrivatePhase('idle');
      setMyRoomCode('');
    });

    socket.on('error', (data) => {
      console.error('❌ Error:', data.message);
      if (data.message === 'Already in queue') {
        alert('⚠️ You are already in the matchmaking queue!');
      } else if (privatePhase === 'joining') {
        setJoinError(data.message);
        setPrivatePhase('idle');
      } else {
        alert(`❌ Error: ${data.message}`);
      }
      if (data.message !== 'Already in queue') {
        setInQueue(false);
      }
    });

    return () => {
      socket.off('queue-joined');
      socket.off('queue-left');
      socket.off('match-found');
      socket.off('private-room-created');
      socket.off('private-room-cancelled');
      socket.off('private-room-expired');
      socket.off('error');
    };
  }, [navigate, privatePhase]);

  // Handlers
  const handleJoinQueue = () => {
    const socket = getSocket();
    if (!socket) {
      alert('Socket not connected. Please refresh the page.');
      return;
    }
    
    // Show confirmation before joining
    console.log('📋 Joining queue with:', {
      rounds: selectedRounds,
      matchFormat: roundOptions.find(r => r.value === selectedRounds)?.label,
    });
    
    socket.emit('join-queue', { difficulty: selectedDifficulty, totalRounds: selectedRounds ?? 1 });
  };

  const handleLeaveQueue = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('leave-queue');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Private room handlers
  const handleCreateRoom = () => {
    const socket = getSocket();
    if (!socket) return;
    setPrivatePhase('creating');
    socket.emit('create-private-room', { totalRounds: selectedRounds ?? 1 });
  };

  const handleCancelRoom = () => {
    const socket = getSocket();
    if (!socket || !myRoomCode) return;
    socket.emit('cancel-private-room', { code: myRoomCode });
    setPrivatePhase('idle');
    setMyRoomCode('');
  };

  const handleJoinRoom = () => {
    const socket = getSocket();
    const code = joinCode.trim().toUpperCase();
    if (!socket || !code) { setJoinError('Enter a room code'); return; }
    setJoinError('');
    setPrivatePhase('joining');
    socket.emit('join-private-room', { code });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myRoomCode).catch(() => {});
    setCodeCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCodeCopied(false), 2000);
  };

  // Win rate calculation
  const winRate = user?.matchesPlayed
    ? ((user.matchesWon / user.matchesPlayed) * 100).toFixed(0)
    : 0;

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const difficulties = [
    { id: 'beginner', label: 'Beginner', icon: '🟢', desc: 'Basic fundamentals' },
    { id: 'intermediate', label: 'Intermediate', icon: '🟡', desc: 'Mid-level problems' },
    { id: 'advanced', label: 'Advanced', icon: '🔴', desc: 'Complex algorithms' },
    { id: 'expert', label: 'Expert', icon: '⚫', desc: 'High difficulty' },
  ];

  const roundOptions = [
    { value: 1, label: 'Quick 1v1', desc: 'Single question', icon: '⚡' },
    { value: 3, label: 'Best of 3', desc: 'Standard match', icon: '🔥' },
    { value: 5, label: 'Best of 5', desc: 'Epic showdown', icon: '🏆' },
    { value: 7, label: 'Best of 7', desc: 'Ultimate battle', icon: '🌟' },
  ];

  const toggleRounds = (val) => setSelectedRounds((prev) => (prev === val ? null : val));

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-4 pb-16">
        <div className="max-w-6xl mx-auto px-5 py-4">
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Code Clash Arena
                </h1>
                <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
                  Engage in real-time one-on-one coding battles. Select your difficulty and match format to find a worthy opponent instantly.
                </p>
              </div>
              <div className="hidden lg:flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
                </div>
                <div className="h-4 w-px bg-slate-600/50" />
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-emerald-400">
                    {onlineCount !== null ? onlineCount.toLocaleString() : '—'}
                  </span>
                  <span className="text-xs text-slate-500">players online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          {!inQueue && (
            <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-800/60 border border-slate-700/40 w-fit">
              <button
                onClick={() => setActiveTab('ranked')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'ranked'
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏆 Ranked Match
              </button>
              <button
                onClick={() => setActiveTab('private')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'private'
                    ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔒 Private Room
              </button>
            </div>
          )}

          {/* Main Content */}
          {inQueue ? (
            // Searching State
            <div className="space-y-4">
              {/* Main Searching Panel */}
              <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 backdrop-blur overflow-hidden">
                {/* Main Content */}
                <div className="p-10 text-center">
                  {/* Loading Indicator */}
                  <div className="mb-6 flex justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0s' }} />
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>

                  <h2 className="text-lg font-semibold text-slate-50 mb-2">Searching for opponent</h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Queued for <span className="font-medium text-slate-300">{roundOptions.find(r => r.value === selectedRounds)?.label}</span>
                  </p>

                  {/* Timer */}
                  <div className="mb-8">
                    <p className="text-3xl font-semibold text-slate-50 font-mono">
                      {formatTime(matchTimer)}
                    </p>
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={handleLeaveQueue}
                    className="px-4 py-2 rounded-md bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-all font-medium text-sm"
                  >
                    Leave Queue
                  </button>
                </div>
              </div>

              {/* Info Cards - Hidden during search for cleaner UI */}
              {/* Info Cards will be added back if needed */}
            </div>
          ) : (
            // Selection State
            <div className="space-y-6">

              {/* ══ PRIVATE ROOM TAB ══════════════════════════════════════════ */}
              {activeTab === 'private' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left column: Create + Join */}
                  <div className="lg:col-span-2 space-y-5">

                    {/* ── Waiting for friend (after room created) ─────────── */}
                    {privatePhase === 'waiting' ? (
                      <div className="lc-card rounded-xl border border-purple-500/40 bg-purple-900/10 p-8 text-center space-y-5 shadow-xl shadow-purple-500/10">
                        <div className="flex justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-3xl">🔒</div>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 mb-2">Share this code with your friend</p>
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-4xl font-black tracking-[0.35em] text-purple-300 font-mono bg-slate-900/60 px-6 py-3 rounded-xl border border-purple-500/30 select-all">
                              {myRoomCode}
                            </span>
                            <button
                              onClick={handleCopyCode}
                              className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                                codeCopied
                                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                                  : 'border-slate-600/50 bg-slate-800/50 text-slate-300 hover:border-purple-400/50 hover:text-purple-300'
                              }`}
                            >
                              {codeCopied ? '✓ Copied!' : '📋 Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                          Waiting for your friend to join...
                        </div>
                        <button
                          onClick={handleCancelRoom}
                          className="px-6 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-red-900/30 hover:border-red-500/40 hover:text-red-400 text-sm font-bold transition-all"
                        >
                          Cancel Room
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* ── Create a Room ────────────────────────────────── */}
                        <div className="lc-card rounded-xl border border-purple-500/30 bg-slate-800/40 p-6 space-y-4 shadow-lg">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-lg">🔒</div>
                            <div>
                              <h2 className="text-base font-bold text-slate-50">Create a Private Room</h2>
                              <p className="text-xs text-slate-400">Generate a 6-letter code and share it with a friend</p>
                            </div>
                          </div>

                  {/* Round selector - Private tab */}
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Match Format <span className="text-slate-500 normal-case">(click to select / deselect)</span></p>
                            <div className="grid grid-cols-2 gap-2">
                              {roundOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => toggleRounds(opt.value)}
                                  className={`p-3 rounded-lg border-2 transition-all text-center text-sm ${
                                    selectedRounds === opt.value
                                      ? 'border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/40 text-slate-50'
                                      : 'border-slate-700/50 hover:border-slate-600 bg-slate-800/30 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="text-xl mb-0.5">{opt.icon}</div>
                                  <div className="font-bold">{opt.label}</div>
                                  <div className="text-[11px] text-slate-500">{opt.value} question{opt.value > 1 ? 's' : ''}</div>
                                </button>
                              ))}
                            </div>
                            {!selectedRounds && (
                              <p className="text-[11px] text-amber-400/80 mt-2 text-center">⚠️ Select a format to create a room</p>
                            )}
                          </div>

                          <button
                            onClick={handleCreateRoom}
                            disabled={privatePhase === 'creating' || !selectedRounds}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {privatePhase === 'creating' ? '⏳ Creating...' : selectedRounds ? '🔒 Create Room & Get Code' : '— Select a format first —'}
                          </button>
                        </div>

                        {/* ── Join a Room ───────────────────────────────────── */}
                        <div className="lc-card rounded-xl border border-blue-500/30 bg-slate-800/40 p-6 space-y-4 shadow-lg">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-lg">🚪</div>
                            <div>
                              <h2 className="text-base font-bold text-slate-50">Join a Room</h2>
                              <p className="text-xs text-slate-400">Enter the 6-letter code shared by your friend</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={joinCode}
                              onChange={(e) => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(''); }}
                              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                              placeholder="XXXXXX"
                              maxLength={6}
                              className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-center text-2xl font-black font-mono tracking-[0.3em] text-blue-200 placeholder-slate-600 focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 uppercase transition-all"
                            />
                            <button
                              onClick={handleJoinRoom}
                              disabled={joinCode.length < 6 || privatePhase === 'joining'}
                              className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {privatePhase === 'joining' ? '⏳' : '→ Join'}
                            </button>
                          </div>

                          {joinError && (
                            <p className="text-xs font-semibold text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                              ⚠️ {joinError}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right column: Stats (same as ranked) */}
                  <div className="space-y-4">
                    <div className="lc-card p-4 rounded-lg border border-slate-700/50 backdrop-blur bg-slate-800/40 shadow-lg hover:shadow-xl transition-all">
                      <h3 className="text-xs font-bold mb-4 text-slate-50 uppercase tracking-wider flex items-center gap-2">
                        <span>📊</span> Profile Stats
                      </h3>
                      <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-600/10 border border-purple-500/30">
                          <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-1">Rating</p>
                          <p className="text-2xl font-black text-purple-400">{user?.rating || 1200}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 text-center">
                            <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Matches</p>
                            <p className="text-lg font-black text-blue-400">{user?.matchesPlayed || 0}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 text-center">
                            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Wins</p>
                            <p className="text-lg font-black text-emerald-400">{user?.matchesWon || 0}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Win Rate</p>
                          <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${winRate}%` }} />
                          </div>
                          <p className="text-right text-sm font-bold text-purple-400">{winRate}%</p>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Link to="/history" className="flex-1 lc-nav-link border border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/70 rounded-lg py-1 px-2 text-xs font-bold text-center transition-all hover:border-blue-500/50 text-slate-300 hover:text-blue-300">📜 History</Link>
                          <Link to="/profile" className="flex-1 lc-nav-link border border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/70 rounded-lg py-1 px-2 text-xs font-bold text-center transition-all hover:border-slate-600 text-slate-300 hover:text-slate-100">👤 Profile</Link>
                        </div>
                      </div>
                    </div>
                    <div className="lc-card p-4 rounded-lg bg-gradient-to-r from-purple-600/15 via-blue-600/15 to-purple-600/15 border border-purple-500/30 text-center">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        🔒 <span className="font-semibold text-purple-300">Private matches</span> do not affect your rating — perfect for practice with friends!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ RANKED TAB ════════════════════════════════════════════════ */}
              {activeTab === 'ranked' && (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Selection Panel */}
              <div className="lg:col-span-2 space-y-6">
                  {/* ── Number of Questions Selector ── */}
                <div className="lc-card p-6 rounded-xl border border-slate-700/50 backdrop-blur bg-slate-800/40 shadow-lg hover:shadow-xl transition-all">
                  <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-slate-50">
                    <span className="text-2xl">🎮</span> Match Format
                  </h2>
                  <p className="text-slate-400 mb-4 text-sm leading-relaxed">Choose how many rounds — click again to deselect</p>

                  <div className="grid grid-cols-2 gap-3">
                    {roundOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => toggleRounds(opt.value)}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 text-center group ${selectedRounds === opt.value
                            ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20'
                            : 'border-slate-700/50 hover:border-slate-600/80 bg-slate-800/30 hover:bg-slate-800/50'
                          }`}
                      >
                        <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">{opt.icon}</div>
                        <div className="font-bold text-base text-slate-50 mb-1">{opt.label}</div>
                        <div className="text-xs text-slate-400 mb-1">{opt.desc}</div>
                        <div className="text-xs font-mono text-slate-500 bg-slate-900/50 rounded px-2 py-1 inline-block">
                          {opt.value} question{opt.value > 1 ? 's' : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                  {!selectedRounds && (
                    <p className="text-[11px] text-amber-400/80 mt-3 text-center">⚠️ Select a format to join queue</p>
                  )}
                </div>

                {/* Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="lc-card p-4 rounded-lg border border-slate-700/50 bg-slate-800/40 backdrop-blur border-l-4 border-l-orange-500 hover:shadow-lg transition-all">
                    <h3 className="font-bold text-slate-50 mb-1 text-sm flex items-center gap-2">⚡ Lightning Fast Matching</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">Average wait time under 30 seconds. Skip the queue and start competing.</p>
                  </div>
                  <div className="lc-card p-4 rounded-lg border border-slate-700/50 bg-slate-800/40 backdrop-blur border-l-4 border-l-blue-500 hover:shadow-lg transition-all">
                    <h3 className="font-bold text-slate-50 mb-1 text-sm flex items-center gap-2">🏆 Competitive Ranking</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">Climb the global leaderboard and earn prestigious badges as you win.</p>
                  </div>
                </div>

                {/* Join Button */}
                <button
                  onClick={handleJoinQueue}
                  disabled={!selectedRounds}
                  className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 hover:from-orange-600 hover:via-orange-700 hover:to-red-700 text-white rounded-lg text-base py-3 font-bold shadow-2xl hover:shadow-orange-500/50 transition-all active:scale-95 border border-orange-400/40 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span className="text-lg group-hover:scale-110 transition-transform">🚀</span>
                    {selectedRounds ? `Enter Queue — ${roundOptions.find(r => r.value === selectedRounds)?.label}` : '— Select a format above —'}
                    {selectedRounds && <span className="text-lg group-hover:scale-110 transition-transform">⚡</span>}
                  </span>
                  <span className="absolute inset-0 -z-10 bg-gradient-to-r from-orange-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Stats Card */}
                <div className="lc-card p-4 rounded-lg border border-slate-700/50 backdrop-blur bg-slate-800/40 shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-xs font-bold mb-4 text-slate-50 uppercase tracking-wider flex items-center gap-2">
                    <span>📊</span> Profile Stats
                  </h3>

                  <div className="space-y-4">
                    {/* Rating */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/30">
                      <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-1">Rating</p>
                      <p className="text-2xl font-black text-orange-400">{user?.rating || 1200}</p>
                    </div>

                    {/* Matches & Wins Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 text-center">
                        <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Matches</p>
                        <p className="text-lg font-black text-blue-400">{user?.matchesPlayed || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 text-center">
                        <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Wins</p>
                        <p className="text-lg font-black text-emerald-400">{user?.matchesWon || 0}</p>
                      </div>
                    </div>

                    {/* Win Rate */}
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Win Rate</p>
                      <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 h-full rounded-full shadow-lg shadow-orange-500/50 transition-all duration-500"
                          style={{ width: `${winRate}%` }}
                        />
                      </div>
                      <p className="text-right text-sm font-bold text-orange-400">{winRate}%</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Link to="/history" className="flex-1 lc-nav-link border border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/70 rounded-lg py-1 px-2 text-xs font-bold text-center transition-all hover:border-blue-500/50 text-slate-300 hover:text-blue-300">
                        📜 History
                      </Link>
                      <Link to="/profile" className="flex-1 lc-nav-link border border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/70 rounded-lg py-1 px-2 text-xs font-bold text-center transition-all hover:border-slate-600 text-slate-300 hover:text-slate-100">
                        👤 Profile
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips - Full Width */}
            <div className="lc-card p-4 rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border border-blue-500/50 backdrop-blur hover:shadow-2xl hover:shadow-blue-500/20 transition-all shadow-lg text-center">
              <p className="text-xs text-slate-300 leading-relaxed">
                💡 <span className="font-semibold text-blue-300">Strategy Guide:</span> Best of 3 is the optimal choice for competitive play. Secure 2 wins to claim victory and earn valuable rating points.
              </p>
            </div>
              </>
              )} {/* end activeTab === 'ranked' */}
            </div>
          )}
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="lc-card rounded-2xl border border-slate-700/50 w-full max-w-sm p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-3 text-slate-50">Log out?</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to log out?
              {inQueue && (
                <span className="block mt-3 text-orange-400 font-semibold">
                  ⚠️ You'll be removed from the matching queue.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-6 py-2 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (inQueue) handleLeaveQueue();
                  handleLogout();
                }}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors font-bold"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Matchmaking;
