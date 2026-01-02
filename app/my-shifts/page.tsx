'use client';

import { useStore } from '../../context/StoreContext';
import Login from '../../components/Login';
import AppLayout from '../../components/AppLayout';
import MyShifts from '../../components/pages/MyShifts';

export default function MyShiftsPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('POS')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <MyShifts />
    </AppLayout>
  );
}
