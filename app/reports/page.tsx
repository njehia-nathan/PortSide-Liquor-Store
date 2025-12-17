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
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
            <p className="text-slate-600">You do not have Reports access.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Reports />
    </AppLayout>
  );
}
