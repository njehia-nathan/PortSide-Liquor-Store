'use client';

import { useStore } from '../context/StoreContext';
import Login from '../components/Login';
import AppLayout from '../components/AppLayout';
import POS from '../components/pages/POS';

export default function Home() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  // Check if user has POS permission
  if (!currentUser.permissions?.includes('POS')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <POS />
    </AppLayout>
  );
}
