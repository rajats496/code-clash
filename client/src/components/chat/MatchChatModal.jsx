import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import { getSocket } from '../../services/socket';

// Animation styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.9); opacity: 0.5; }
    50% { transform: scale(1.05); opacity: 0.2; }
    100% { transform: scale(0.9); opacity: 0.5; }
  }
  .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
  .animate-float { animation: float 3s ease-in-out infinite; }
  .animate-pulse-ring { animation: pulse-ring 2s ease-in-out infinite; }
`;

if (!document.getElementById('chat-animation-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'chat-animation-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const QUICK_RESPONSES = [
  { emoji: '🎮', text: 'Good game!' },
  { emoji: '👏', text: 'Well played!' },
  { emoji: '⚔️', text: 'Rematch?' },
  { emoji: '🏆', text: 'GG WP!' },
  { emoji: '💡', text: 'Nice solution!' },
  { emoji: '🔥', text: "Let's go again!" },
];

const MatchChatModal = ({ match, opponent, isOpen, onClose }) => {
  const { user } = useAuth();
  const { postMatchChatMessages, sendPostMatchChatMessage } = useMatch();
  const [inputValue, setInputValue] = useState('');
  const [historyMessages, setHistoryMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const currentUserId = user?._id || user?.id;
  const roomId = match?.roomId;

  // Filter live socket messages belonging to this match room
  const liveMessages = useMemo(
    () => postMatchChatMessages.filter((m) => m.roomId === roomId),
    [postMatchChatMessages, roomId],
  );

  // Merge history + live, deduplicated by sentAt+userId
  const messages = useMemo(() => {
    const seen = new Set();
    return [...historyMessages, ...liveMessages].filter((m) => {
      const key = `${m.userId}-${m.sentAt}-${m.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [historyMessages, liveMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Clear history when modal closes so next open starts fresh
  useEffect(() => {
    if (!isOpen) setHistoryMessages([]);
  }, [isOpen]);

  // Join the socket room for this completed match whenever the modal opens
  useEffect(() => {
    if (!isOpen || !roomId) return;
    const socket = getSocket();
    if (!socket) return;

    // Listen for history before joining so we don't miss the emit
    const handleHistory = ({ roomId: rId, messages: msgs }) => {
      if (rId === roomId) setHistoryMessages(msgs || []);
    };
    socket.on('chat-history', handleHistory);
    socket.emit('join-post-match-chat', { roomId });

    return () => {
      socket.off('chat-history', handleHistory);
    };
  }, [isOpen, roomId]);

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !roomId) return;
    sendPostMatchChatMessage(roomId, inputValue.trim());
    setInputValue('');
  };

  const handleQuickResponse = (text) => {
    if (!roomId) return;
    sendPostMatchChatMessage(roomId, text);
  };

  if (!isOpen) return null;

  const userName = user?.name || 'You';
  const opponentName = opponent?.user?.name || 'Opponent';
  const participantCount = 2;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full sm:w-[520px] lg:w-[560px] h-[90vh] sm:h-[85vh] bg-[var(--lc-card)] rounded-3xl border border-[var(--lc-border)]/40 flex flex-col shadow-2xl shadow-black/60 overflow-hidden">

        {/* ── Header ── */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Chat bubble icon */}
              <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </div>
            <div>
                  <h3 className="text-lg font-bold text-blue-200 leading-tight">Match Chat</h3>
                  <p className="text-xs text-blue-200/80 font-medium">{participantCount} participants</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Participants Bar ── */}
        <div className="px-5 py-3 border-b border-[var(--lc-border)]/40 bg-[var(--lc-bg)] flex items-center gap-2 shrink-0 overflow-x-auto">
          <svg className="w-4 h-4 text-[var(--lc-text-primary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {/* Current user chip */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--lc-accent-orange)]/20 text-[var(--lc-accent-orange)] border border-[var(--lc-accent-orange)]/30 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--lc-accent-green)]"></span>
            {userName} (you)
          </span>
          {/* Opponent chip */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--lc-accent-blue)]/20 text-[var(--lc-accent-blue)] border border-[var(--lc-accent-blue)]/30 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--lc-accent-green)]"></span>
            {opponentName}
          </span>
        </div>

        {/* ── Messages Area ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 bg-gradient-to-b from-[var(--lc-bg)] to-[var(--lc-bg)]/80">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3">
              {/* Empty state chat bubble */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-[var(--lc-border)]/40 flex items-center justify-center animate-float">
                  <svg className="w-8 h-8 text-[var(--lc-text-primary)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-[var(--lc-border)]/20 animate-pulse-ring"></div>
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--lc-text-primary)]">No messages yet</p>
                <p className="text-sm text-[var(--lc-text-primary)]/50 mt-0.5">Start the conversation</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.userId === currentUserId;
              const displayName = msg.senderName || 'Opponent';
              const timestamp = msg.sentAt ? new Date(msg.sentAt) : new Date();
              return (
                <div
                  key={msg.sentAt ? `${msg.sentAt}-${idx}` : idx}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isOwn
                        ? 'bg-gradient-to-r from-[var(--lc-accent-orange)] to-[var(--lc-accent-yellow)] text-black rounded-br-sm font-semibold shadow-lg shadow-orange-500/20'
                        : 'bg-[var(--lc-card)] text-[var(--lc-text-bright)] border border-[var(--lc-border)]/50 rounded-bl-sm'
                    }`}
                  >
                    {!isOwn && (
                      <div className="text-xs font-bold text-[var(--lc-accent-blue)] mb-1.5 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[var(--lc-accent-blue)]"></span>
                        {displayName}
                      </div>
                    )}
                    <p className="break-words">{msg.message}</p>
                    <div className={`text-[10px] mt-1.5 font-mono ${isOwn ? 'text-black/50' : 'text-[var(--lc-text-primary)]/40'}`}>
                      {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick Responses ── */}
        <div className="px-5 py-3 border-t border-[var(--lc-border)]/30 bg-[var(--lc-bg)] shrink-0">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-sm">⚡</span>
            <span className="text-xs font-semibold text-[var(--lc-text-primary)]">Quick responses</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_RESPONSES.map((qr) => (
              <button
                key={qr.text}
                onClick={() => handleQuickResponse(`${qr.text} ${qr.emoji}`)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                  bg-[var(--lc-card)] border border-[var(--lc-border)]/50 text-[var(--lc-text-primary)]
                  hover:border-[var(--lc-accent-orange)]/60 hover:text-[var(--lc-accent-orange)]
                  hover:bg-[var(--lc-accent-orange)]/10 transition-all duration-200 active:scale-95"
              >
                <span>{qr.emoji}</span>
                <span>{qr.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Input Bar ── */}
        <div className="border-t border-[var(--lc-border)]/40 bg-[var(--lc-card)] px-4 py-3 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* Emoji button */}
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-[var(--lc-border)]/30 hover:bg-[var(--lc-border)]/50 flex items-center justify-center text-lg transition-colors shrink-0"
              title="Emoji"
            >
              😊
            </button>
            {/* Text input */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-[var(--lc-bg)] border border-[var(--lc-border)]/40 rounded-full px-4 py-2.5 text-sm
                text-[var(--lc-text-bright)] placeholder-[var(--lc-text-primary)]/40
                focus:outline-none focus:border-[var(--lc-accent-orange)]/60 focus:ring-1 focus:ring-[var(--lc-accent-orange)]/30
                transition-all"
            />
            {/* Send button */}
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--lc-accent-orange)] to-[var(--lc-accent-yellow)]
                flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30
                hover:shadow-orange-500/50 active:scale-90 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default MatchChatModal;
