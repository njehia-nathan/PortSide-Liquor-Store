/**
 * VALIDATION UTILITIES
 * Comprehensive validation functions to prevent data corruption
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates price values
 */
export const validatePrice = (value: number, fieldName: string = 'Price'): ValidationResult => {
  if (isNaN(value)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }
  
  if (value < 0) {
    return { isValid: false, error: `${fieldName} cannot be negative` };
  }
  
  if (value > 10000000) {
    return { isValid: false, error: `${fieldName} is too large (max: 10,000,000)` };
  }
  
  return { isValid: true };
};

/**
 * Validates stock values
 */
export const validateStock = (value: number): ValidationResult => {
  if (isNaN(value)) {
    return { isValid: false, error: 'Stock must be a valid number' };
  }
  
  if (value < 0) {
    return { isValid: false, error: 'Stock cannot be negative' };
  }
  
  if (value > 100000) {
    return { isValid: false, error: 'Stock value is too large (max: 100,000)' };
  }
  
  return { isValid: true };
};

/**
 * Validates timestamp format and range
 */
export const validateTimestamp = (timestamp: string): ValidationResult => {
  if (!timestamp) {
    return { isValid: false, error: 'Timestamp is required' };
  }
  
  try {
    const date = new Date(timestamp);
    const time = date.getTime();
    
    if (isNaN(time)) {
      return { isValid: false, error: 'Invalid timestamp format' };
    }
    
    // Check if timestamp is in reasonable range (not before 2020 or more than 1 year in future)
    const minDate = new Date('2020-01-01').getTime();
    const maxDate = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year from now
    
    if (time < minDate) {
      return { isValid: false, error: 'Timestamp is too old (before 2020)' };
    }
    
    if (time > maxDate) {
      return { isValid: false, error: 'Timestamp is in the future' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Failed to parse timestamp' };
  }
};

/**
 * Sanitizes price input from string
 */
export const sanitizePriceInput = (input: string): number => {
  const cleaned = input.replace(/[^\d.-]/g, '');
  const value = parseFloat(cleaned);
  
  if (isNaN(value) || value < 0) {
    return 0;
  }
  
  if (value > 10000000) {
    return 10000000;
  }
  
  return Math.round(value * 100) / 100; // Round to 2 decimal places
};

/**
 * Sanitizes stock input from string
 */
export const sanitizeStockInput = (input: string): number => {
  const cleaned = input.replace(/[^\d]/g, '');
  const value = parseInt(cleaned, 10);
  
  if (isNaN(value) || value < 0) {
    return 0;
  }
  
  if (value > 100000) {
    return 100000;
  }
  
  return value;
};

/**
 * Compares two timestamps safely, handling timezone issues
 */
export const compareTimestamps = (timestamp1: string, timestamp2: string): number => {
  try {
    const time1 = new Date(timestamp1).getTime();
    const time2 = new Date(timestamp2).getTime();
    
    if (isNaN(time1) || isNaN(time2)) {
      return 0; // Equal if either is invalid
    }
    
    return time1 - time2;
  } catch (error) {
    return 0;
  }
};

/**
 * Generates a reliable timestamp in ISO format
 */
export const generateTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Debounce function for input handling
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};
