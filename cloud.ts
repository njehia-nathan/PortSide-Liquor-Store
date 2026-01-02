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
      case 'SALE':
        table = 'sales';
        break;
      case 'ADD_PRODUCT':
      case 'UPDATE_PRODUCT':
      case 'ADJUST_STOCK':
      case 'RECEIVE_STOCK':
        // All these result in changes to the 'products' table
        // Note: For stock adjustments, we usually sync the final product state
        // to keep the cloud in sync with the local device.
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
      // Upsert handles both Insert (New) and Update (Existing ID)
      const { error } = await supabase.from(table).upsert(payload);
      
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
    console.error(`[Cloud Error] Payload that failed:`, JSON.stringify(payload, null, 2));
    return false; // Failed, keep in queue
  }
};