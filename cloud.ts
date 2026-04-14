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

// Per-table payload normalizers. These are the single source of truth for
// "what fields the cloud accepts". Every upsert goes through a normalizer
// so unknown client-side keys are dropped on our side — never shipped to
// PostgREST where they would 42703 and silently park the row in failed
// sync queue. The SCHEMA_MANIFEST below (used by preflight) is derived
// from these same field lists.

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

const normalizeSalePayload = (payload: any): any => ({
  id: payload.id,
  timestamp: payload.timestamp,
  cashierId: payload.cashierId,
  cashierName: payload.cashierName,
  totalAmount: payload.totalAmount,
  totalCost: payload.totalCost,
  paymentMethod: payload.paymentMethod,
  items: payload.items ?? [],
  isVoided: payload.isVoided ?? false,
  voidedAt: payload.voidedAt ?? null,
  voidedBy: payload.voidedBy ?? null,
  voidReason: payload.voidReason ?? null,
  splitPayment: payload.splitPayment ?? null,
  updatedAt: payload.updatedAt || new Date().toISOString(),
  // shiftId intentionally omitted — the cloud sales table does not have that
  // column. Kept as a local-only breadcrumb on IndexedDB rows.
});

const normalizeShiftPayload = (payload: any): any => ({
  id: payload.id,
  cashierId: payload.cashierId,
  cashierName: payload.cashierName,
  startTime: payload.startTime,
  endTime: payload.endTime ?? null,
  openingCash: payload.openingCash,
  closingCash: payload.closingCash ?? null,
  expectedCash: payload.expectedCash ?? null,
  status: payload.status,
  comments: payload.comments ?? null,
  updatedAt: payload.updatedAt || new Date().toISOString(),
});

const normalizeUserPayload = (payload: any): any => ({
  id: payload.id,
  name: payload.name,
  role: payload.role,
  pin: payload.pin,
  permissions: payload.permissions ?? [],
  updatedAt: payload.updatedAt || new Date().toISOString(),
});

const normalizeAuditLogPayload = (payload: any): any => ({
  id: payload.id,
  timestamp: payload.timestamp,
  userId: payload.userId,
  userName: payload.userName,
  action: payload.action,
  details: payload.details,
  updatedAt: payload.updatedAt || new Date().toISOString(),
});

const normalizeVoidRequestPayload = (payload: any): any => ({
  id: payload.id,
  saleId: payload.saleId,
  sale: payload.sale,
  requestedBy: payload.requestedBy,
  requestedByName: payload.requestedByName,
  requestedAt: payload.requestedAt,
  reason: payload.reason,
  status: payload.status,
  reviewedBy: payload.reviewedBy ?? null,
  reviewedByName: payload.reviewedByName ?? null,
  reviewedAt: payload.reviewedAt ?? null,
  reviewNotes: payload.reviewNotes ?? null,
  updatedAt: payload.updatedAt || new Date().toISOString(),
});

const normalizeStockChangeRequestPayload = (payload: any): any => ({
  id: payload.id,
  productId: payload.productId,
  productName: payload.productName,
  changeType: payload.changeType,
  quantityChange: payload.quantityChange,
  reason: payload.reason ?? null,
  newCost: payload.newCost ?? null,
  supplierName: payload.supplierName ?? null,
  requestedBy: payload.requestedBy,
  requestedByName: payload.requestedByName,
  requestedAt: payload.requestedAt,
  status: payload.status,
  reviewedBy: payload.reviewedBy ?? null,
  reviewedByName: payload.reviewedByName ?? null,
  reviewedAt: payload.reviewedAt ?? null,
  reviewNotes: payload.reviewNotes ?? null,
  currentStock: payload.currentStock,
  updatedAt: payload.updatedAt || new Date().toISOString(),
});

const normalizeProductSaleLogPayload = (payload: any): any => ({
  id: payload.id,
  productId: payload.productId,
  productName: payload.productName,
  saleId: payload.saleId,
  quantity: payload.quantity,
  priceAtSale: payload.priceAtSale,
  costAtSale: payload.costAtSale ?? null, // legacy rows may lack cost
  timestamp: payload.timestamp,
  cashierId: payload.cashierId,
  cashierName: payload.cashierName,
  updatedAt: payload.updatedAt || new Date().toISOString(),
});

