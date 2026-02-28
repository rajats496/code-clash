import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const MatchEndModal = ({ result }) => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    console.log('ðŸ§¹ Match ended, clearing match data');
    localStorage.removeItem('currentMatch');
    sessionStorage.removeItem('currentTimer');
    refreshUser();
  }, []);

  const handleBackToMatchmaking = () => {
    localStorage.removeItem('currentMatch');
    sessionStorage.removeItem('currentTimer');
    navigate('/matchmaking');
  };

  const currentUserId = user?._id || user?.id;
  const isWin = result.winner === currentUserId;
  const myScore = isWin ? result.winnerScore : result.loserScore;
  const oppScore = isWin ? result.loserScore : result.winnerScore;
  const hasScores = myScore !== undefined && oppScore !== undefined;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl shadow-2xl"
        style={{
          backgroundColor: 'var(--lc-nav)',
          border: `1px solid ${isWin ? '#00b8a3' : 'rgba(220,38,38,0.5)'}`,
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: isWin ? '#ffa116' : '#dc2626' }}
        />

        <div className="relative px-8 pt-8 pb-8 flex flex-col items-center">

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl mb-5"
            style={{
              backgroundColor: isWin ? 'rgba(255,161,22,0.1)' : 'rgba(220,38,38,0.1)',
              border: `1px solid ${isWin ? 'rgba(255,161,22,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}
          >
            {isWin ? '🏆' : '💀'}
          </div>

          {/* Status label */}
          <div
            className="text-xs font-bold tracking-[0.25em] uppercase mb-2 px-4 py-1 rounded"
            style={{
              color: isWin ? '#ffa116' : '#f87171',
              backgroundColor: isWin ? 'rgba(255,161,22,0.1)' : 'rgba(220,38,38,0.1)',
              border: `1px solid ${isWin ? 'rgba(255,161,22,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}
          >
            {isWin ? 'Victory' : 'Defeated'}
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-black tracking-tight mt-3 mb-1 text-white">
            {isWin ? 'Match Won!' : 'Match Over'}
          </h2>

          {/* Message */}
          <p className="text-xs text-center mt-2 leading-relaxed max-w-[240px]" style={{ color: 'var(--lc-text-primary)' }}>
            {result.message || 'The match has ended.'}
          </p>

          {/* Final Score */}
          {hasScores && (
            <div
              className="mt-5 flex items-center justify-center gap-6 px-6 py-3 rounded-lg"
              style={{
                backgroundColor: 'var(--lc-card, rgba(255,255,255,0.04))',
                border: '1px solid var(--lc-border, rgba(255,255,255,0.08))',
              }}
            >
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">You</p>
                <p className="text-2xl font-black font-mono" style={{ color: isWin ? '#00b8a3' : '#f87171' }}>
                  {myScore}
                </p>
              </div>
              <span className="text-gray-600 text-lg">—</span>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Opp</p>
                <p className="text-2xl font-black font-mono" style={{ color: isWin ? '#f87171' : '#00b8a3' }}>
                  {oppScore}
                </p>
              </div>
            </div>
          )}

          {/* Reason pill */}
          {result.reason && (
            <div
              className="mt-4 flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold tracking-widest uppercase"
              style={{
                color: isWin ? '#ffa116' : '#f87171',
                backgroundColor: isWin ? 'rgba(255,161,22,0.08)' : 'rgba(220,38,38,0.08)',
                border: `1px solid ${isWin ? 'rgba(255,161,22,0.25)' : 'rgba(220,38,38,0.25)'}`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isWin ? '#ffa116' : '#ef4444' }} />
              {result.reason.replace(/-/g, ' ')}
            </div>
          )}

          {/* Divider */}
          <div className="w-full h-px my-6" style={{ backgroundColor: 'var(--lc-border)' }} />

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-3">

            {/* Primary — Play Again */}
            <button
              onClick={handleBackToMatchmaking}
              className="w-full py-3 rounded text-sm font-bold tracking-widest uppercase transition-all duration-200 active:scale-95 hover:opacity-90"
              style={{ backgroundColor: '#ffa116', color: '#1a1a1a' }}
            >
              Play Again
            </button>

            {/* Secondary — Dashboard */}
            <button
              onClick={() => {
                localStorage.removeItem('currentMatch');
                sessionStorage.removeItem('currentTimer');
                navigate('/');
              }}
              className="w-full py-2.5 rounded text-xs font-semibold tracking-widest uppercase transition-all duration-200 active:scale-95 text-gray-400 hover:text-white"
              style={{ border: '1px solid var(--lc-border)' }}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchEndModal;
