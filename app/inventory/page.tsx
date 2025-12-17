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
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
            <p className="text-slate-600">You do not have Inventory access.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Inventory />
    </AppLayout>
  );
}
