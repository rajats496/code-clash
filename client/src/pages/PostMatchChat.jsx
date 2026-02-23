import { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../context/MatchContext';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';

const PostMatchChat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    postMatchChatMessages,
    sendPostMatchChatMessage,
  } = useMatch();

  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const currentUserId = user?._id || user?.id;

  const messagesForRoom = useMemo(
    () => postMatchChatMessages.filter((m) => m.roomId === roomId),
    [postMatchChatMessages, roomId],
  );

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesForRoom.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !roomId) return;
    sendPostMatchChatMessage(roomId, trimmed);
    setInput('');
  };

  return (
    <AppShell>
      <main className="max-w-[800px] mx-auto p-6 pb-14 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--lc-text-bright)] mb-1">
            Post-Match Chat
          </h1>
          <p className="text-sm text-[var(--lc-text-primary)] font-mono">
            Room <span className="text-[var(--lc-text-bright)]">#{roomId}</span>
          </p>
        </div>

        {/* Chat Panel */}
        <div className="flex flex-col h-[500px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-card)] lc-card overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messagesForRoom.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <span className="text-3xl">💬</span>
                <p className="text-sm font-mono text-[var(--lc-text-primary)]">
                  Start a friendly chat with your opponent!
                </p>
                <p className="text-xs font-mono text-[var(--lc-text-primary)]/60">
                  Keep it respectful and fun.
                </p>
              </div>
            ) : (
              messagesForRoom.map((m, idx) => {
                const mine = m.userId === currentUserId;
                return (
                  <div
                    key={`${m.sentAt || ''}-${idx}`}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm font-mono ${
                        mine
                          ? 'bg-[var(--lc-accent-orange)] text-white'
                          : 'bg-[var(--lc-border)] text-[var(--lc-text-bright)]'
                      }`}
                    >
                      {!mine && (
                        <div className="mb-1 text-xs font-bold text-[var(--lc-text-primary)]">
                          {m.senderName || 'Opponent'}
                        </div>
                      )}
                      <div className="break-words">{m.message}</div>
                      <div className={`mt-1.5 text-xs ${mine ? 'text-white/70' : 'text-[var(--lc-text-primary)]'}`}>
                        {m.sentAt
                          ? new Date(m.sentAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--lc-border)] bg-[var(--lc-card)] px-5 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 rounded-lg bg-[var(--lc-border)] border border-[var(--lc-border)] px-4 py-2 text-sm font-mono text-[var(--lc-text-bright)] placeholder:text-[var(--lc-text-primary)]/50 outline-none focus:ring-2 focus:ring-[var(--lc-accent-orange)] focus:ring-offset-0"
              />
              <button
                type="button"
                onClick={handleSend}
                className="lc-btn-primary px-6 py-2 rounded-lg text-sm font-mono font-bold tracking-wide"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
};

export default PostMatchChat;

