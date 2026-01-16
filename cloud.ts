import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// Real credentials provided by user
const SUPABASE_URL = 'https://gdmezqfvlirkaamwfqmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbWV6cWZ2bGlya2FhbXdmcW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTI0MzEsImV4cCI6MjA4MTM4ODQzMX0.YymnaJGMt-z63v8lyXdIoVX7m6u7ZqJM8AFU4QImoRs';

// Check if keys are configured.
const IS_CONFIGURED = (SUPABASE_URL as string) !== 'https://xyzcompany.supabase.co';

// Initialize the Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Normalize product payload for Supabase (convert camelCase to snake_case and remove duplicates)
 * This fixes the issue where local data uses camelCase but Supabase expects snake_case
 */
const normalizeProductPayload = (payload: any): any => {
  // Create a clean object with only snake_case fields that Supabase expects
  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    size: payload.size,
    brand: payload.brand,
    sku: payload.sku || '',
    costPrice: payload.costPrice,
    sellingPrice: payload.sellingPrice,
    supplier: payload.supplier || null,
    stock: payload.stock,
    lowStockThreshold: payload.lowStockThreshold || 5,
    barcode: payload.barcode || '',
    unitsSold: payload.unitsSold || 0,
    // Use camelCase version if available, otherwise fall back to snake_case
    updated_at: payload.updatedAt || payload.updated_at || new Date().toISOString(),
    version: payload.version || 1,
    last_modified_by: payload.lastModifiedBy || payload.last_modified_by || null,
    last_modified_by_name: payload.lastModifiedByName || payload.last_modified_by_name || null,
    price_history: payload.priceHistory || payload.price_history || []
  };
};

/**
 * Syncs a single item from the local queue to the Cloud DB.
 * 
 * @param type - The type of action (e.g., 'SALE', 'ADD_PRODUCT')
 * @param payload - The data object associated with the action
 * @returns Promise<boolean> - True if sync was successful
 */
export const pushToCloud = async (type: string, payload: any): Promise<boolean> => {
  // If user hasn't set up Supabase yet, just pretend we synced it.
  if (!IS_CONFIGURED) {
    console.log(`[Simulation] Cloud Sync Success: ${type}`, payload);
    return true;
  }

  try {
    let table = '';
    let action = 'upsert'; // Default to upsert (insert or update)

    // Map internal action types to Supabase Database Tables
    switch (type) {
      // --- CRITICAL FIX: DELTA STOCK SYNC ---
      case 'SALE_STOCK_UPDATE':
        try {
          // We call the Postgres function 'decrement_stock' to avoid overwriting other devices
          // payload is { productId: string, quantity: number }
          const { error: stockError } = await supabase.rpc('decrement_stock', {
            product_id: payload.productId,
            quantity_to_subtract: payload.quantity
          });
          
          if (stockError) throw stockError;
          return true;
        } catch (error) {
          console.error('[Cloud Error] Stock update failed:', error);
          return false;
        }

      case 'SALE':
      case 'UPDATE_SALE':
        table = 'sales';
        break;
        
      case 'ADD_PRODUCT':
      case 'UPDATE_PRODUCT':
      case 'ADJUST_STOCK':
      case 'RECEIVE_STOCK':
        // All these result in changes to the 'products' table
        table = 'products';
        break;
        
      case 'ADD_USER':
      case 'UPDATE_USER':
        table = 'users';
        break;
        
      case 'DELETE_USER':
        table = 'users';
        action = 'delete';
        break;
        
      case 'DELETE_PRODUCT':
        table = 'products';
        action = 'delete';
        break;
        
      case 'DELETE_SALE':
        table = 'sales';
        action = 'delete';
        break;
        
      case 'DELETE_PRODUCT_SALE_LOG':
        table = 'product_sale_logs';
        action = 'delete';
        break;
        
      case 'OPEN_SHIFT':
      case 'CLOSE_SHIFT':
        table = 'shifts';
        break;
        
      case 'LOG':
        table = 'audit_logs';
        break;
        
      case 'UPDATE_SETTINGS':
        table = 'business_settings';
        break;
        
      case 'VOID_REQUEST':
      case 'VOID_REJECTED':
        table = 'void_requests';
        break;
        
      case 'VOID_APPROVED':
        // For approved voids, we need to sync both the void request and the updated sale
        try {
          // Sync void request
          const { error: voidError } = await supabase.from('void_requests').upsert(payload.request);
          if (voidError) throw voidError;
          // Sync updated sale (marked as voided)
          const { error: saleError } = await supabase.from('sales').upsert(payload.sale);
          if (saleError) throw saleError;
          return true;
        } catch (error) {
          console.error('[Cloud Error] Failed to sync VOID_APPROVED:', error);
          return false;
        }
        
      case 'STOCK_CHANGE_REQUEST':
      case 'STOCK_CHANGE_REJECTED':
        table = 'stock_change_requests';
        break;
        
      case 'STOCK_CHANGE_APPROVED':
        // For approved stock changes, we need to sync both the request and the updated product
        try {
          // Sync stock change request
          const { error: requestError } = await supabase.from('stock_change_requests').upsert(payload.request);
          if (requestError) throw requestError;
          // Sync updated product
          const { error: productError } = await supabase.from('products').upsert(payload.product);
          if (productError) throw productError;
          return true;
        } catch (error) {
          console.error('[Cloud Error] Failed to sync STOCK_CHANGE_APPROVED:', error);
          return false;
        }
        
      case 'PRODUCT_SALE_LOG':
      case 'UPDATE_PRODUCT_SALE_LOG': // Added this case to support Reports.tsx edits
        table = 'product_sale_logs';
        break;
        
      default:
        console.warn('Unknown sync type:', type);
        return true; // Skip unknown types to clear queue
    }

    // Perform the operation on Supabase
    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', payload.id);
      if (error) throw error;
    } else {
      // Normalize payload for products table to fix camelCase/snake_case mismatch
      const normalizedPayload = table === 'products' ? normalizeProductPayload(payload) : payload;

      // Upsert handles both Insert (New) and Update (Existing ID)
      const { error } = await supabase.from(table).upsert(normalizedPayload);

      if (error) {
        // Help debug schema issues
        if (error.code === '42703') { // Postgres code for undefined_column
          console.error(`[Cloud Sync] Schema Error: A column is missing in Supabase table '${table}'. Check your SQL setup.`, error.message);
        }
        throw error;
      }
    }

    return true; // Success

  } catch (error) {
    console.error(`[Cloud Error] Failed to sync ${type}:`, error);
    // Don't log payload for SALE_STOCK_UPDATE as it might clutter logs, but valid for others
    if (type !== 'SALE_STOCK_UPDATE') {
      console.error(`[Cloud Error] Payload that failed:`, JSON.stringify(payload, null, 2));
    }
    return false; // Failed, keep in queue
  }
};