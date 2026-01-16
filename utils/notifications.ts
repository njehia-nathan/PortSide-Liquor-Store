/**
 * NOTIFICATION UTILITIES
 * Simple toast notification system for sync status and errors
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

let notificationListeners: ((notification: Notification) => void)[] = [];

/**
 * Subscribe to notifications
 */
export const subscribeToNotifications = (callback: (notification: Notification) => void) => {
  notificationListeners.push(callback);
  return () => {
    notificationListeners = notificationListeners.filter(cb => cb !== callback);
  };
};

/**
 * Show a notification
 */
const showNotification = (type: NotificationType, message: string, duration: number = 3000) => {
  const notification: Notification = {
    id: Date.now().toString(),
    type,
    message,
    duration
  };
  
  notificationListeners.forEach(listener => listener(notification));
};

/**
 * Show success notification
 */
export const notifySuccess = (message: string, duration?: number) => {
  showNotification('success', message, duration);
};

/**
 * Show error notification
 */
export const notifyError = (message: string, duration?: number) => {
  showNotification('error', message, duration);
};

/**
 * Show warning notification
 */
export const notifyWarning = (message: string, duration?: number) => {
  showNotification('warning', message, duration);
};

/**
 * Show info notification
 */
export const notifyInfo = (message: string, duration?: number) => {
  showNotification('info', message, duration);
};

/**
 * Sync-specific notifications
 */
export const notifySyncSuccess = (itemType: string) => {
  notifySuccess(`✅ ${itemType} synced to cloud`);
};

export const notifySyncError = (itemType: string, willRetry: boolean = true) => {
  if (willRetry) {
    notifyWarning(`⚠️ ${itemType} sync failed - will retry`);
  } else {
    notifyError(`❌ ${itemType} sync failed permanently`);
  }
};

export const notifySyncRetrying = (itemType: string, attempt: number) => {
  notifyInfo(`🔄 Retrying ${itemType} sync (attempt ${attempt})`);
};

export const notifyConflictDetected = (itemName: string) => {
  notifyWarning(`⚠️ Conflict detected in ${itemName} - please review`);
};

export const notifyOffline = () => {
  notifyWarning('📡 You are offline - changes will sync when reconnected');
};

export const notifyOnline = () => {
  notifySuccess('📡 Back online - syncing changes...');
};