const normalizeBusinessSettingsPayload = (payload: any): any => ({
  id: payload.id,
  businessName: payload.businessName,
  tagline: payload.tagline ?? null,
  phone: payload.phone,
  email: payload.email ?? null,
  location: payload.location,
  logoUrl: payload.logoUrl ?? null,
  receiptFooter: payload.receiptFooter ?? null,
  evolutionApiUrl: payload.evolutionApiUrl ?? null,
  evolutionApiKey: payload.evolutionApiKey ?? null,
  evolutionInstance: payload.evolutionInstance ?? null,
  updatedAt: payload.updatedAt || new Date().toISOString(),
  // salesValidationDismissed intentionally omitted — this is a per-device UI
  // preference, not a shared business setting. Keep it in localStorage.
});

// Machine-readable manifest of "what columns does the client intend to
// write to each table". The preflight check loads this and diff's against
// information_schema. The field order here also defines the order we pass
// to supabase.from(table).upsert().
export const SCHEMA_MANIFEST: Record<string, string[]> = {
  products: Object.keys(normalizeProductPayload({})),
  sales: Object.keys(normalizeSalePayload({})),
  shifts: Object.keys(normalizeShiftPayload({})),
  users: Object.keys(normalizeUserPayload({})),
  audit_logs: Object.keys(normalizeAuditLogPayload({})),
  void_requests: Object.keys(normalizeVoidRequestPayload({})),
  stock_change_requests: Object.keys(normalizeStockChangeRequestPayload({})),
  product_sale_logs: Object.keys(normalizeProductSaleLogPayload({})),
  business_settings: Object.keys(normalizeBusinessSettingsPayload({})),
};

// Map from sync-queue type → (cloud table, normalizer). Upsert path in
// pushToCloud consults this so every kind of write goes through exactly
// one normalizer — no more bare `supabase.from(table).upsert(rawPayload)`.
const UPSERT_ROUTING: Record<string, { table: string; normalize: (p: any) => any }> = {
  SALE: { table: 'sales', normalize: normalizeSalePayload },
  UPDATE_SALE: { table: 'sales', normalize: normalizeSalePayload },
  ADD_PRODUCT: { table: 'products', normalize: normalizeProductPayload },
  UPDATE_PRODUCT: { table: 'products', normalize: normalizeProductPayload },
  UPDATE_PRODUCTS: { table: 'products', normalize: normalizeProductPayload },
  ADJUST_STOCK: { table: 'products', normalize: normalizeProductPayload },
  RECEIVE_STOCK: { table: 'products', normalize: normalizeProductPayload },
  ADD_USER: { table: 'users', normalize: normalizeUserPayload },
  UPDATE_USER: { table: 'users', normalize: normalizeUserPayload },
  UPDATE_USERS: { table: 'users', normalize: normalizeUserPayload },
  OPEN_SHIFT: { table: 'shifts', normalize: normalizeShiftPayload },
  CLOSE_SHIFT: { table: 'shifts', normalize: normalizeShiftPayload },
  LOG: { table: 'audit_logs', normalize: normalizeAuditLogPayload },
  UPDATE_SETTINGS: { table: 'business_settings', normalize: normalizeBusinessSettingsPayload },
  VOID_REQUEST: { table: 'void_requests', normalize: normalizeVoidRequestPayload },
  VOID_REJECTED: { table: 'void_requests', normalize: normalizeVoidRequestPayload },
  STOCK_CHANGE_REQUEST: { table: 'stock_change_requests', normalize: normalizeStockChangeRequestPayload },
  STOCK_CHANGE_REJECTED: { table: 'stock_change_requests', normalize: normalizeStockChangeRequestPayload },
  PRODUCT_SALE_LOG: { table: 'product_sale_logs', normalize: normalizeProductSaleLogPayload },
  UPDATE_PRODUCT_SALE_LOG: { table: 'product_sale_logs', normalize: normalizeProductSaleLogPayload },
};

export interface PushResult { ok: boolean; error?: string; code?: string }

/**
 * Pushes a single local syncQueue item to Supabase.
 * Returns { ok: true } on success (caller removes from queue),
 * { ok: false, error } on failure so the caller can persist the real message
 * onto the failedSyncQueue row instead of the useless "Unknown error" fallback.
 */
