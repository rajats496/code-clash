import AppShell from '../components/layout/AppShell';
import FriendsList from '../components/dashboard/FriendsList';

const Friends = () => (
  <AppShell>
    <div className="max-w-5xl mx-auto px-4 py-6">
      <FriendsList />
    </div>
  </AppShell>
);

export default Friends;
