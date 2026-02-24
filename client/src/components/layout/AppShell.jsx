import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import '../../App.css';

const AppShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, token } = useAuth();
  const { chatNotifications, clearChatNotifications, dismissChatNotification } = useMatch();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ subject: '', description: '' });
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [busyFR, setBusyFR] = useState(new Set()); // friend-request IDs being actioned

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close settings on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setReportOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.subject.trim() || !reportForm.description.trim()) return;
    setReportSending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: reportForm.subject,
          description: reportForm.description,
          reporterEmail: user?.email || null,
          reporterName: user?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setReportSent(true);
      setTimeout(() => {
        setReportOpen(false);
        setReportSent(false);
        setReportForm({ subject: '', description: '' });
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to submit report: ' + err.message);
    }
    setReportSending(false);
  };

  const handleLogout = () => {
    setSettingsOpen(false);
    setLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  const handleBellClick = () => {
    setNotifOpen((prev) => !prev);
  };

  const handleNotifClick = (e, id, roomId) => {
    e.stopPropagation();
    dismissChatNotification(id);
    setNotifOpen(false);
    navigate('/history', { state: { openChatRoomId: roomId } });
  };

  const handleFriendRequest = async (e, notifId, fromId, action) => {
    e.stopPropagation();
    setBusyFR((s) => new Set([...s, notifId]));
    try {
      await fetch(`/api/users/friends/${action}/${fromId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch (_) { /* silent */ }
    dismissChatNotification(notifId);
    setBusyFR((s) => { const n = new Set(s); n.delete(notifId); return n; });
  };

  const formatTime = (sentAt) => {
    if (!sentAt) return '';
    const d = new Date(sentAt);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const navItems = [
    { to: '/', label: 'Explore' },
    { to: '/matchmaking', label: 'Join Clash', auth: true },
    { to: '/contests', label: 'Contests' },
    { to: '/tournament', label: 'Tournament', auth: true },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/history', label: 'History', auth: true },
    { to: '/friends', label: 'Friends', auth: true },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--lc-bg)', color: 'var(--lc-text-primary)' }}>
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 h-12 flex items-center px-4 justify-between border-b"
        style={{ backgroundColor: 'var(--lc-nav)', borderColor: 'var(--lc-border)' }}>
        {/* Left: logo + nav links */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="material-symbols-outlined text-2xl font-bold" style={{ color: 'var(--lc-accent-orange)' }}>
              code_blocks
            </span>
            <span className="text-white font-bold text-lg tracking-tight">Code Clash</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              if (item.auth && !isAuthenticated) return null;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`lc-nav-link ${isActive(item.to) ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: search, notifications, settings, avatar */}
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              search
            </span>
            <input
              type="text"
              placeholder="Search..."
              className="bg-[#3e3e3e] border-none rounded-md py-1 pl-8 pr-3 text-xs w-48 focus:ring-1 focus:ring-[var(--lc-accent-orange)] outline-none text-white"
            />
          </div>

          <button
            ref={notifRef}
            onClick={handleBellClick}
            className="relative text-gray-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {chatNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white px-1 ring-2 ring-[var(--lc-nav)]">
                {chatNotifications.length > 9 ? '9+' : chatNotifications.length}
              </span>
            )}

            {/* Dropdown */}
            {notifOpen && (
              <div
                className="absolute right-0 top-8 w-80 rounded-xl border shadow-2xl z-[999] overflow-hidden"
                style={{ backgroundColor: 'var(--lc-card)', borderColor: 'var(--lc-border)' }}
              >
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--lc-border)' }}>
                  <span className="text-sm font-bold text-white">Notifications</span>
                  {chatNotifications.length > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      {chatNotifications.length} new
                    </span>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto">
                  {chatNotifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <span className="text-3xl block mb-2">🔔</span>
                      <p className="text-xs text-[var(--lc-text-primary)]">No new notifications</p>
                    </div>
                  ) : (
                    [...chatNotifications].reverse().map((n) => {

                      /* ── Friend request ── */
                      if (n.type === 'friend-request') {
                        const isBusy = busyFR.has(n.id);
                        return (
                          <div
                            key={n.id}
                            className="px-4 py-3 border-b"
                            style={{ borderColor: 'var(--lc-border)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 overflow-hidden">
                                {n.senderPicture
                                  ? <img src={n.senderPicture} alt={n.senderName} className="w-full h-full object-cover" />
                                  : (n.senderName?.[0] || '?').toUpperCase()
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-white truncate">{n.senderName}</span>
                                  <span className="text-[10px] text-[var(--lc-text-primary)] flex-shrink-0">{formatTime(n.sentAt)}</span>
                                </div>
                                <p className="text-xs text-[var(--lc-text-primary)] mt-0.5 flex items-center gap-1">
                                  <span>👥</span>
                                  <span>Sent you a friend request</span>
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    disabled={isBusy}
                                    onClick={(e) => handleFriendRequest(e, n.id, n.fromId, 'accept')}
                                    className="flex-1 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white text-[10px] font-bold border border-emerald-400/40 transition-all disabled:opacity-60 flex items-center justify-center"
                                  >
                                    {isBusy
                                      ? <span className="w-3 h-3 border border-t-transparent border-white rounded-full animate-spin block" />
                                      : '✓ Accept'
                                    }
                                  </button>
                                  <button
                                    disabled={isBusy}
                                    onClick={(e) => handleFriendRequest(e, n.id, n.fromId, 'decline')}
                                    className="flex-1 py-1 rounded-lg bg-slate-700/50 hover:bg-red-900/30 hover:border-red-500/40 hover:text-red-400 text-slate-300 text-[10px] font-bold border border-slate-600/40 transition-all disabled:opacity-60"
                                  >
                                    ✕ Decline
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      /* ── Friend accepted ── */
                      if (n.type === 'friend-accepted') {
                        return (
                          <div
                            key={n.id}
                            onClick={(e) => { e.stopPropagation(); dismissChatNotification(n.id); }}
                            className="px-4 py-3 border-b hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10"
                            style={{ borderColor: 'var(--lc-border)' }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 overflow-hidden">
                                {n.senderPicture
                                  ? <img src={n.senderPicture} alt={n.senderName} className="w-full h-full object-cover" />
                                  : (n.senderName?.[0] || '?').toUpperCase()
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-white truncate">{n.senderName}</span>
                                  <span className="text-[10px] text-[var(--lc-text-primary)] flex-shrink-0">{formatTime(n.sentAt)}</span>
                                </div>
                                <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                                  <span>✅</span>
                                  <span>Accepted your friend request!</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      /* ── Chat message (default) ── */
                      return (
                        <div
                          key={n.id}
                          onClick={(e) => handleNotifClick(e, n.id, n.roomId)}
                          className="px-4 py-3 border-b hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10"
                          style={{ borderColor: 'var(--lc-border)' }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 overflow-hidden">
                              {n.senderPicture
                                ? <img src={n.senderPicture} alt={n.senderName} className="w-full h-full object-cover" />
                                : (n.senderName?.[0] || '?').toUpperCase()
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-white truncate">{n.senderName}</span>
                                <span className="text-[10px] text-[var(--lc-text-primary)] flex-shrink-0">{formatTime(n.sentAt)}</span>
                              </div>
                              <p className="text-xs text-[var(--lc-text-primary)] mt-0.5 flex items-center gap-1">
                                <span className="text-blue-400">💬</span>
                                <span className="truncate">{n.message}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--lc-border)' }}>
                  <Link
                    to="/history"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs font-semibold no-underline block text-center"
                    style={{ color: 'var(--lc-accent-orange)' }}
                  >
                    View Match History →
                  </Link>
                </div>
              </div>
            )}
          </button>
          {/* ─── Settings ─── */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={`text-gray-400 hover:text-white transition-colors ${settingsOpen ? 'text-white' : ''
                }`}
            >
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>

            {settingsOpen && (
              <div
                className="absolute right-0 top-8 w-64 rounded-xl border shadow-2xl z-[999] overflow-hidden"
                style={{ backgroundColor: 'var(--lc-card)', borderColor: 'var(--lc-border)' }}
              >
                {/* Header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--lc-border)' }}>
                  <span className="text-sm font-bold text-white">Settings</span>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {/* Profile */}
                  {isAuthenticated && (
                    <button
                      onClick={() => { setSettingsOpen(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg text-blue-400">person</span>
                      <div>
                        <span className="text-xs font-semibold text-white block">My Profile</span>
                        <span className="text-[10px] text-gray-500">View your stats & history</span>
                      </div>
                    </button>
                  )}

                  {/* Report Issue */}
                  <button
                    onClick={() => { setReportOpen(true); setSettingsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-orange-400">bug_report</span>
                    <div>
                      <span className="text-xs font-semibold text-white block">Report Issue</span>
                      <span className="text-[10px] text-gray-500">Send feedback or report bugs</span>
                    </div>
                  </button>

                  {/* Keyboard Shortcuts */}
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      alert(
                        'Keyboard Shortcuts\n\n' +
                        'Ctrl + Enter  —  Submit code\n' +
                        'Ctrl + S      —  Save code (auto)\n' +
                        'Ctrl + /      —  Toggle comment\n' +
                        'Tab           —  Indent code\n' +
                        'Shift + Tab   —  Unindent code\n' +
                        'Ctrl + Z      —  Undo\n' +
                        'Ctrl + Shift + Z  —  Redo\n' +
                        'Escape        —  Close dialogs'
                      );
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-purple-400">keyboard</span>
                    <div>
                      <span className="text-xs font-semibold text-white block">Keyboard Shortcuts</span>
                      <span className="text-[10px] text-gray-500">View editor shortcuts</span>
                    </div>
                  </button>

                  {/* About */}
                  <a
                    href="https://github.com/rajats496/code-clash"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSettingsOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors no-underline"
                  >
                    <span className="material-symbols-outlined text-lg text-emerald-400">info</span>
                    <div>
                      <span className="text-xs font-semibold text-white block">About CodeClash</span>
                      <span className="text-[10px] text-gray-500">v1.0.0 — GitHub repo</span>
                    </div>
                  </a>
                </div>

                {/* Divider + Logout */}
                {isAuthenticated && (
                  <div className="border-t" style={{ borderColor: 'var(--lc-border)' }}>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-500/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg text-red-400">logout</span>
                      <span className="text-xs font-semibold text-red-400">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Report Issue Modal ─── */}
          {/* ─── Logout Confirmation Modal ─── */}
          {logoutConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div
                className="w-full max-w-sm mx-4 rounded-2xl border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--lc-card)', borderColor: 'var(--lc-border)' }}
              >
                <div className="px-6 py-5 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-red-400">logout</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Sign out of CodeClash?</h3>
                  <p className="text-xs text-gray-400">You'll need to sign in again to access your account.</p>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                  <button
                    onClick={() => setLogoutConfirm(false)}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-[#2a2a2a] border border-[var(--lc-border)] text-gray-300 hover:bg-[#3a3a3a] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmLogout}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Yes, Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {reportOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div
                className="w-full max-w-md mx-4 rounded-2xl border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--lc-card)', borderColor: 'var(--lc-border)' }}
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--lc-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-orange-400">bug_report</span>
                    <h3 className="text-sm font-bold text-white">Report an Issue</h3>
                  </div>
                  <button
                    onClick={() => { setReportOpen(false); setReportForm({ subject: '', description: '' }); setReportSent(false); }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {reportSent ? (
                  <div className="px-6 py-10 text-center">
                    <span className="text-4xl block mb-3">✅</span>
                    <p className="text-sm font-semibold text-emerald-400">Report submitted!</p>
                    <p className="text-xs text-gray-500 mt-1">We'll look into it shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleReportSubmit} className="px-6 py-4 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Issue Type</label>
                      <select
                        value={reportForm.subject}
                        onChange={(e) => setReportForm((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full bg-[#2a2a2a] border border-[var(--lc-border)] rounded-lg px-3 py-2.5 text-xs text-white focus:ring-1 focus:ring-[var(--lc-accent-orange)] outline-none"
                        required
                      >
                        <option value="">Select issue type...</option>
                        <option value="Bug Report">Bug Report</option>
                        <option value="Feature Request">Feature Request</option>
                        <option value="UI/UX Issue">UI/UX Issue</option>
                        <option value="Performance Issue">Performance Issue</option>
                        <option value="Security Concern">Security Concern</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                      <textarea
                        rows={4}
                        value={reportForm.description}
                        onChange={(e) => setReportForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Describe the issue in detail..."
                        className="w-full bg-[#2a2a2a] border border-[var(--lc-border)] rounded-lg px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:ring-1 focus:ring-[var(--lc-accent-orange)] outline-none resize-none"
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setReportOpen(false); setReportForm({ subject: '', description: '' }); }}
                        className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-[#2a2a2a] border border-[var(--lc-border)] text-gray-300 hover:bg-[#3a3a3a] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={reportSending || !reportForm.subject || !reportForm.description.trim()}
                        className="flex-1 py-2.5 rounded-lg text-xs font-bold text-black disabled:opacity-40 transition-all"
                        style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)' }}
                      >
                        {reportSending ? 'Submitting…' : 'Submit Report'}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-600 text-center">
                      Your report will be sent directly to the admin
                    </p>
                  </form>
                )}
              </div>
            </div>
          )}

          {isAuthenticated && user ? (
            <div className="h-7 w-7 rounded-full overflow-hidden border" style={{ borderColor: 'var(--lc-border)' }}>
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gray-600 flex items-center justify-center text-[10px] text-white font-bold">
                  {(user.name?.[0] || 'U').toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1 rounded text-xs font-medium text-white no-underline"
              style={{ backgroundColor: 'var(--lc-accent-orange)' }}
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* ─── Main content ─── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="fixed bottom-0 left-0 right-0 h-8 flex items-center px-6 justify-between text-[10px] text-gray-500 z-50 border-t"
        style={{ backgroundColor: 'var(--lc-nav)', borderColor: 'var(--lc-border)' }}
      >
        <div className="flex gap-6">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--lc-accent-green)' }} />
            <span>System Status: Optimal</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">group</span>
            <span>42,109 Players Online</span>
          </div>
        </div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white transition-colors">Help Center</a>
          <a href="#" className="hover:text-white transition-colors">API Reference</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <span>© 2025 Code Clash Protocol</span>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;
