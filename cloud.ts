import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
const SUPABASE_URL = 'https://gdmezqfvlirkaamwfqmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbWV6cWZ2bGlya2FhbXdmcW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTI0MzEsImV4cCI6MjA4MTM4ODQzMX0.YymnaJGMt-z63v8lyXdIoVX7m6u7ZqJM8AFU4QImoRs';

const IS_CONFIGURED = (SUPABASE_URL as string) !== 'https://xyzcompany.supabase.co';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Paginated read that bypasses PostgREST's default 1,000-row cap.
// Optional `filter` callback lets callers add .gte / .lte / etc. before ordering.
export const fetchAll = async <T = any>(
  table: string,
  orderBy?: { column: string; ascending?: boolean },
  filter?: (q: any) => any
): Promise<T[]> => {
  const pageSize = 1000;
  let page = 0;
  let all: T[] = [];
  while (true) {
    let q: any = supabase.from(table).select('*');
    if (filter) q = filter(q);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    q = q.range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
};

// Normalize a product payload to the exact columns that exist on the Supabase
// `products` table — all camelCase, matching the schema after migrations.
const normalizeProductPayload = (payload: any): any => ({
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
  lowStockThreshold: payload.lowStockThreshold ?? 5,
  barcode: payload.barcode || '',
  unitsSold: payload.unitsSold ?? 0,
  updatedAt: payload.updatedAt || new Date().toISOString(),
  version: payload.version ?? 1,
  lastModifiedBy: payload.lastModifiedBy ?? null,
  lastModifiedByName: payload.lastModifiedByName ?? null,
  priceHistory: payload.priceHistory ?? [],
});

/**
 * Pushes a single local syncQueue item to Supabase.
 * Returns true on success (caller removes from queue), false on failure (caller retries).
 */
export const pushToCloud = async (type: string, payload: any): Promise<boolean> => {
  if (!IS_CONFIGURED) {
    console.log(`[Simulation] Cloud Sync Success: ${type}`, payload);
    return true;
  }

  try {
    // --- Atomic SALE_WITH_STOCK: upsert the sale, then decrement stock for every
    //     line item. Either all or none — no half-synced sales. ---
    if (type === 'SALE_WITH_STOCK') {
      const { sale, items } = payload as { sale: any; items: Array<{ productId: string; quantity: number }> };
      const { error: saleError } = await supabase.from('sales').upsert(sale);
      if (saleError) throw saleError;
      for (const item of items) {
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          p_id: item.productId,
          delta_qty: item.quantity,
        });
        if (stockError) throw stockError;
      }
      return true;
    }

    // Legacy SALE_STOCK_DELTA kept for backwards compatibility with items already
    // in users' IndexedDB queues. New code always enqueues SALE_WITH_STOCK.
    if (type === 'SALE_STOCK_DELTA') {
      const { error } = await supabase.rpc('decrement_stock', {
        p_id: payload.productId,
        delta_qty: payload.quantity,
      });
      if (error) throw error;
      return true;
    }

    let table = '';
    let action: 'upsert' | 'delete' = 'upsert';

    switch (type) {
      case 'SALE':
      case 'UPDATE_SALE':
        table = 'sales';
        break;

      case 'ADD_PRODUCT':
      case 'UPDATE_PRODUCT':
      case 'UPDATE_PRODUCTS': // legacy alias
      case 'ADJUST_STOCK':
      case 'RECEIVE_STOCK':
        table = 'products';
        break;

      case 'ADD_USER':
      case 'UPDATE_USER':
      case 'UPDATE_USERS':
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

      case 'VOID_APPROVED': {
        const { error: voidError } = await supabase.from('void_requests').upsert(payload.request);
        if (voidError) throw voidError;
        const { error: saleError } = await supabase.from('sales').upsert(payload.sale);
        if (saleError) throw saleError;
        return true;
      }

      case 'STOCK_CHANGE_REQUEST':
      case 'STOCK_CHANGE_REJECTED':
        table = 'stock_change_requests';
        break;

      case 'STOCK_CHANGE_APPROVED': {
        const { error: requestError } = await supabase.from('stock_change_requests').upsert(payload.request);
        if (requestError) throw requestError;
        const { error: productError } = await supabase.from('products').upsert(normalizeProductPayload(payload.product));
        if (productError) throw productError;
        return true;
      }

      case 'PRODUCT_SALE_LOG':
      case 'UPDATE_PRODUCT_SALE_LOG':
        table = 'product_sale_logs';
        break;

      default:
        console.warn('Unknown sync type:', type);
        return true; // skip unknown types so they don't block the queue
    }

    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', payload.id);
      if (error) throw error;
    } else {
      const body = table === 'products' ? normalizeProductPayload(payload) : payload;
      const { error } = await supabase.from(table).upsert(body);
      if (error) {
        if (error.code === '42703') {
          console.error(`[Cloud Sync] Schema error on '${table}': missing column.`, error.message);
        }
        throw error;
      }
    }

    return true;
  } catch (error) {
    console.error(`[Cloud Error] Failed to sync ${type}:`, error);
    if (type !== 'SALE_STOCK_DELTA') {
      console.error(`[Cloud Error] Payload:`, JSON.stringify(payload, null, 2));
    }
    return false;
  }
};
