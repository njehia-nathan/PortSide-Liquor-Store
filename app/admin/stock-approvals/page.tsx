'use client';

import { useStore } from '../../../context/StoreContext';
import Login from '../../../components/Login';
import AppLayout from '../../../components/AppLayout';
import AdminStockApprovals from '../../../components/pages/AdminStockApprovals';

export default function StockApprovalsPage() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  if (!currentUser.permissions?.includes('ADMIN')) {
    return <Login />;
  }

  return (
    <AppLayout>
      <AdminStockApprovals />
    </AppLayout>
  );
}
