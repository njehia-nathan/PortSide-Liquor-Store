'use client';

import React, { PropsWithChildren, useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut,
  ShoppingCart,
  Package,
  BarChart3,
  ShieldAlert,
  Cloud,
  CloudOff,
  RefreshCw,
  Save,
  Menu,
  X,
  Settings,
  Clock,
  Users,
  Ban,
  CheckSquare
} from 'lucide-react';

const AppLayout = ({ children }: PropsWithChildren) => {
  const { currentUser, logout, currentShift, isOnline, isSyncing, auditLogs, businessSettings } = useStore();
  const pathname = usePathname();
  const [lastSaved, setLastSaved] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);

  useEffect(() => {
    if (auditLogs.length > 0) {
      const date = new Date(auditLogs[0].timestamp);
      setLastSaved(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } else {
      setLastSaved('Just now');
    }
  }, [auditLogs]);

  useEffect(() => {
    // Show banner when going offline
    if (!isOnline) {
      setShowOfflineBanner(true);
    }
  }, [isOnline]);

  if (!currentUser) {
    return <>{children}</>;
  }

  const isActive = (path: string) => pathname === path ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800";
  const hasPerm = (perm: string) => currentUser.permissions?.includes(perm);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:overflow-visible print:bg-white print:h-auto">
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center justify-between print:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          {businessSettings?.logoUrl ? (
            <img src={businessSettings.logoUrl} alt="Logo" className="w-6 h-6 rounded object-contain" />
          ) : (
            <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center text-white font-bold text-xs">PS</div>
          )}
          <span className="truncate">{businessSettings?.businessName?.split(' ')[0] || 'Grab Bottle'}</span>
        </h1>
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw size={18} className="animate-spin text-blue-400" />
          ) : isOnline ? (
            <Cloud size={18} className="text-green-500" />
          ) : (
            <CloudOff size={18} className="text-slate-500" />
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${!sidebarOpen ? 'pointer-events-none lg:pointer-events-auto' : ''}
        print:hidden
      `}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2">
              {businessSettings?.logoUrl ? (
                <img src={businessSettings.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">PS</div>
              )}
              <span className="truncate">{businessSettings?.businessName || 'Grab Bottle '}</span>
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-slate-800 rounded"
            >
              <X size={20} />
            </button>
          </div>
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
            <Link href="/" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
              <ShoppingCart size={20} />
              <span className="font-medium">Point of Sale</span>
            </Link>
          )}

          {hasPerm('INVENTORY') && (
            <Link href="/inventory" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/inventory')}`}>
              <Package size={20} />
              <span className="font-medium">Inventory</span>
            </Link>
          )}

          {hasPerm('REPORTS') && (
            <Link href="/reports" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/reports')}`}>
              <BarChart3 size={20} />
              <span className="font-medium">Reports</span>
            </Link>
          )}

          {hasPerm('POS') && (
            <Link href="/my-shifts" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/my-shifts')}`}>
              <Clock size={20} />
              <span className="font-medium">My Shifts</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin/shift-reports" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/shift-reports')}`}>
              <Users size={20} />
              <span className="font-medium">All Shifts</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin/void-approvals" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/void-approvals')}`}>
              <Ban size={20} />
              <span className="font-medium">Void Approvals</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin/stock-approvals" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/stock-approvals')}`}>
              <CheckSquare size={20} />
              <span className="font-medium">Stock Approvals</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin')}`}>
              <ShieldAlert size={20} />
              <span className="font-medium">Admin & Logs</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/settings" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/settings')}`}>
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </Link>
          )}
        </nav>

        {/* System Status Footer */}
        <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            {isSyncing ? (
              <>
                <RefreshCw size={14} className="animate-spin text-blue-400" />
                <span className="text-blue-400">Syncing to Cloud...</span>
              </>
            ) : isOnline ? (
              <>
                <Cloud size={14} className="text-green-500" />
                <span className="text-green-500">Cloud Connected</span>
              </>
            ) : (
              <>
                <CloudOff size={14} className="text-slate-500" />
                <span className="text-slate-500">Offline Mode</span>
              </>
            )}
          </div>
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
      <main className="flex-1 overflow-auto bg-slate-100 relative print:overflow-visible print:bg-white print:p-0 pt-14 lg:pt-0">
        {/* Offline Banner */}
        {!isOnline && showOfflineBanner && (
          <div className="sticky top-0 z-30 bg-amber-500 text-slate-900 px-4 py-3 flex items-center justify-between shadow-lg print:hidden">
            <div className="flex items-center gap-3 flex-1">
              <CloudOff size={20} className="flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Working Offline</p>
                <p className="text-xs">All data is saved locally and will sync when you're back online</p>
              </div>
            </div>
            <button
              onClick={() => setShowOfflineBanner(false)}
              className="p-1 hover:bg-amber-600 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Syncing Banner */}
        {isOnline && isSyncing && (
          <div className="sticky top-0 z-30 bg-blue-500 text-white px-4 py-2 flex items-center gap-3 shadow-lg print:hidden">
            <RefreshCw size={18} className="animate-spin flex-shrink-0" />
            <p className="text-sm font-medium">Syncing data to cloud...</p>
          </div>
        )}

        {children}
      </main>
    </div>
  );
};

export default AppLayout;