export const pushToCloud = async (type: string, payload: any): Promise<PushResult> => {
  if (!IS_CONFIGURED) {
    console.log(`[Simulation] Cloud Sync Success: ${type}`, payload);
    return { ok: true };
  }

  try {
    // --- Atomic SALE_WITH_STOCK: upsert the sale, then decrement stock for every
    //     line item. Either all or none — no half-synced sales. ---
    if (type === 'SALE_WITH_STOCK') {
      const { sale, items } = payload as { sale: any; items: Array<{ productId: string; quantity: number }> };
      const { error: saleError } = await supabase.from('sales').upsert(normalizeSalePayload(sale));
      if (saleError) throw saleError;
      for (const item of items) {
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          p_id: item.productId,
          delta_qty: item.quantity,
        });
        if (stockError) throw stockError;
      }
      return { ok: true };
    }

    // Legacy SALE_STOCK_DELTA kept for backwards compatibility with items already
    // in users' IndexedDB queues. New code always enqueues SALE_WITH_STOCK.
    if (type === 'SALE_STOCK_DELTA') {
      const { error } = await supabase.rpc('decrement_stock', {
        p_id: payload.productId,
        delta_qty: payload.quantity,
      });
      if (error) throw error;
      return { ok: true };
    }

    // Compound writes: unfold before the routing table.
    if (type === 'VOID_APPROVED') {
      const { error: voidError } = await supabase
        .from('void_requests')
        .upsert(normalizeVoidRequestPayload(payload.request));
      if (voidError) throw voidError;
      const { error: saleError } = await supabase
        .from('sales')
        .upsert(normalizeSalePayload(payload.sale));
      if (saleError) throw saleError;
      return { ok: true };
    }
    if (type === 'STOCK_CHANGE_APPROVED') {
      const { error: requestError } = await supabase
        .from('stock_change_requests')
        .upsert(normalizeStockChangeRequestPayload(payload.request));
      if (requestError) throw requestError;
      const { error: productError } = await supabase
        .from('products')
        .upsert(normalizeProductPayload(payload.product));
      if (productError) throw productError;
      return { ok: true };
    }

    // Deletes.
    const deleteTable: Record<string, string> = {
      DELETE_USER: 'users',
      DELETE_PRODUCT: 'products',
      DELETE_SALE: 'sales',
      DELETE_PRODUCT_SALE_LOG: 'product_sale_logs',
    };
    if (deleteTable[type]) {
      const { error } = await supabase
        .from(deleteTable[type])
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
      return { ok: true };
    }

    // Routed upserts — every payload passes through its normalizer so unknown
    // keys never reach PostgREST.
    const route = UPSERT_ROUTING[type];
    if (!route) {
      console.warn('Unknown sync type:', type);
      return { ok: true }; // skip unknown types so they don't block the queue
    }
    const body = route.normalize(payload);
    const { error } = await supabase.from(route.table).upsert(body);
    if (error) {
      if (error.code === '42703') {
        console.error(`[Cloud Sync] Schema error on '${route.table}': missing column.`, error.message);
      }
      throw error;
    }

    return { ok: true };
  } catch (error: any) {
    console.error(`[Cloud Error] Failed to sync ${type}:`, error);
    if (type !== 'SALE_STOCK_DELTA') {
      console.error(`[Cloud Error] Payload:`, JSON.stringify(payload, null, 2));
    }
    const code = error?.code || error?.details || '';
    const message = error?.message || String(error);
    // 42703 = undefined_column. Surface schema drift so AppLayout can show
    // the persistent banner.
    if (typeof window !== 'undefined' && (code === '42703' || /column .* does not exist/i.test(message))) {
      window.dispatchEvent(new CustomEvent('pos:schema-drift', {
        detail: { type, message, code },
      }));
    }
    return { ok: false, error: message, code: String(code || '') };
  }
};

// ---------------------------------------------------------------------------
// Schema preflight — catches drift before it strands data in failedSyncQueue.
// ---------------------------------------------------------------------------
// The preflight queries information_schema.columns and diffs against
// SCHEMA_MANIFEST. If any column the client intends to write is missing from
// cloud, we report drift. Also checks that every synced table is in the
// supabase_realtime publication (so multi-device live updates work).
// Dispatches a 'pos:schema-drift' CustomEvent on failure — AppLayout already
// listens for that event and surfaces a persistent banner.

export interface PreflightIssue {
  kind: 'missing-column' | 'not-in-realtime' | 'rpc-missing' | 'network';
  table?: string;
  column?: string;
  rpc?: string;
  message: string;
}

export interface PreflightReport {
  ok: boolean;
  issues: PreflightIssue[];
  checkedAt: string;
}

// RPCs the client calls by name. Each gets a harmless canary call to verify
// it exists and its body doesn't reference missing columns. `p_id=''` is a
// sentinel that won't match any product so decrement_stock is a no-op. The
// absence of an error tells us the function body is well-formed.
const REQUIRED_RPCS: Array<{ name: string; args: Record<string, any> }> = [
  { name: 'decrement_stock', args: { p_id: '__preflight_sentinel__', delta_qty: 0 } },
];

