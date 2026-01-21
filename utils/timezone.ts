/**
 * TIMEZONE UTILITIES
 * Consistent timezone handling across the application
 */

/**
 * Get current timestamp in ISO format (UTC)
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Parse timestamp safely
 */
export const parseTimestamp = (timestamp: string | undefined): Date | null => {
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return null;
    }
    return date;
  } catch (error) {
    console.warn('Failed to parse timestamp:', timestamp, error);
    return null;
  }
};

/**
 * Compare two timestamps safely
 * Returns: -1 if a < b, 0 if equal, 1 if a > b, null if invalid
 */
export const compareTimestamps = (a: string | undefined, b: string | undefined): number | null => {
  const dateA = parseTimestamp(a);
  const dateB = parseTimestamp(b);
  
  if (!dateA || !dateB) return null;
  
  const timeA = dateA.getTime();
  const timeB = dateB.getTime();
  
  if (timeA < timeB) return -1;
  if (timeA > timeB) return 1;
  return 0;
};

/**
 * Format timestamp for display (local timezone)
 */
export const formatTimestamp = (timestamp: string | undefined, includeTime: boolean = true): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return 'Invalid date';
  
  if (includeTime) {
    return date.toLocaleString();
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Get time ago string (e.g., "2 hours ago")
 */
export const getTimeAgo = (timestamp: string | undefined): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return 'Unknown';
  
  const now = Date.now();
  const diff = now - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

/**
 * Check if timestamp is within a time range
 */
export const isWithinRange = (
  timestamp: string | undefined,
  rangeMs: number
): boolean => {
  const date = parseTimestamp(timestamp);
  if (!date) return false;
  
  const now = Date.now();
  const diff = now - date.getTime();
  
  return diff <= rangeMs;
};

/**
 * Validate timestamp is reasonable (not too far in past or future)
 */
export const isReasonableTimestamp = (timestamp: string | undefined): boolean => {
  const date = parseTimestamp(timestamp);
  if (!date) return false;
  
  const now = Date.now();
  const time = date.getTime();
  
  // Not more than 10 years in the past
  const tenYearsAgo = now - (10 * 365 * 24 * 60 * 60 * 1000);
  // Not more than 1 day in the future (allow for clock skew)
  const oneDayFromNow = now + (24 * 60 * 60 * 1000);
  
  return time >= tenYearsAgo && time <= oneDayFromNow;
};
