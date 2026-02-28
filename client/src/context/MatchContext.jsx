import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getSocket } from '../services/socket';

const MatchContext = createContext(null);

export const MatchProvider = ({ children }) => {
  const { user } = useAuth();

  const [socketReady, setSocketReady] = useState(false);
  const [matchState, setMatchState] = useState(null);
  const [matchEndResult, setMatchEndResult] = useState(null);
  const [postMatchChatMessages, setPostMatchChatMessages] = useState([]);

  // Notification persistence — use a ref for the storage key so the
  // persist effect never has the key as a reactive dep (prevents race-wipe).
  const [chatNotifications, setChatNotifications] = useState([]);
  const notifKeyRef = useRef(null);

  // Hydrate when user becomes available / changes
  const userId = user?._id || user?.id;
  useEffect(() => {
    if (!userId) return;
    notifKeyRef.current = `chatNotifications_${userId}`;
    try {
      const saved = localStorage.getItem(notifKeyRef.current);
      setChatNotifications(saved ? JSON.parse(saved) : []);
    } catch {
      setChatNotifications([]);
    }
  }, [userId]);

  // Persist whenever notifications change (key is always current via ref)
  useEffect(() => {
    if (!notifKeyRef.current) return;
    try {
      localStorage.setItem(notifKeyRef.current, JSON.stringify(chatNotifications));
    } catch { /* storage full – ignore */ }
  }, [chatNotifications]);

  // Multi-round state
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(1);
  const [roundScores, setRoundScores] = useState({});
  const [roundWonResult, setRoundWonResult] = useState(null);

  const resetMatchState = () => {
    console.log('🧹 Resetting match state');
    setMatchState(null);
    setMatchEndResult(null);
    setSubmissionStatus(null);
    setTimer({ currentTime: 0, isRunning: false });
    setPostMatchChatMessages([]);
    setCurrentRound(0);
    setTotalRounds(1);
    setRoundScores({});
    setRoundWonResult(null);
  };

  const initialTimer = useMemo(() => {
    try {
      const cached = sessionStorage.getItem('currentTimer');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading cached timer:', error);
    }
    return { currentTime: 0, isRunning: false };
  }, []);

  const [timer, setTimer] = useState(initialTimer);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  useEffect(() => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      const checkInterval = setInterval(() => {
        const s = getSocket();
        if (s && s.connected) {
          clearInterval(checkInterval);
          setSocketReady(true);
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }

    console.log('✅ Socket ready, setting up MatchContext listeners');

    // Match state
    socket.on('match-state', (data) => {
      console.log('📊 Match state received:', data);
      setMatchState(data);
      if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
      if (data.totalRounds !== undefined) setTotalRounds(data.totalRounds);

      const timerData = {
        currentTime: data.timer.currentTime,
        isRunning: data.timer.isRunning,
      };

      setTimer(timerData);
      sessionStorage.setItem('currentTimer', JSON.stringify(timerData));
    });

    // Match start
    socket.on('match-start', (data) => {
      console.log('🚀 Match started!', data);
      if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
      if (data.totalRounds !== undefined) setTotalRounds(data.totalRounds);

      setTimer((prevTimer) => {
        if (prevTimer.currentTime === 0) {
          return { currentTime: 0, isRunning: true };
        } else {
          return { ...prevTimer, isRunning: true };
        }
      });
    });

    // Timer updates
    socket.on('timer-update', (data) => {
      const timerData = {
        currentTime: data.currentTime,
        isRunning: data.isRunning,
      };
      setTimer(timerData);
      sessionStorage.setItem('currentTimer', JSON.stringify(timerData));
    });

    socket.on('submission-status', (data) => {
      console.log('📤 Submission status:', data);
      setSubmissionStatus(data);
    });

    socket.on('submission-result', (data) => {
      console.log('📊 Submission result:', data);
      setSubmissionStatus({
        status: data.verdict,
        message: data.message,
        testResults: data.testResults,
        allPassed: data.allPassed,
        runtime: data.runtime || null,
        memory: data.memory || null,
        compilationError: data.compilationError || null,
        isSubmit: data.isSubmit,
      });
    });

    socket.on('opponent-disconnected', (data) => {
      console.log('🔌 Opponent disconnected:', data);
      alert(data.message);
    });

    // ── Round won event ──
    socket.on('round-won', (data) => {
      console.log('🏆 Round won:', data);
      setRoundWonResult(data);
      setRoundScores(data.scores || {});

      // Auto-dismiss after 2.5s (next-round event comes at 3s)
      setTimeout(() => {
        setRoundWonResult(null);
      }, 2500);
    });

    // ── Next round event ──
    socket.on('next-round', (data) => {
      console.log('➡️ Next round:', data);
      setCurrentRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      setRoundScores(data.scores || {});
      setSubmissionStatus(null);

      // Update localStorage with new problem for Arena
      try {
        const stored = JSON.parse(localStorage.getItem('currentMatch') || '{}');
        stored.currentRound = data.currentRound;
        stored.currentProblem = data.problem;
        // Update the problems array if present
        if (stored.problems && data.problem) {
          stored.problems[data.currentRound] = data.problem;
        }
        stored.savedCode = undefined; // Reset saved code for new round
        localStorage.setItem('currentMatch', JSON.stringify(stored));
      } catch (e) {
        console.error('Error updating localStorage for next round:', e);
      }
    });

    // Match end
    socket.on('match-end', (data) => {
      console.log('🏁 Match ended:', data);

      // Mark matchState as completed so Arena UI stops showing 'Live'
      setMatchState((prev) => prev ? { ...prev, status: 'completed' } : prev);

      setTimer((prevTimer) => ({
        currentTime: prevTimer.currentTime,
        isRunning: false,
      }));

      localStorage.removeItem('currentMatch');
      sessionStorage.removeItem('currentTimer');
      setMatchEndResult(data);
    });

    // Post-match chat
    socket.on('post-match-chat-message', (payload) => {
      console.log('💬 Post-match chat message:', payload);
      setPostMatchChatMessages((prev) => [...prev, payload]);

      // Notify if the message is from someone else
      const currentUserId = user?._id || user?.id;
      if (payload.userId && payload.userId !== currentUserId?.toString()) {
        setChatNotifications((prev) => [
          ...prev,
          {
            id: `${payload.roomId}-${payload.sentAt}-${Math.random()}`,
            type: 'chat',
            senderName: payload.senderName || 'Opponent',
            senderPicture: payload.senderPicture || null,
            message: payload.message,
            sentAt: payload.sentAt,
            roomId: payload.roomId,
          },
        ]);
      }
    });

    // Friend request received
    socket.on('friend-request-received', (payload) => {
      console.log('👥 Friend request received:', payload);
      setChatNotifications((prev) => [
        ...prev,
        {
          id: `fr-${payload.fromId}-${Date.now()}`,
          type: 'friend-request',
          fromId: payload.fromId,
          senderName: payload.fromName || 'Someone',
          senderPicture: payload.fromPicture || null,
          sentAt: new Date().toISOString(),
        },
      ]);
    });

    // Friend request auto-accepted (they accepted our pending request)
    socket.on('friend-request-accepted', (payload) => {
      console.log('👥 Friend request accepted:', payload);
      setChatNotifications((prev) => [
        ...prev,
        {
          id: `fa-${payload.byId}-${Date.now()}`,
          type: 'friend-accepted',
          senderName: payload.byName || 'Someone',
          senderPicture: payload.byPicture || null,
          sentAt: new Date().toISOString(),
        },
      ]);
    });

    // Errors
    socket.on('error', (data) => {
      console.error('❌ Socket error:', data);

      // Always reset a stuck "pending" submission
      setSubmissionStatus((prev) =>
        prev?.status === 'pending' || prev?.status === 'processing'
          ? { status: 'Error', message: data.message || 'An error occurred' }
          : prev
      );

      const isMatchError = data.message &&
        (data.message.includes('Match not found') ||
          data.message.includes('not in this match') ||
          data.message.includes('Match is not') ||
          data.message.includes('not in a match') ||
          data.message.includes('not in progress'));

      if (isMatchError) {
        localStorage.removeItem('currentMatch');
        sessionStorage.removeItem('currentTimer');

        setMatchEndResult({
          message: data.message,
          reason: 'match-error',
          autoRedirect: true,
        });
      } else {
        alert(`Error: ${data.message}`);
      }
    });

    return () => {
      if (socket) {
        console.log('🧹 Cleaning up MatchContext listeners');
        socket.off('match-state');
        socket.off('match-start');
        socket.off('timer-update');
        socket.off('submission-status');
        socket.off('submission-result');
        socket.off('opponent-disconnected');
        socket.off('match-end');
        socket.off('round-won');
        socket.off('next-round');
        socket.off('post-match-chat-message');
        socket.off('friend-request-received');
        socket.off('friend-request-accepted');
        socket.off('error');
      }
    };
  }, [socketReady]);

  const joinMatch = (roomId) => {
    const socket = getSocket();

    if (!socket) {
      setTimeout(() => { joinMatch(roomId); }, 100);
      return;
    }

    if (!socket.connected) {
      socket.once('connect', () => {
        socket.emit('join-match', { roomId });
      });
      return;
    }

    console.log('📤 Socket ready, joining match:', roomId);
    socket.emit('join-match', { roomId });
  };

  const updateCode = (code, language) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('code-update', { code, language });
  };

  const submitCode = (code, language, isSubmit) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('submit-code', { code, language, isSubmit });
    setSubmissionStatus({ status: 'pending', message: 'Submitting...' });
  };

  const sendPostMatchChatMessage = (roomId, message) => {
    const socket = getSocket();
    if (!socket) return;
    const trimmed = (message || '').trim();
    if (!trimmed) return;
    socket.emit('post-match-chat-message', { roomId, message: trimmed });
  };

  const clearChatNotifications = () => setChatNotifications([]);
  const dismissChatNotification = (id) =>
    setChatNotifications((prev) => prev.filter((n) => n.id !== id));

  const value = {
    matchState,
    timer,
    submissionStatus,
    matchEndResult,
    setMatchEndResult,
    resetMatchState,
    joinMatch,
    updateCode,
    submitCode,
    postMatchChatMessages,
    sendPostMatchChatMessage,
    chatNotifications,
    clearChatNotifications,
    dismissChatNotification,
    // Multi-round
    currentRound,
    totalRounds,
    roundScores,
    roundWonResult,
  };

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
};

export const useMatch = () => {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatch must be used within MatchProvider');
  }
  return context;
};