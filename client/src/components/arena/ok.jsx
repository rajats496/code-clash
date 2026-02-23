import { useMatch } from '../../context/MatchContext';
import { useEffect, useState } from 'react';

const MatchTimer = () => {
  const { timer } = useMatch();
  const [displayTime, setDisplayTime] = useState('00:00');

  // Update display whenever timer changes
  useEffect(() => {
    console.log('⏱️ MatchTimer re-rendered with:', timer);
    const formatted = formatTime(timer.currentTime);
    setDisplayTime(formatted);
  }, [timer, timer.currentTime, timer.isRunning]); // Multiple dependencies to ensure update

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-800 text-white px-6 py-3 rounded-lg font-mono text-2xl">
      <div className="flex items-center gap-3">
        <span className={timer.isRunning ? 'text-green-400 animate-pulse' : 'text-gray-400'}>
          {timer.isRunning ? '⏱️' : '⏸️'}
        </span>
        <span className="font-bold">{displayTime}</span>
        <span className="text-xs text-gray-400">
          {timer.isRunning ? 'LIVE' : 'PAUSED'}
        </span>
      </div>
    </div>
  );
};

export default MatchTimer;