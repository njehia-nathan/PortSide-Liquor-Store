import { useEffect, useState } from 'react';
import { getQueueStats } from '../utils/monitoring';

interface QueueStats {
  syncQueueSize: number;
  failedSyncQueueSize: number;
  totalSize: number;
  oldestItemAge: number | null;
}

/**
 * QUEUE MONITORING HOOK
 * Monitor sync queue size and status
 */
export const useQueueMonitoring = (intervalMs: number = 30000) => {
  const [stats, setStats] = useState<QueueStats>({
    syncQueueSize: 0,
    failedSyncQueueSize: 0,
    totalSize: 0,
    oldestItemAge: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateStats = async () => {
      const newStats = await getQueueStats();
      setStats(newStats);
      setIsLoading(false);
    };

    // Initial load
    updateStats();

    // Periodic updates
    const interval = setInterval(updateStats, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return { stats, isLoading };
};
