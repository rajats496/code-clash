import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';

// ─── helpers ──────────────────────────────────────────────────────────────────
const api = (path, token, opts = {}) =>
  fetch(path, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...opts });

const Avatar = ({ user, size = 9 }) => {
  const sz = `w-${size} h-${size}`;
  if (user?.picture) {
    return (
      <img
        src={user.picture}
        alt={user.name}
        className={`${sz} rounded-full object-cover border border-slate-600/50 flex-shrink-0`}
      />
    );
  }
  const initials = (user?.name || '??').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 border border-slate-600/50`}>
      {initials}
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────
const FriendsList = () => {
  const { token, isAuthenticated } = useAuth();

  const [friends,       setFriends]       = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [panel,         setPanel]         = useState('friends'); // 'friends' | 'add' | 'requests'
  const [loading,       setLoading]       = useState(false);
  const [searchQ,       setSearchQ]       = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const searchTimer                       = useRef(null);
  const [busy,          setBusy]          = useState(new Set());
  const addBusy  = (id) => setBusy((s) => new Set([...s, id]));
  const dropBusy = (id) => setBusy((s) => { const n = new Set(s); n.delete(id); return n; });

  // ── fetch friends + requests ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [fRes, rRes] = await Promise.all([
        api('/api/users/friends', token),
        api('/api/users/friends/requests', token),
      ]);
      const [fData, rData] = await Promise.all([fRes.json(), rRes.json()]);
      if (fData.success) setFriends(fData.friends);
      if (rData.success) setRequests(rData.requests);
    } catch (_) { /* silent */ }
    finally     { setLoading(false); }
  }, [token]);

  useEffect(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, loadData]);

  // ── real-time online/offline updates ─────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onOnline  = ({ userId }) =>
      setFriends((prev) => prev.map((f) => f._id === userId ? { ...f, isOnline: true  } : f));
    const onOffline = ({ userId }) =>
      setFriends((prev) => prev.map((f) => f._id === userId ? { ...f, isOnline: false } : f));

    socket.on('user-online',  onOnline);
    socket.on('user-offline', onOffline);
    return () => {
      socket.off('user-online',  onOnline);
      socket.off('user-offline', onOffline);
    };
  }, []);

  // ── debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res  = await api(`/api/users/search?q=${encodeURIComponent(searchQ.trim())}`, token);
        const data = await res.json();
        if (data.success) setSearchResults(data.users);
      } catch (_) { /* silent */ }
      finally    { setSearching(false); }
    }, 400);
  }, [searchQ, token]);

  // ── actions ──────────────────────────────────────────────────────────────
  const sendRequest = async (targetId) => {
    addBusy(targetId);
    try {
      const res  = await api(`/api/users/friends/request/${targetId}`, token, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSearchResults((prev) =>
          prev.map((u) =>
            u._id === targetId
              ? { ...u, relation: data.message.includes('friends') ? 'friends' : 'requested' }
              : u
          )
        );
        if (data.message.includes('friends')) loadData();
      }
    } catch (_) { /* silent */ }
    finally     { dropBusy(targetId); }
  };

  const acceptRequest = async (fromId) => {
    addBusy(fromId);
    try {
      const res  = await api(`/api/users/friends/accept/${fromId}`, token, { method: 'POST' });
      const data = await res.json();
      if (data.success) { setRequests((prev) => prev.filter((r) => r.from._id !== fromId)); loadData(); }
    } catch (_) { /* silent */ }
    finally     { dropBusy(fromId); }
  };

  const declineRequest = async (fromId) => {
    addBusy(fromId);
    try {
      const res  = await api(`/api/users/friends/decline/${fromId}`, token, { method: 'POST' });
      const data = await res.json();
      if (data.success) setRequests((prev) => prev.filter((r) => r.from._id !== fromId));
    } catch (_) { /* silent */ }
    finally     { dropBusy(fromId); }
  };

  const removeFriend = async (friendId) => {
    addBusy(friendId);
    try {
      const res  = await api(`/api/users/friends/${friendId}`, token, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setFriends((prev) => prev.filter((f) => f._id !== friendId));
    } catch (_) { /* silent */ }
    finally     { dropBusy(friendId); }
  };

  const onlineCount = friends.filter((f) => f.isOnline).length;

  if (!isAuthenticated) {
    return (
      <div className="lc-card rounded-xl border border-[var(--lc-border)] p-6 text-center">
        <p className="text-sm text-[var(--lc-text-primary)]">Sign in to see your friends.</p>
      </div>
    );
  }

  return (
    <div className="lc-card rounded-xl border border-[var(--lc-border)] overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 py-3.5 border-b border-[var(--lc-border)] flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--lc-text-bright)] flex-1">Friends</h3>

        {onlineCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-900/30 border-emerald-500/40 text-emerald-400">
            {onlineCount} online
          </span>
        )}

        {/* Requests button */}
        <button
          onClick={() => setPanel(panel === 'requests' ? 'friends' : 'requests')}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
            panel === 'requests'
              ? 'border-orange-500/50 bg-orange-900/20 text-orange-300'
              : 'border-[var(--lc-border)] text-[var(--lc-text-primary)] hover:border-orange-400/50 hover:text-orange-300'
          }`}
        >
          🔔 Requests
          {requests.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-orange-500 text-[9px] font-black text-white flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>

        {/* Add friend button */}
        <button
          onClick={() => { setPanel(panel === 'add' ? 'friends' : 'add'); setSearchQ(''); setSearchResults([]); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
            panel === 'add'
              ? 'border-blue-500/50 bg-blue-900/20 text-blue-300'
              : 'border-[var(--lc-border)] text-[var(--lc-text-primary)] hover:border-blue-400/50 hover:text-blue-300'
          }`}
        >
          + Add Friend
        </button>

        {/* Refresh */}
        <button
          onClick={loadData}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--lc-border)] text-[var(--lc-text-primary)] hover:border-blue-400/50 hover:text-blue-300 transition-all"
          title="Refresh"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* ── Body (2-col on desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[var(--lc-border)]">

        {/* Left: Friends list */}
        <div className="lg:col-span-2 p-4">
          {loading && friends.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-t-transparent border-blue-400 rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <span className="text-4xl">👥</span>
              <p className="text-sm font-semibold text-[var(--lc-text-bright)]">No friends yet</p>
              <p className="text-xs text-[var(--lc-text-primary)] max-w-xs">
                Use <strong>+ Add Friend</strong> above to find and connect with other coders!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {friends.map((f) => (
                <FriendRow
                  key={f._id}
                  friend={f}
                  busy={busy.has(f._id)}
                  onRemove={() => removeFriend(f._id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="p-4">
          {panel === 'friends' && <FriendsStats friends={friends} />}
          {panel === 'add' && (
            <AddFriendPanel
              searchQ={searchQ}
              setSearchQ={setSearchQ}
              results={searchResults}
              searching={searching}
              busy={busy}
              onSendRequest={sendRequest}
            />
          )}
          {panel === 'requests' && (
            <RequestsPanel
              requests={requests}
              busy={busy}
              onAccept={acceptRequest}
              onDecline={declineRequest}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── FriendRow ────────────────────────────────────────────────────────────────
const FriendRow = ({ friend, busy, onRemove }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => { if (!menuRef.current?.contains(e.target)) setShowMenu(false); };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const winRate = friend.matchesPlayed
    ? ((friend.matchesWon / friend.matchesPlayed) * 100).toFixed(0)
    : 0;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all group ${
        friend.isOnline
          ? 'border-emerald-500/20 bg-emerald-900/5 hover:border-emerald-400/40 hover:bg-emerald-900/15'
          : 'border-[var(--lc-border)] hover:border-slate-500/50 hover:bg-slate-700/20'
      }`}
    >
      {/* Avatar + dot */}
      <div className="relative flex-shrink-0">
        <Avatar user={friend} size={9} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--lc-card)] ${
            friend.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--lc-text-bright)] truncate">{friend.name}</p>
        <p className="text-[10px] text-[var(--lc-text-primary)]">
          {friend.isOnline
            ? <span className="text-emerald-400">● Online</span>
            : <span>⚡ {friend.rating ?? 1200}  ·  {winRate}% WR</span>
          }
        </p>
      </div>

      {/* Menu */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--lc-text-primary)] hover:text-[var(--lc-text-bright)] hover:bg-slate-700/50 transition-all opacity-0 group-hover:opacity-100 text-lg leading-none"
        >
          ⋯
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--lc-card)] border border-[var(--lc-border)] rounded-xl shadow-xl overflow-hidden min-w-[130px]">
            <button
              onClick={() => { setShowMenu(false); onRemove(); }}
              disabled={busy}
              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {busy
                ? <span className="w-3 h-3 border border-t-transparent border-red-400 rounded-full animate-spin" />
                : '🗑'
              }
              Remove Friend
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AddFriendPanel ───────────────────────────────────────────────────────────
const RELATION = {
  none:      { label: '+ Add',        cls: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-blue-400/40 hover:from-blue-500' },
  requested: { label: '✓ Sent',       cls: 'bg-slate-700/60 text-slate-400 border-slate-600/40 cursor-not-allowed' },
  incoming:  { label: '↓ Accept',     cls: 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-400/40 hover:from-emerald-500' },
  friends:   { label: '✓ Friends',    cls: 'bg-emerald-900/30 text-emerald-400 border-emerald-500/40 cursor-not-allowed' },
};

const AddFriendPanel = ({ searchQ, setSearchQ, results, searching, busy, onSendRequest }) => (
  <div className="space-y-3">
    <p className="text-xs font-bold text-[var(--lc-text-bright)]">Search Players</p>

    <div className="relative">
      <input
        type="text"
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        placeholder="Name or email…"
        autoFocus
        className="w-full bg-[var(--lc-bg)] border border-[var(--lc-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--lc-text-bright)] placeholder-slate-500 focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 transition-all pr-8"
      />
      {searching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="w-4 h-4 border-2 border-t-transparent border-blue-400 rounded-full animate-spin block" />
        </div>
      )}
      {!searching && searchQ && (
        <button
          onClick={() => setSearchQ('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xl leading-none"
        >
          ×
        </button>
      )}
    </div>

    {searchQ.trim().length === 1 && (
      <p className="text-[11px] text-[var(--lc-text-primary)] text-center">Type 1 more character…</p>
    )}

    {searchQ.trim().length >= 2 && !searching && results.length === 0 && (
      <p className="text-center text-xs text-[var(--lc-text-primary)] py-4">No users found for &ldquo;{searchQ}&rdquo;.</p>
    )}

    <div className="space-y-2 max-h-60 overflow-y-auto">
      {results.map((u) => {
        const rel    = RELATION[u.relation] || RELATION.none;
        const isBusy = busy.has(u._id);
        const canAct = u.relation === 'none' || u.relation === 'incoming';
        return (
          <div key={u._id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-bg)] hover:border-blue-500/30 transition-all">
            <Avatar user={u} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--lc-text-bright)] truncate">{u.name}</p>
              <p className="text-[10px] text-[var(--lc-text-primary)]">⚡ {u.rating ?? 1200} pts</p>
            </div>
            <button
              onClick={() => canAct && onSendRequest(u._id)}
              disabled={isBusy || !canAct}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all flex-shrink-0 ${rel.cls} disabled:opacity-70`}
            >
              {isBusy
                ? <span className="w-3 h-3 border border-t-transparent border-current rounded-full animate-spin block mx-auto" />
                : rel.label
              }
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── RequestsPanel ────────────────────────────────────────────────────────────
const RequestsPanel = ({ requests, busy, onAccept, onDecline }) => (
  <div className="space-y-3">
    <p className="text-xs font-bold text-[var(--lc-text-bright)]">
      Friend Requests
      {requests.length > 0 && (
        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[10px]">
          {requests.length}
        </span>
      )}
    </p>

    {requests.length === 0 ? (
      <div className="text-center py-8 space-y-2">
        <p className="text-2xl">📭</p>
        <p className="text-xs text-[var(--lc-text-primary)]">No pending requests.</p>
      </div>
    ) : (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {requests.map((req) => {
          const from   = req.from || {};
          const fromId = from._id;
          const isBusy = busy.has(fromId);
          return (
            <div key={fromId} className="rounded-xl border border-orange-500/20 bg-orange-900/5 p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <Avatar user={from} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--lc-text-bright)] truncate">{from.name}</p>
                  <p className="text-[10px] text-[var(--lc-text-primary)]">⚡ {from.rating ?? 1200} pts</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAccept(fromId)}
                  disabled={isBusy}
                  className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white text-[10px] font-bold border border-emerald-400/40 transition-all disabled:opacity-60 flex items-center justify-center"
                >
                  {isBusy
                    ? <span className="w-3 h-3 border border-t-transparent border-white rounded-full animate-spin block" />
                    : '✓ Accept'
                  }
                </button>
                <button
                  onClick={() => onDecline(fromId)}
                  disabled={isBusy}
                  className="flex-1 py-1.5 rounded-lg bg-slate-700/50 hover:bg-red-900/30 hover:border-red-500/40 hover:text-red-400 text-slate-300 text-[10px] font-bold border border-slate-600/40 transition-all disabled:opacity-60"
                >
                  ✕ Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ─── FriendsStats ─────────────────────────────────────────────────────────────
const FriendsStats = ({ friends }) => {
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="text-3xl">🚀</span>
        <p className="text-xs font-bold text-[var(--lc-text-bright)]">Grow your circle!</p>
        <p className="text-[11px] text-[var(--lc-text-primary)]">
          Add friends to compare ratings and challenge each other to private rooms.
        </p>
      </div>
    );
  }

  const topFriend  = [...friends].sort((a, b) => (b.rating ?? 1200) - (a.rating ?? 1200))[0];
  const avgRating  = Math.round(friends.reduce((s, f) => s + (f.rating ?? 1200), 0) / friends.length);
  const onlineNow  = friends.filter((f) => f.isOnline).length;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-[var(--lc-text-bright)]">Social Stats</p>
      <div className="space-y-2">
        {[
          { icon: '👥', label: 'Total Friends', value: friends.length },
          { icon: '🟢', label: 'Online Now',    value: onlineNow },
          { icon: '⚡', label: 'Avg Rating',    value: avgRating },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg)]">
            <span className="text-xs text-[var(--lc-text-primary)] flex items-center gap-1.5">
              <span>{s.icon}</span>{s.label}
            </span>
            <span className="text-xs font-bold text-[var(--lc-text-bright)]">{s.value}</span>
          </div>
        ))}
      </div>

      {topFriend && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-900/5 p-3 flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-black border border-slate-600/50 overflow-hidden">
              {topFriend.picture
                ? <img src={topFriend.picture} alt={topFriend.name} className="w-full h-full object-cover" />
                : topFriend.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              }
            </div>
            <span className="absolute -top-1 -right-1 text-xs">👑</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[var(--lc-text-primary)]">Top rated friend</p>
            <p className="text-xs font-bold text-[var(--lc-text-bright)] truncate">{topFriend.name}</p>
          </div>
          <span className="text-xs font-black text-yellow-400">⚡ {topFriend.rating ?? 1200}</span>
        </div>
      )}
    </div>
  );
};

export default FriendsList;
