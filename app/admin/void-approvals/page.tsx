'use client';

import { useStore } from '../../../context/StoreContext';
import Login from '../../../components/Login';
import AppLayout from '../../../components/AppLayout';
import AdminVoidApprovals from '../../../components/pages/AdminVoidApprovals';

export default function VoidApprovalsPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('ADMIN')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <AdminVoidApprovals />
    </AppLayout>
  );
}
