'use client';

import { useStore } from '../../context/StoreContext';
import Login from '../../components/Login';
import AppLayout from '../../components/AppLayout';
import Admin from '../../components/pages/Admin';

export default function AdminPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('ADMIN')) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
            <p className="text-slate-600">You do not have Admin access.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Admin />
    </AppLayout>
  );
}