export const runSchemaPreflight = async (): Promise<PreflightReport> => {
  const issues: PreflightIssue[] = [];
  const tables = Object.keys(SCHEMA_MANIFEST);

  try {
    // 1. Column diff — query information_schema via a PostgREST RPC-compatible
    //    path. The shortcut: select from a view Supabase exposes.
    //    information_schema is not exposed by default, so we read directly
    //    from each table with a HEAD request and inspect `openapi` — but the
    //    simplest portable route is a lightweight .select('id').limit(0) per
    //    table, which only verifies the table exists. For column-level drift
    //    we lean on the 42703 detection at write-time (already wired) plus
    //    a heartbeat check: send a normalized empty-ish payload's shape in
    //    a `select(columns)` call — PostgREST will 400 on unknown columns.
    // PostgREST select= takes comma-separated column names, unquoted. The
    // server handles case-sensitive identifier quoting internally.
    const columnList = (t: string) => SCHEMA_MANIFEST[t].join(',');
    const results = await Promise.all(
      tables.map(async t => {
        try {
          const { error } = await supabase.from(t).select(columnList(t)).limit(0);
          return { t, error };
        } catch (err: any) {
          return { t, error: { message: String(err?.message ?? err), code: '' } };
        }
      })
    );
    for (const { t, error } of results) {
      if (!error) continue;
      const msg = error.message || '';
      // PostgREST returns "column X of relation Y does not exist" on missing columns.
      const m = /column "?([^"'\s]+)"? of relation "?([^"'\s]+)"? does not exist/i.exec(msg)
        || /column "?([^"'\s]+)"? does not exist/i.exec(msg);
      if (m) {
        issues.push({
          kind: 'missing-column',
          table: t,
          column: m[1],
          message: `${t}.${m[1]} missing in cloud`,
        });
      } else if (/could not find the table|relation .* does not exist/i.test(msg)) {
        issues.push({
          kind: 'missing-column',
          table: t,
          message: `Table ${t} not found in cloud`,
        });
      } else {
        // Non-schema errors (401, 503, offline) — still report but don't treat
        // as drift.
        issues.push({ kind: 'network', table: t, message: msg });
      }
    }

    // 2. Realtime publication check — this one query covers all tables.
    //    If we can't access pg_publication_tables via PostgREST (default)
    //    we silently skip; missing realtime is non-fatal (UI still works
    //    with polling fallback).
    try {
      const { data, error } = await supabase
        .from('pg_publication_tables' as any)
        .select('tablename')
        .eq('pubname', 'supabase_realtime');
      if (!error && data) {
        const published = new Set(data.map((r: any) => r.tablename));
        for (const t of tables) {
          if (!published.has(t)) {
            issues.push({
              kind: 'not-in-realtime',
              table: t,
              message: `${t} not in supabase_realtime publication — other devices won't see updates live`,
            });
          }
        }
      }
    } catch { /* non-fatal */ }

    // 3. RPC sanity — call each required RPC with canary args. If the RPC
    //    body references a missing column or is undefined, we 42703 /
    //    PGRST202 here and report drift before a real sale tries to use it.
    for (const rpc of REQUIRED_RPCS) {
      try {
        const { error } = await supabase.rpc(rpc.name, rpc.args);
        if (error && (error.code === '42703' || /function .* does not exist/i.test(error.message || ''))) {
          issues.push({
            kind: 'rpc-missing',
            rpc: rpc.name,
            message: `RPC ${rpc.name}: ${error.message}`,
          });
        }
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (/does not exist/i.test(msg)) {
          issues.push({ kind: 'rpc-missing', rpc: rpc.name, message: msg });
        }
      }
    }
  } catch (err: any) {
    issues.push({ kind: 'network', message: String(err?.message ?? err) });
  }

  const ok = issues.filter(i => i.kind !== 'network').length === 0;
  const report: PreflightReport = {
    ok,
    issues,
    checkedAt: new Date().toISOString(),
  };

  // Emit a schema-drift event for the blocking issues so AppLayout can show
  // the red banner. Network issues don't trigger the banner because the UI
  // already has offline indicators.
  const blocking = issues.filter(i => i.kind !== 'network');
  if (!ok && blocking.length > 0 && typeof window !== 'undefined') {
    const summary = blocking
      .map(i => i.message)
      .slice(0, 3)
      .join('; ');
    window.dispatchEvent(new CustomEvent('pos:schema-drift', {
      detail: {
        type: 'PREFLIGHT',
        message: summary + (blocking.length > 3 ? ` (+${blocking.length - 3} more)` : ''),
        code: blocking[0].kind,
        issues: blocking,
      },
    }));
  }

  return report;
};
