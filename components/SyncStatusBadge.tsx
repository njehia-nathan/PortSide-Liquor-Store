import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { SyncQueueItem } from '../db';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle,
  X,
  Package,
  ShoppingCart,
  Users,
  Clock,
  FileText,
  LayoutGrid,
  Table,
  DollarSign
} from 'lucide-react';

interface GroupedItems {
  sales: SyncQueueItem[];
  products: SyncQueueItem[];
  users: SyncQueueItem[];
  shifts: SyncQueueItem[];
  logs: SyncQueueItem[];
}

const SyncStatusBadge = () => {
  const { isOnline, isSyncing, pendingSyncItems, pendingSyncCount } = useStore();
  const [showDialog, setShowDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Group items by category
  const groupedItems = useMemo((): GroupedItems => {
    const groups: GroupedItems = {
      sales: [],
      products: [],
      users: [],
      shifts: [],
      logs: []
    };

    pendingSyncItems.forEach(item => {
      switch (item.type) {
        case 'SALE':
          groups.sales.push(item);
          break;
        case 'ADD_PRODUCT':
        case 'UPDATE_PRODUCT':
        case 'ADJUST_STOCK':
        case 'RECEIVE_STOCK':
          groups.products.push(item);
          break;
        case 'ADD_USER':
        case 'UPDATE_USER':
        case 'DELETE_USER':
          groups.users.push(item);
          break;
        case 'OPEN_SHIFT':
        case 'CLOSE_SHIFT':
          groups.shifts.push(item);
          break;
        case 'LOG':
          groups.logs.push(item);
          break;
      }
    });

    return groups;
  }, [pendingSyncItems]);

  // Summary stats
  const stats = useMemo(() => {
    const totalSalesAmount = groupedItems.sales.reduce((sum, item) => {
      return sum + (item.payload?.totalAmount || 0);
    }, 0);

    const totalProductUpdates = groupedItems.products.length;
    const uniqueProducts = new Set(groupedItems.products.map(p => p.payload?.id)).size;

    return {
      salesCount: groupedItems.sales.length,
      totalSalesAmount,
      productUpdates: totalProductUpdates,
      uniqueProducts,
      userChanges: groupedItems.users.length,
      shiftChanges: groupedItems.shifts.length,
      logEntries: groupedItems.logs.length
    };
  }, [groupedItems]);

  // Get icon for sync item type
  const getTypeIcon = (type: string, size: number = 14) => {
    switch (type) {
      case 'SALE':
        return <ShoppingCart size={size} className="text-green-500" />;
      case 'ADD_PRODUCT':
      case 'UPDATE_PRODUCT':
      case 'ADJUST_STOCK':
      case 'RECEIVE_STOCK':
        return <Package size={size} className="text-blue-500" />;
      case 'ADD_USER':
      case 'UPDATE_USER':
      case 'DELETE_USER':
        return <Users size={size} className="text-purple-500" />;
      case 'OPEN_SHIFT':
      case 'CLOSE_SHIFT':
        return <Clock size={size} className="text-amber-500" />;
      case 'LOG':
        return <FileText size={size} className="text-slate-400" />;
      default:
        return <AlertCircle size={size} className="text-slate-400" />;
    }
  };

  // Get friendly name for sync type
  const getTypeName = (type: string) => {
    switch (type) {
      case 'SALE': return 'Sale';
      case 'ADD_PRODUCT': return 'New Product';
      case 'UPDATE_PRODUCT': return 'Product Update';
      case 'ADJUST_STOCK': return 'Stock Adjust';
      case 'RECEIVE_STOCK': return 'Stock Receive';
      case 'ADD_USER': return 'New User';
      case 'UPDATE_USER': return 'User Update';
      case 'DELETE_USER': return 'User Delete';
      case 'OPEN_SHIFT': return 'Shift Open';
      case 'CLOSE_SHIFT': return 'Shift Close';
      case 'LOG': return 'Audit Log';
      default: return type;
    }
  };

  // Get item description
  const getItemDescription = (item: SyncQueueItem) => {
    const payload = item.payload;
    if (!payload) return 'Unknown';

    switch (item.type) {
      case 'SALE':
        const itemCount = payload.items?.length || 0;
        return `${itemCount} item${itemCount !== 1 ? 's' : ''} - KES ${(payload.totalAmount || 0).toLocaleString()}`;
      case 'ADD_PRODUCT':
      case 'UPDATE_PRODUCT':
        return `${payload.name || 'Product'} (${payload.size || ''})`;
      case 'ADJUST_STOCK':
      case 'RECEIVE_STOCK':
        return `${payload.name || 'Product'} - Stock: ${payload.stock || 0}`;
      case 'ADD_USER':
      case 'UPDATE_USER':
        return `${payload.name || 'User'} (${payload.role || ''})`;
      case 'DELETE_USER':
        return `User ID: ${payload.id}`;
      case 'OPEN_SHIFT':
      case 'CLOSE_SHIFT':
        return `${payload.cashierName || 'Cashier'}`;
      case 'LOG':
        return `${payload.action || 'Action'}: ${payload.details?.substring(0, 30) || ''}...`;
      default:
        return payload.name || payload.id || 'Unknown';
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  return (
    <>
      {/* Badge Button */}
      <button
        onClick={() => setShowDialog(true)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-slate-700/50"
        title={pendingSyncCount > 0 ? `${pendingSyncCount} items pending sync` : 'All synced'}
      >
        {isSyncing ? (
          <>
            <RefreshCw size={16} className="animate-spin text-blue-400" />
            <span className="text-xs text-blue-400 font-medium">Syncing...</span>
          </>
        ) : isOnline ? (
          pendingSyncCount > 0 ? (
            <>
              <Cloud size={16} className="text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">Pending</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} className="text-green-500" />
              <span className="text-xs text-green-500 font-medium">Synced</span>
            </>
          )
        ) : (
          <>
            <CloudOff size={16} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Offline</span>
          </>
        )}

        {/* Badge Count */}
        {pendingSyncCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-amber-500 rounded-full">
            {pendingSyncCount > 99 ? '99+' : pendingSyncCount}
          </span>
        )}
      </button>

      {/* Dialog Overlay */}
      {showDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowDialog(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                {isSyncing ? (
                  <RefreshCw size={20} className="animate-spin text-blue-500" />
                ) : pendingSyncCount > 0 ? (
                  <AlertCircle size={20} className="text-amber-500" />
                ) : (
                  <CheckCircle2 size={20} className="text-green-500" />
                )}
                <div>
                  <h2 className="font-bold text-slate-800">Sync Queue</h2>
                  <p className="text-xs text-slate-500">
                    {isOnline ? '🟢 Connected to cloud' : '🔴 Working offline'} • {pendingSyncCount} pending
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                    title="Card View"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                    title="Table View"
                  >
                    <Table size={16} />
                  </button>
                </div>
                <button 
                  onClick={() => setShowDialog(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {pendingSyncCount > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <ShoppingCart size={14} />
                    <span className="text-xs font-medium">Sales</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{stats.salesCount}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(stats.totalSalesAmount)}</p>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Package size={14} />
                    <span className="text-xs font-medium">Products</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{stats.productUpdates}</p>
                  <p className="text-xs text-slate-500">{stats.uniqueProducts} unique</p>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Users size={14} />
                    <span className="text-xs font-medium">Users</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{stats.userChanges}</p>
                  <p className="text-xs text-slate-500">changes</p>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Clock size={14} />
                    <span className="text-xs font-medium">Shifts</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{stats.shiftChanges}</p>
                  <p className="text-xs text-slate-500">changes</p>
                </div>
              </div>
            )}

            {/* Dialog Content */}
            <div className="flex-1 overflow-auto p-4">
              {pendingSyncCount === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                  <h3 className="font-semibold text-slate-800">All Synced!</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    All data has been saved to the cloud.
                  </p>
                </div>
              ) : viewMode === 'card' ? (
                /* Card View */
                <div className="space-y-3">
                  {pendingSyncItems.map((item, index) => (
                    <div 
                      key={item.key || index}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getTypeIcon(item.type, 18)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                            {getTypeName(item.type)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatTime(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 mt-1 font-medium">
                          {getItemDescription(item)}
                        </p>
                        {item.type === 'SALE' && item.payload?.items && (
                          <div className="mt-2 text-xs text-slate-500">
                            {item.payload.items.map((saleItem: any, i: number) => (
                              <span key={i} className="inline-block mr-2">
                                • {saleItem.productName} x{saleItem.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {item.type === 'SALE' && (
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(item.payload?.totalAmount || 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-semibold text-slate-600">Type</th>
                        <th className="text-left py-2 px-3 font-semibold text-slate-600">Description</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-600">Amount</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-600">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSyncItems.map((item, index) => (
                        <tr 
                          key={item.key || index}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(item.type)}
                              <span className="text-slate-700">{getTypeName(item.type)}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">
                            {getItemDescription(item)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {item.type === 'SALE' ? (
                              <span className="text-green-600">
                                {formatCurrency(item.payload?.totalAmount || 0)}
                              </span>
                            ) : item.payload?.stock !== undefined ? (
                              <span className="text-blue-600">
                                Stock: {item.payload.stock}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500">
                            {formatTime(item.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="p-4 border-t bg-slate-50 rounded-b-xl">
              {!isOnline && pendingSyncCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 mb-3">
                  <CloudOff size={16} />
                  <span>Items will sync automatically when connection is restored</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {isSyncing ? 'Syncing in progress...' : 'Auto-syncs every 5 seconds when online'}
                </p>
                <button
                  onClick={() => setShowDialog(false)}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SyncStatusBadge;
