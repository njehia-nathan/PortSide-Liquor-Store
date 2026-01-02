'use client';

import { useStore } from '../../../context/StoreContext';
import Login from '../../../components/Login';
import AppLayout from '../../../components/AppLayout';
import AdminShiftReports from '../../../components/pages/AdminShiftReports';

export default function AdminShiftReportsPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('ADMIN')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <AdminShiftReports />
    </AppLayout>
  );
}
