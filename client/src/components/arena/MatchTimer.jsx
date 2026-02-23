import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../services/socket';

/**
 * MatchTimer — perfectly synced across both clients.
 *
 * Strategy:
 *  - Server stores `startTime` (epoch ms) when match begins.
 *  - Server sends `startTime` on match-state / match-start / timer-update.
 *  - Client runs a local interval every 200ms computing:
 *      elapsed = Math.floor((Date.now() - startTime) / 1000)
 *  - Since both clients use the same `startTime`, they always show the
 *    same value regardless of when they received the sync message.
 *  - No per-second server broadcast needed — server only syncs every 5s.
 */
const MatchTimer = () => {
  const [displayTime, setDisplayTime] = useState(null);
  const startTimeRef = useRef(null);  // epoch ms from server
  const isRunningRef = useRef(false);
  const intervalRef  = useRef(null);

  // ── Tick: recompute elapsed from startTime ────────────────────────
  const startTicking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isRunningRef.current || !startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDisplayTime(elapsed);
    }, 200); // 200ms for smooth, jitter-free display
  };

  // ── Initialise from sessionStorage (page refresh) ────────────────
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('currentTimer');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.startTime) {
          startTimeRef.current  = parsed.startTime;
          isRunningRef.current  = parsed.isRunning;
          const elapsed = Math.floor((Date.now() - parsed.startTime) / 1000);
          setDisplayTime(elapsed);
          if (parsed.isRunning) startTicking();
        } else if (parsed.currentTime !== undefined) {
          // Legacy cache fallback
          setDisplayTime(parsed.currentTime);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Socket listeners ──────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const sync = (startTime, isRunning) => {
      if (!startTime) return;
      startTimeRef.current = startTime;
      isRunningRef.current = isRunning;

      sessionStorage.setItem('currentTimer', JSON.stringify({ startTime, isRunning }));

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDisplayTime(elapsed);

      if (isRunning) startTicking();
      else if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };

    const handleMatchState  = (d) => d.timer?.startTime && sync(d.timer.startTime, d.timer.isRunning);
    const handleMatchStart  = (d) => d.startTime && sync(d.startTime, true);
    const handleTimerUpdate = (d) => d.startTime && sync(d.startTime, d.isRunning);

    socket.on('match-state',   handleMatchState);
    socket.on('match-start',   handleMatchStart);
    socket.on('timer-update',  handleTimerUpdate);

    return () => {
      socket.off('match-state',  handleMatchState);
      socket.off('match-start',  handleMatchStart);
      socket.off('timer-update', handleTimerUpdate);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Format ────────────────────────────────────────────────────────
  const formatTime = (s) => {
    if (s === null || s === undefined) return '00:00';
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  };

  return (
    <span className="font-black font-mono tracking-widest text-sm text-white tabular-nums">
      {formatTime(displayTime)}
    </span>
  );
};

export default MatchTimer;
