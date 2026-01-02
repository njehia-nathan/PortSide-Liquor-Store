'use client';

import { useStore } from '../../context/StoreContext';
import Login from '../../components/Login';
import AppLayout from '../../components/AppLayout';
import Settings from '../../components/pages/Settings';

export default function SettingsPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('ADMIN')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Settings />
    </AppLayout>
  );
}
