import React, { PropsWithChildren } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { Role } from './types';
import Login from './pages/Login';
import POS from './pages/POS';
import Layout from './components/Layout';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children, requiredPermission }: PropsWithChildren<{ requiredPermission?: string }>) => {
  const { currentUser } = useStore();
  
  if (!currentUser) {
    return <Login />;
  }

  // Check permissions if requiredPermission is provided
  if (requiredPermission && (!currentUser.permissions || !currentUser.permissions.includes(requiredPermission))) {
     return (
       <Layout>
         <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
               <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
               <p className="text-slate-600">You do not have the required permissions ({requiredPermission}) to view this page.</p>
            </div>
         </div>
       </Layout>
     );
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute requiredPermission="POS">
          <POS />
        </ProtectedRoute>
      } />
      
      <Route path="/inventory" element={
        <ProtectedRoute requiredPermission="INVENTORY">
          <Inventory />
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute requiredPermission="REPORTS">
          <Reports />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute requiredPermission="ADMIN">
          <Admin />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute requiredPermission="ADMIN">
          <Settings />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => {
  return (
    <StoreProvider>
      <Router>
        <AppRoutes />
      </Router>
    </StoreProvider>
  );
};

export default App;