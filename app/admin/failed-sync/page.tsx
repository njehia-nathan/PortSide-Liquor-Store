'use client';

import { useStore } from '../../../context/StoreContext';
import Login from '../../../components/Login';
import AppLayout from '../../../components/AppLayout';
import FailedSyncPanel from '../../../components/pages/FailedSyncPanel';

export default function FailedSyncPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('ADMIN')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <FailedSyncPanel />
    </AppLayout>
  );
}
