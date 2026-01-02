'use client';

import { useStore } from '../../context/StoreContext';
import Login from '../../components/Login';
import AppLayout from '../../components/AppLayout';
import Inventory from '../../components/pages/Inventory';

export default function InventoryPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('INVENTORY')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Inventory />
    </AppLayout>
  );
}
