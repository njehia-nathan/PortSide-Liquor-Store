import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { User, Product, Sale, Shift, AuditLog, BusinessSettings, VoidRequest, StockChangeRequest } from './types';

/**
 * DATABASE SCHEMA DEFINITION
 * 
 * This interface defines the structure of our IndexedDB (Local Database).
 * It acts as a contract for TypeScript to ensure we are storing the right data types.
 */
export interface POSDB extends DBSchema {
  // Store for Users (Staff)
  users: { key: string; value: User };

  // Store for Inventory Products
  products: { key: string; value: Product };

  // Store for Completed Sales transactions
  sales: { key: string; value: Sale };

  // Store for Shift Sessions (Cash drawer tracking)
  shifts: { key: string; value: Shift };

  // Store for Audit Logs (Security trail)
  auditLogs: { key: string; value: AuditLog };

  // Store for Business Settings (single row)
  businessSettings: { key: string; value: BusinessSettings };

  // Store for Void Requests (pending admin approval)
  voidRequests: { key: string; value: VoidRequest };

  // Store for Stock Change Requests (pending admin approval)
  stockChangeRequests: { key: string; value: StockChangeRequest };

  // SYNC QUEUE
  // This is the most important part for "Offline-First".
  // When we do an action, we store it here.
  // When online, we read from here and push to Supabase.
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    autoIncrement: true  // IDB automatically generates 1, 2, 3...
  };
}

export interface SyncQueueItem {
  key?: number;        // Auto-generated key (present after reading from DB)
  type: string;        // What happened? (e.g., 'SALE')
  payload: any;        // The data (e.g., The Sale Object)
  timestamp: number;   // When it happened
}

// Name of the database in the browser's developer tools
const DB_NAME = 'GrabBottlePOS_DB';
const DB_VERSION = 5; // Bumped for stockChangeRequests store

/**
 * INITIALIZE DATABASE
 * 
 * Opens the database connection. If the DB doesn't exist (first run),
 * it creates the necessary "Object Stores" (tables).
 */
export const initDB = async (): Promise<IDBPDatabase<POSDB>> => {
  return openDB<POSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create 'users' table if missing, using 'id' as the primary key
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });

      // Create 'products' table
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });

      // Create 'sales' table
      if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });

      // Create 'shifts' table
      if (!db.objectStoreNames.contains('shifts')) db.createObjectStore('shifts', { keyPath: 'id' });

      // Create 'auditLogs' table
      if (!db.objectStoreNames.contains('auditLogs')) db.createObjectStore('auditLogs', { keyPath: 'id' });

      // Create 'businessSettings' table
      if (!db.objectStoreNames.contains('businessSettings')) db.createObjectStore('businessSettings', { keyPath: 'id' });

      // Create 'voidRequests' table
      if (!db.objectStoreNames.contains('voidRequests')) db.createObjectStore('voidRequests', { keyPath: 'id' });

      // Create 'stockChangeRequests' table
      if (!db.objectStoreNames.contains('stockChangeRequests')) db.createObjectStore('stockChangeRequests', { keyPath: 'id' });

      // Create 'syncQueue' table with auto-incrementing numbers for keys
      if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'key', autoIncrement: true });
    },
  });
};

// Singleton promise to ensure we only open the DB once
// Only initialize on client side (browser) - not on server
let dbPromiseInternal: Promise<IDBPDatabase<POSDB>> | null = null;

export const getDB = (): Promise<IDBPDatabase<POSDB>> => {
  if (typeof window === 'undefined') {
    // Server-side: return a rejected promise
    return Promise.reject(new Error('IndexedDB is not available on the server'));
  }
  if (!dbPromiseInternal) {
    dbPromiseInternal = initDB();
  }
  return dbPromiseInternal;
};

// Export getDB as dbPromise for backward compatibility
export const dbPromise = getDB;

/**
 * HELPER: ADD TO SYNC QUEUE
 * 
 * Any time we modify data locally, we call this function to schedule
 * a synchronization with the Cloud.
 * 
 * @param type - The action type (e.g. 'SALE')
 * @param payload - The data object
 */
export const addToSyncQueue = async (type: string, payload: any) => {
  const db = await getDB();
  await db.add('syncQueue', {
    type,
    payload,
    timestamp: Date.now()
  });
};