'use client';

import { useStore } from '../../context/StoreContext';
import Login from '../../components/Login';
import AppLayout from '../../components/AppLayout';
import Reports from '../../components/pages/Reports';

export default function ReportsPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('REPORTS')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Reports />
    </AppLayout>
  );
}
