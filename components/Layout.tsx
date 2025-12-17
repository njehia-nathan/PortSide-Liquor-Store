import React, { PropsWithChildren, useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  LogOut, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  ShieldAlert,
  Save
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import SyncStatusBadge from './SyncStatusBadge';

const Layout = ({ children }: PropsWithChildren) => {
  const { currentUser, logout, currentShift, auditLogs } = useStore();
  const location = useLocation();
  const [lastSaved, setLastSaved] = useState<string>('');

  // Update the "Last Saved" display whenever audit logs change
  useEffect(() => {
    if (auditLogs.length > 0) {
        const date = new Date(auditLogs[0].timestamp);
        setLastSaved(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } else {
        setLastSaved('Just now');
    }
  }, [auditLogs]);

  if (!currentUser) {
    return <>{children}</>;
  }

  const isActive = (path: string) => location.pathname === path ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800";
  
  // Helper to check permission
  const hasPerm = (perm: string) => currentUser.permissions?.includes(perm);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:overflow-visible print:bg-white print:h-auto">
      {/* Sidebar - Hide when printing */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 print:hidden">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
             <span className="text-amber-500 text-2xl">🍾</span> Port Side Liquor
          </h1>
          <div className="mt-4 text-sm text-slate-400">
            <p>User: <span className="text-white font-medium">{currentUser.name}</span></p>
            <p className="mt-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${currentShift ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {currentShift ? 'Shift Open' : 'Shift Closed'}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {hasPerm('POS') && (
            <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
                <ShoppingCart size={20} />
                <span className="font-medium">Point of Sale</span>
            </Link>
          )}

          {hasPerm('INVENTORY') && (
            <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/inventory')}`}>
                <Package size={20} />
                <span className="font-medium">Inventory</span>
            </Link>
          )}

          {hasPerm('REPORTS') && (
            <Link to="/reports" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/reports')}`}>
                <BarChart3 size={20} />
                <span className="font-medium">Reports</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link to="/admin" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin')}`}>
              <ShieldAlert size={20} />
              <span className="font-medium">Admin & Logs</span>
            </Link>
          )}
        </nav>

        {/* System Status Footer */}
        <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-800 space-y-2">
            {/* Cloud Sync Status Badge */}
            <SyncStatusBadge />

            {/* Local Save Status */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <Save size={14} />
                <span>Saved locally: {lastSaved}</span>
            </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-100 relative print:overflow-visible print:bg-white print:p-0">
        {children}
      </main>
    </div>
  );
};

export default Layout;