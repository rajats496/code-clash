import { useState, useEffect, useMemo } from 'react';
import UpcomingContestCard from './UpcomingContestCard';
import DummyContestCard from './DummyContestCard';
import contestApi from '../../services/contestApi';

const SECTION_MIN_HEIGHT = 220;

/**
 * Fetches upcoming contest and renders real card or dummy placeholder.
 * Prevents layout shift with min-height and stable loading UI.
 */
const UpcomingContestSection = () => {
  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchUpcoming = async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await contestApi.upcoming();
        const data = res?.data;
        if (cancelled) return;
        if (data?.success && data?.contest) {
          setContest(data.contest);
        } else {
          setContest(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Upcoming contest fetch failed:', err);
          setError(true);
          setContest(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUpcoming();
    return () => { cancelled = true; };
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div
          className="lc-card overflow-hidden flex items-center justify-center"
          style={{ minHeight: SECTION_MIN_HEIGHT, background: 'var(--lc-nav)', borderColor: 'var(--lc-border)' }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[var(--lc-accent-orange)] animate-spin" />
            <span className="text-xs text-slate-500">Loading contest...</span>
          </div>
        </div>
      );
    }
    if (error) {
      return <DummyContestCard />;
    }
    if (contest) {
      return <UpcomingContestCard contest={contest} />;
    }
    return <DummyContestCard />;
  }, [loading, error, contest]);

  return (
    <section style={{ minHeight: SECTION_MIN_HEIGHT }}>
      {content}
    </section>
  );
};

export default UpcomingContestSection;
