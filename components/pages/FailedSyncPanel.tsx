import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Clock, XCircle, CheckCircle, Upload } from 'lucide-react';
import { dbPromise, FailedSyncQueueItem } from '../../db';
import { pushToCloud } from '../../cloud';
import { dumpLocalState } from '../../utils/diagnostics';

/**
 * FAILED SYNC ADMIN PANEL
 * Shows items that failed to sync after max retries
 * Allows manual retry or deletion
 */
const FailedSyncPanel: React.FC = () => {
  const [failedItems, setFailedItems] = useState<(FailedSyncQueueItem & { key: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingItem, setRetryingItem] = useState<number | null>(null);
  const [isDumping, setIsDumping] = useState(false);

  const loadFailedItems = async () => {
    setIsLoading(true);
    try {
      const db = await dbPromise();
      const keys = await db.getAllKeys('failedSyncQueue');
      const values = await db.getAll('failedSyncQueue');
      
      const items = keys.map((key, index) => ({
        ...values[index],
        key: key as number
      }));
      
      setFailedItems(items);
    } catch (error) {
      console.error('Failed to load failed sync items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFailedItems();
  }, []);

  const handleRetry = async (item: FailedSyncQueueItem & { key: number }) => {
    setRetryingItem(item.key);

    try {
      const result = await pushToCloud(item.type, item.payload);

      if (result.ok) {
        const db = await dbPromise();
        await db.delete('failedSyncQueue', item.key);

        alert('✅ Item synced successfully!');
        await loadFailedItems();
      } else {
        alert(`❌ Sync failed again: ${result.error}`);
      }
    } catch (error: any) {
      alert(`❌ Retry failed: ${error.message || error}`);
    } finally {
      setRetryingItem(null);
    }
  };

  const handleDelete = async (key: number) => {
    if (!confirm('Are you sure you want to permanently delete this failed sync item? This cannot be undone.')) {
      return;
    }
    
    try {
      const db = await dbPromise();
      await db.delete('failedSyncQueue', key);
      alert('✅ Item deleted');
      await loadFailedItems();
    } catch (error) {
      alert('❌ Failed to delete item');
    }
  };

  const handleRetryAll = async () => {
    if (!confirm(`Retry syncing all ${failedItems.length} failed items?`)) {
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const item of failedItems) {
      try {
        const result = await pushToCloud(item.type, item.payload);
        if (result.ok) {
          const db = await dbPromise();
          await db.delete('failedSyncQueue', item.key);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }
    
    alert(`✅ Success: ${successCount}, ❌ Failed: ${failCount}`);
    await loadFailedItems();
  };

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${failedItems.length} failed sync items? This cannot be undone.`)) {
      return;
    }

    try {
      const db = await dbPromise();
      for (const item of failedItems) {
        await db.delete('failedSyncQueue', item.key);
      }
      alert('✅ All items cleared');
      await loadFailedItems();
    } catch (error) {
      alert('❌ Failed to clear items');
    }
  };

  // Forensic dump: send this device's full local state (IndexedDB + localStorage)
  // to Supabase as a single JSONB row. Used before a reload so we can analyse
  // the stranded queue shape and understand why specific rows didn't push.
  const handleDumpState = async () => {
    const note = prompt(
      'Optional note for this snapshot (e.g. "before reload, till #2, Charles"):',
      ''
    );
    if (note === null) return; // user cancelled
    setIsDumping(true);
    try {
      const result = await dumpLocalState({ note: note || undefined });
      const mb = (result.bytes / (1024 * 1024)).toFixed(2);
      const truncMsg = result.truncations.length
        ? `\n\n⚠️ Truncated to fit: ${result.truncations.join('; ')}`
        : '';
      alert(
        `✅ Snapshot uploaded.\n\n` +
        `ID: ${result.id}\n` +
        `Size: ${mb} MB\n` +
        `Pending queue: ${result.syncQueueCount}\n` +
        `Failed queue: ${result.failedSyncQueueCount}` +
        truncMsg
      );
    } catch (error: any) {
      console.error('Snapshot failed:', error);
      alert(`❌ Snapshot failed: ${error?.message ?? error}`);
    } finally {
      setIsDumping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-blue-600" />
        <span className="ml-2">Loading failed sync items...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={28} className="text-orange-600" />
            Failed Sync Queue
          </h1>
          <p className="text-slate-600 mt-1">
            Items that failed to sync after maximum retries
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDumpState}
            disabled={isDumping}
            title="Upload this device's full local state (IndexedDB + localStorage) to Supabase for forensic analysis. Do this BEFORE reloading the app."
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 flex items-center gap-2"
          >
            <Upload size={16} className={isDumping ? 'animate-pulse' : ''} />
            {isDumping ? 'Uploading…' : 'Dump local state'}
          </button>
          <button
            onClick={loadFailedItems}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {failedItems.length === 0 ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center">
          <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-green-900 mb-2">All Clear!</h2>
          <p className="text-green-700">No failed sync items. Everything is syncing properly.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleRetryAll}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Retry All ({failedItems.length})
            </button>
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Retries</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Error</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Failed At</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {failedItems.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.payload?.name || item.payload?.id || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.retryCount || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                      {item.lastError || 'Unknown error'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRetry(item)}
                          disabled={retryingItem === item.key}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-1"
                        >
                          <RefreshCw size={12} className={retryingItem === item.key ? 'animate-spin' : ''} />
                          {retryingItem === item.key ? 'Retrying...' : 'Retry'}
                        </button>
                        <button
                          onClick={() => handleDelete(item.key)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 flex items-center gap-1"
                        >
                          <XCircle size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default FailedSyncPanel;
