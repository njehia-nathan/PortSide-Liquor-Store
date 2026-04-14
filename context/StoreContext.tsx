import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback, PropsWithChildren } from 'react';
import {
  User, Product, Sale, Shift, AuditLog, Role, SaleItem, BusinessSettings, VoidRequest, StockChangeRequest, ProductSaleLog
} from '../types';
import { SaleReconciliation, ProductReconciliation } from '../components/ReconciliationDialog';
import { INITIAL_USERS, INITIAL_PRODUCTS, CURRENCY_FORMATTER } from '../constants';
import { dbPromise, addToSyncQueue, SYNC_QUEUE_EVENT } from '../db';
import { pushToCloud, supabase, fetchAll, runSchemaPreflight } from '../cloud';
import { shiftCashExpected } from '../utils/aggregates';

/**
 * STORE CONTEXT INTERFACE
 * Defines all the data and functions available to the rest of the app.
 */
interface StoreContextType {
  // --- DATA ---
  currentUser: User | null;
  users: User[];
  products: Product[];
  sales: Sale[];
  shifts: Shift[];
  auditLogs: AuditLog[];
  voidRequests: VoidRequest[];
  stockChangeRequests: StockChangeRequest[];
  productSaleLogs: ProductSaleLog[];
  setProductSaleLogs: React.Dispatch<React.SetStateAction<ProductSaleLog[]>>;
  currentShift: Shift | null;
  businessSettings: BusinessSettings | null;

  // --- APP STATE ---
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  dataLoadedTimestamp: number;

  // --- AUTH ACTIONS ---
  login: (pin: string) => boolean;
  logout: () => void;
  updateUser: (user: User) => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  // --- POS ACTIONS ---
  processSale: (items: SaleItem[], paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'SPLIT', splitPayment?: { cashAmount: number; mobileAmount: number }) => Promise<Sale | undefined>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;

  // --- INVENTORY ACTIONS ---
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  adjustStock: (productId: string, change: number, reason: string) => Promise<void>;
  receiveStock: (productId: string, quantity: number, newCost?: number, supplierName?: string) => Promise<void>;
  requestStockChange: (productId: string, changeType: 'ADJUST' | 'RECEIVE', quantityChange: number, reason?: string, newCost?: number, supplierName?: string) => Promise<void>;
  approveStockChange: (requestId: string, notes?: string) => Promise<void>;
  rejectStockChange: (requestId: string, notes?: string) => Promise<void>;

  // --- SHIFT ACTIONS ---
  openShift: (openingCash?: number) => Promise<void>;
  closeShift: (
    closingCash: number,
    comments?: string,
    opts?: { expectedCash?: number },
  ) => Promise<Shift | undefined>;
  createBackfillShift: (params: {
    cashierId: string;
    cashierName: string;
    startTime: string;
    endTime: string;
    expectedCash: number;
    comments?: string;
  }) => Promise<Shift>;

  // --- VOID REQUEST ACTIONS ---
  requestVoid: (saleId: string, reason: string) => Promise<void>;
  approveVoid: (requestId: string, notes?: string) => Promise<void>;
  rejectVoid: (requestId: string, notes?: string) => Promise<void>;

  // --- SETTINGS ACTIONS ---
  updateBusinessSettings: (settings: BusinessSettings) => Promise<void>;

  // --- UTILITY ACTIONS ---
  prepareDataFix: () => Promise<{ salesChanges: SaleReconciliation[]; productChanges: ProductReconciliation[] }>;
  applyDataFix: (salesChanges: SaleReconciliation[], productChanges: ProductReconciliation[]) => Promise<{ fixed: number; total: number }>;
  fixCorruptedSales: () => Promise<{ fixed: number; total: number }>;
  reconcileStock: () => Promise<{ reconciled: number; errors: string[] }>;
  refreshProductSaleLogs: () => Promise<void>;
  cleanupDuplicateLogs: () => Promise<{ removed: number; errors: string[] }>;
  reconcileProductSaleLogs: () => Promise<{ removedLocal: number; pushed: number; keptFromCloud: number; errors: string[] }>;
  verifySyncIntegrity: () => Promise<Array<{ table: string; local: number; cloud: number; missingLocal: number; missingCloud: number }>>;
  fetchHistory: (table: 'sales' | 'shifts' | 'audit_logs' | 'product_sale_logs' | 'void_requests' | 'stock_change_requests', startDate: string, endDate: string) => Promise<void>;
}

// ---------------- Helpers ----------------

// Merge two collections keyed by `id`. When both sides have the same id, prefer
// the row with the newer `updatedAt` (falls back to keeping the cloud copy if
// neither has the field). Order: cloud rows first, then local-only.
const mergeByIdNewerWins = <T extends { id: string; updatedAt?: string }>(
  cloudRows: T[],
  localRows: T[]
): T[] => {
  const byId = new Map<string, T>();
  for (const c of cloudRows ?? []) byId.set(c.id, c);
  for (const l of localRows ?? []) {
    const existing = byId.get(l.id);
    if (!existing) {
      byId.set(l.id, l);
      continue;
    }
    const a = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const b = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;
    if (b > a) byId.set(l.id, l);
  }
  return Array.from(byId.values());
};

// Crypto-strong unique id. Falls back gracefully if randomUUID is unavailable
// (very old browsers) by combining timestamp + random.
const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

// Max `updatedAt` across a row set. Used as a watermark so we only fetch rows
// from the cloud that are newer than what we already have locally.
const maxUpdatedAt = <T extends { updatedAt?: string }>(rows: T[]): string | null => {
  let max = 0;
  for (const r of rows) {
    if (!r.updatedAt) continue;
    const t = new Date(r.updatedAt).getTime();
    if (t > max) max = t;
  }
  return max > 0 ? new Date(max).toISOString() : null;
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

/**
 * STORE PROVIDER
 * This is the "Brain" of the application. It manages:
 * 1. State (React useState)
 * 2. Local Database (IndexedDB)
 * 3. Cloud Synchronization (Supabase)
 */
export const StoreProvider = ({ children }: PropsWithChildren) => {
  // --- LOCAL STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  // useRef locks are synchronous — immune to React's async state batching
  const isSyncLockedRef = useRef(false);   // Prevents duplicate sales on rapid clicks
  const isSyncRunningRef = useRef(false);  // Prevents concurrent sync queue processing
  const isClosingShiftRef = useRef(false); // Prevents double-submit on Close Shift
  const lastUserActionRef = useRef<number>(0); // Timestamp of last user-triggered action (sale, stock, etc.)
  const [dataLoadedTimestamp, setDataLoadedTimestamp] = useState(0);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [voidRequests, setVoidRequests] = useState<VoidRequest[]>([]);
  const [stockChangeRequests, setStockChangeRequests] = useState<StockChangeRequest[]>([]);
  const [productSaleLogs, setProductSaleLogs] = useState<ProductSaleLog[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // ------------------------------------------------------------------
  // 1. INITIALIZATION
  // ------------------------------------------------------------------
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    const loadData = async () => {
      const db = await dbPromise();

      // ─── SESSION RESTORE ─────────────────────────────────────────────
      const savedSession = localStorage.getItem('pos_session');
      if (savedSession) {
        try {
          const { userId, lastActivity: savedLastActivity } = JSON.parse(savedSession);
          const timeSinceActivity = Date.now() - savedLastActivity;
          const FIVE_MINUTES = 5 * 60 * 1000;
          if (timeSinceActivity < FIVE_MINUTES) {
            console.log('Restoring session for user:', userId);
          } else {
            console.log('Session expired (inactive for', Math.round(timeSinceActivity / 60000), 'minutes)');
            localStorage.removeItem('pos_session');
          }
        } catch (e) {
          console.error('Failed to parse session:', e);
          localStorage.removeItem('pos_session');
        }
      }

      // ─── PHASE 1: CRITICAL DATA (blocks UI) ──────────────────────────
      // Loads everything reports/POS need to render correctly:
      // ALL users, ALL products, business settings, last 7 days of sales,
      // last 30 days of shifts + every OPEN shift regardless of age.
      try {
        console.log('⚡ Phase 1: Loading critical data...');

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Prune audit logs only — sales and product-sale-logs must be kept in
        // IndexedDB in full because Inventory and Reports compute lifetime KPIs
        // from them. Gated on an empty sync/failed queue so we never delete
        // unsynced data.
        (async () => {
          try {
            const syncCount = await db.count('syncQueue');
            const failedCount = await db.count('failedSyncQueue');
            if (syncCount === 0 && failedCount === 0) {
              const thirtyDaysAgoForLogs = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
              const tx = db.transaction('auditLogs', 'readwrite');
              const index = tx.store.index('timestamp');
              let cursor = await index.openCursor(IDBKeyRange.upperBound(thirtyDaysAgoForLogs));
              while (cursor) { await cursor.delete(); cursor = await cursor.continue(); }
              await tx.done;
              console.log('🧹 Background audit-log pruning complete.');
            } else {
              console.log(`⚠️ Pruning skipped: ${syncCount} pending syncs, ${failedCount} failed syncs.`);
            }
          } catch (pruneErr) {
            console.warn('Pruning error (non-fatal):', pruneErr);
          }
        })();

        let loadedUsers: User[] = [];
        let loadedProducts: Product[] = [];
        let loadedSales: Sale[] = [];
        let loadedShifts: Shift[] = [];

        if (navigator.onLine) {
          // Watermarks: only fetch rows newer than what we already have locally.
          // On first run (empty IDB) these are null → full fetch. On subsequent
          // runs only the delta flows over the wire.
          const [localUsersPre, localProductsPre, localSalesPre, localShiftsPre] = await Promise.all([
            db.getAll('users') as Promise<User[]>,
            db.getAll('products') as Promise<Product[]>,
            db.getAll('sales') as Promise<Sale[]>,
            db.getAll('shifts') as Promise<Shift[]>,
          ]);
          const usersWm = maxUpdatedAt(localUsersPre);
          const productsWm = maxUpdatedAt(localProductsPre);
          const salesWm = maxUpdatedAt(localSalesPre);
          const shiftsWm = maxUpdatedAt(localShiftsPre);

          const [
            cloudUsers,
            cloudProducts,
            recentSales,
            recentShifts,
            openShifts,
            settingsResult
          ] = await Promise.all([
            fetchAll<User>('users', undefined, q => usersWm ? q.gt('updatedAt', usersWm) : q),
            fetchAll<Product>('products', undefined, q => productsWm ? q.gt('updatedAt', productsWm) : q),
            fetchAll<Sale>('sales', { column: 'timestamp', ascending: false }, q => {
              let qq = q.gte('timestamp', sevenDaysAgo);
              if (salesWm) qq = qq.gt('updatedAt', salesWm);
              return qq;
            }),
            fetchAll<Shift>('shifts', { column: 'startTime', ascending: false }, q => {
              let qq = q.gte('startTime', thirtyDaysAgo);
              if (shiftsWm) qq = qq.gt('updatedAt', shiftsWm);
              return qq;
            }),
            // Always re-check OPEN shifts (status changes shouldn't depend on watermark).
            fetchAll<Shift>('shifts', { column: 'startTime', ascending: false }, q => q.eq('status', 'OPEN')),
            supabase.from('business_settings').select('*').eq('id', 'default').single()
          ]);
          const cloudSettings = (settingsResult as any).data;
          console.log(`⚡ Incremental fetch: users=${cloudUsers.length}, products=${cloudProducts.length}, sales=${recentSales.length}, shifts=${recentShifts.length + openShifts.length}`);

          // Merge users — delta from cloud wins on id collision by updatedAt.
          loadedUsers = mergeByIdNewerWins(cloudUsers, localUsersPre);
          for (const u of cloudUsers) await db.put('users', u);

          // Merge products.
          loadedProducts = mergeByIdNewerWins(cloudProducts, localProductsPre);
          for (const p of cloudProducts) await db.put('products', p);

          // Sales — merge delta with local. Unsynced local rows sit in syncQueue
          // and are pushed by the immediate-push + interval processors; no need
          // to re-queue them here.
          loadedSales = mergeByIdNewerWins(recentSales, localSalesPre);
          for (const s of recentSales) await db.put('sales', s);

          // Shifts — delta + every OPEN shift, then merge with local.
          const allCloudShifts = mergeByIdNewerWins(recentShifts, openShifts);
          loadedShifts = mergeByIdNewerWins(allCloudShifts, localShiftsPre);
          for (const s of allCloudShifts) await db.put('shifts', s);

          // Business settings — last-write-wins, push our default if neither side has one.
          const localSettings = await db.get('businessSettings', 'default');
          if (cloudSettings && localSettings) {
            const cloudTime = cloudSettings.updatedAt ? new Date(cloudSettings.updatedAt).getTime() : 0;
            const localTime = localSettings.updatedAt ? new Date(localSettings.updatedAt).getTime() : 0;
            if (localTime > cloudTime) {
              setBusinessSettings(localSettings);
              await addToSyncQueue('UPDATE_SETTINGS', localSettings);
            } else {
              await db.put('businessSettings', cloudSettings);
              setBusinessSettings(cloudSettings);
            }
          } else if (cloudSettings) {
            await db.put('businessSettings', cloudSettings);
            setBusinessSettings(cloudSettings);
          } else if (localSettings) {
            setBusinessSettings(localSettings);
            await addToSyncQueue('UPDATE_SETTINGS', localSettings);
          } else {
            const defaultSettings: BusinessSettings = {
              id: 'default', businessName: 'Port Side', phone: '+254 700 000000',
              email: '', location: 'Nairobi, Kenya', logoUrl: '',
              receiptFooter: 'Thank you for your business!',
              evolutionApiUrl: '', evolutionApiKey: '', evolutionInstance: '',
              updatedAt: new Date().toISOString(),
            };
            await db.put('businessSettings', defaultSettings);
            setBusinessSettings(defaultSettings);
            // First device online wins — push so every other device pulls these defaults.
            await addToSyncQueue('UPDATE_SETTINGS', defaultSettings);
          }
        } else {
          // Offline: load everything from IndexedDB
          console.log('💾 Offline: Loading critical data from IndexedDB...');
          loadedUsers = await db.getAll('users');
          loadedProducts = await db.getAll('products');
          loadedSales = await db.getAll('sales');
          loadedShifts = await db.getAll('shifts');
          const localSettings = await db.get('businessSettings', 'default');
          if (localSettings) setBusinessSettings(localSettings);
        }

        // First-run seed — only when cloud query completed and returned zero rows
        // AND IndexedDB is empty AND no pending writes are sitting in the queue.
        // This stops a transient empty response from re-seeding and overwriting
        // valid cloud data on later sync.
        const syncCount = await db.count('syncQueue');
        if (loadedUsers.length === 0 && navigator.onLine && syncCount === 0) {
          const legacy = localStorage.getItem('bk_users');
          const seed = legacy ? JSON.parse(legacy) : INITIAL_USERS;
          const final = seed.map((u: any) => {
            if (!u.permissions) {
              if (u.role === Role.ADMIN) return { ...u, permissions: ['POS', 'INVENTORY', 'REPORTS', 'ADMIN'] };
              if (u.role === Role.MANAGER) return { ...u, permissions: ['POS', 'INVENTORY', 'REPORTS'] };
              return { ...u, permissions: ['POS'] };
            }
            return u;
          });
          for (const u of final) {
            await db.put('users', u);
            await addToSyncQueue('ADD_USER', u);
          }
          loadedUsers = final;
        }
        if (loadedProducts.length === 0 && navigator.onLine && syncCount === 0) {
          const legacy = localStorage.getItem('bk_products');
          const seed = legacy ? JSON.parse(legacy) : INITIAL_PRODUCTS;
          for (const p of seed) {
            await db.put('products', p);
            await addToSyncQueue('ADD_PRODUCT', p);
          }
          loadedProducts = seed;
        }

        loadedSales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        loadedShifts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        // Update critical React state — UI unlocks after this
        setUsers(loadedUsers);
        setProducts(loadedProducts);
        setSales(loadedSales);
        setShifts(loadedShifts);

        // Restore user session
        if (savedSession) {
          try {
            const { userId, lastActivity: savedLastActivity } = JSON.parse(savedSession);
            const timeSinceActivity = Date.now() - savedLastActivity;
            const FIVE_MINUTES = 5 * 60 * 1000;
            if (timeSinceActivity < FIVE_MINUTES) {
              const user = loadedUsers.find(u => u.id === userId);
              if (user) {
                setCurrentUser(user);
                setLastActivity(Date.now());
                console.log('✅ Session restored for:', user.name);
              }
            }
          } catch (e) { /* already handled */ }
        }

        console.log('✅ Phase 1 complete — UI is ready.');
      } catch (err) {
        console.error('Critical data load failed:', err);
      } finally {
        // Always unlock the UI after critical phase, even if something failed
        setIsLoading(false);
      }

      // ─── PHASE 2: BACKGROUND DATA (after first paint) ─────────────────
      // Fetches everything Phase 1 didn't plus the FULL historical sales and
      // product-sale-logs so Inventory/Reports KPIs reflect lifetime totals,
      // not just the 7-day Phase-1 window.
      //
      // Strategy per table: two parallel queries that together cover every
      // row not already local:
      //   • "newer" — rows with updatedAt > our newest local row (catches
      //     edits and new inserts we haven't seen yet)
      //   • "older" — rows with the time-column < our oldest local row
      //     (fetches deep history on first run; returns ~nothing on subsequent
      //     runs once history is cached)
      // This is why subsequent app opens transfer almost no data over the wire.
      setTimeout(async () => {
        if (!navigator.onLine) return;
        try {
          console.log('🔄 Phase 2: Loading history (deltas only)...');
          const db2 = await dbPromise();
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

          const [localSales2, localAuditLogs, localVR, localSCR, localPSL] = await Promise.all([
            db2.getAll('sales') as Promise<Sale[]>,
            db2.getAll('auditLogs'),
            db2.getAll('voidRequests'),
            db2.getAll('stockChangeRequests'),
            db2.getAll('productSaleLogs'),
          ]);

          // Helpers for the older/newer split.
          const oldestTimestamp = <T extends { [k: string]: any }>(rows: T[], col: string): string | null => {
            if (!rows.length) return null;
            let min = Infinity;
            for (const r of rows) {
              const v = r[col];
              if (!v) continue;
              const t = new Date(v).getTime();
              if (t < min) min = t;
            }
            return min === Infinity ? null : new Date(min).toISOString();
          };

          const salesWm = maxUpdatedAt(localSales2);
          const salesOldest = oldestTimestamp(localSales2, 'timestamp');
          const auditWm = maxUpdatedAt(localAuditLogs as any[]);
          const vrWm = maxUpdatedAt(localVR as any[]);
          const scrWm = maxUpdatedAt(localSCR as any[]);
          const pslWm = maxUpdatedAt(localPSL as any[]);
          const pslOldest = oldestTimestamp(localPSL as any[], 'timestamp');

          const [
            newerSales,
            olderSales,
            deltaAuditLogs,
            deltaVoidRequests,
            deltaStockRequests,
            newerPSL,
            olderPSL,
          ] = await Promise.all([
            // Sales — delta (anything newer than we know locally)
            fetchAll<Sale>('sales', { column: 'timestamp', ascending: false }, q =>
              salesWm ? q.gt('updatedAt', salesWm) : q
            ),
            // Sales — deep history older than our earliest local row. On truly
            // first run (no local rows) we fetch everything.
            salesOldest
              ? fetchAll<Sale>('sales', { column: 'timestamp', ascending: false }, q =>
                  q.lt('timestamp', salesOldest)
                )
              : Promise.resolve([] as Sale[]),
            fetchAll<AuditLog>('audit_logs', { column: 'timestamp', ascending: false }, q => {
              let qq = q.gte('timestamp', thirtyDaysAgo);
              if (auditWm) qq = qq.gt('updatedAt', auditWm);
              return qq;
            }),
            fetchAll<VoidRequest>('void_requests', { column: 'requestedAt', ascending: false }, q => {
              let qq = q.gte('requestedAt', thirtyDaysAgo);
              if (vrWm) qq = qq.gt('updatedAt', vrWm);
              return qq;
            }),
            fetchAll<StockChangeRequest>('stock_change_requests', { column: 'requestedAt', ascending: false }, q => {
              let qq = q.gte('requestedAt', thirtyDaysAgo);
              if (scrWm) qq = qq.gt('updatedAt', scrWm);
              return qq;
            }),
            // Product sale logs — delta
            fetchAll<ProductSaleLog>('product_sale_logs', { column: 'timestamp', ascending: false }, q =>
              pslWm ? q.gt('updatedAt', pslWm) : q
            ),
            // Product sale logs — deep history
            pslOldest
              ? fetchAll<ProductSaleLog>('product_sale_logs', { column: 'timestamp', ascending: false }, q =>
                  q.lt('timestamp', pslOldest)
                )
              : Promise.resolve([] as ProductSaleLog[]),
          ]);

          console.log(`🔄 Phase 2: sales(+${newerSales.length} new, +${olderSales.length} history), auditLogs=${deltaAuditLogs.length}, voidRequests=${deltaVoidRequests.length}, stockRequests=${deltaStockRequests.length}, productSaleLogs(+${newerPSL.length}/+${olderPSL.length})`);

          // Sales — merge both directions with local.
          const allSales = [...newerSales, ...olderSales];
          const mergedSales = mergeByIdNewerWins(allSales, localSales2);
          mergedSales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          for (const s of allSales) await db2.put('sales', s);
          setSales(mergedSales);

          // Audit logs.
          const mergedAuditLogs = mergeByIdNewerWins(deltaAuditLogs, localAuditLogs as any[]);
          mergedAuditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          for (const l of deltaAuditLogs) await db2.put('auditLogs', l);
          setAuditLogs(mergedAuditLogs);

          // Void requests.
          const mergedVR = mergeByIdNewerWins(deltaVoidRequests, localVR as any[]);
          mergedVR.sort((a, b) => new Date((b as any).requestedAt).getTime() - new Date((a as any).requestedAt).getTime());
          for (const v of deltaVoidRequests) await db2.put('voidRequests', v);
          setVoidRequests(mergedVR);

          // Stock change requests.
          const mergedSCR = mergeByIdNewerWins(deltaStockRequests, localSCR as any[]);
          mergedSCR.sort((a, b) => new Date((b as any).requestedAt).getTime() - new Date((a as any).requestedAt).getTime());
          for (const s of deltaStockRequests) await db2.put('stockChangeRequests', s);
          setStockChangeRequests(mergedSCR);

          // Product sale logs.
          const allPSL = [...newerPSL, ...olderPSL];
          const mergedPSL = mergeByIdNewerWins(allPSL, localPSL as any[]);
          mergedPSL.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          for (const l of allPSL) await db2.put('productSaleLogs', l);
          setProductSaleLogs(mergedPSL);

          setDataLoadedTimestamp(Date.now());
        } catch (bgErr) {
          console.warn('Background data load error (non-fatal):', bgErr);
          const db2 = await dbPromise();
          setSales(await db2.getAll('sales'));
          setAuditLogs(await db2.getAll('auditLogs'));
          setVoidRequests(await db2.getAll('voidRequests'));
          setStockChangeRequests(await db2.getAll('stockChangeRequests'));
          setProductSaleLogs(await db2.getAll('productSaleLogs'));
          setDataLoadedTimestamp(Date.now());
        }
      }, 200); // 200ms gives React time to paint the loading screen before heavy fetch
    };

    loadData();

    // Drains failedSyncQueue back into syncQueue with cleared retry counters,
    // so transient schema/network issues don't strand writes forever. Run on
    // boot AND every time the browser announces we're back online. Self-
    // limiting: items that still fail land back in failedSyncQueue after 5
    // more retries, but now with a fresh lastError message.
    const requeueFailedItems = async () => {
      try {
        const db = await dbPromise();
        const failed = await db.getAll('failedSyncQueue');
        if (failed.length === 0) return;
        console.log(`🔁 Re-queueing ${failed.length} previously-failed sync items for retry`);
        const tx = db.transaction(['syncQueue', 'failedSyncQueue'], 'readwrite');
        for (const item of failed) {
          const { key, failedAt, totalRetries, canRetry, retryCount, lastError, ...rest } = item as any;
          await tx.objectStore('syncQueue').add({ ...rest, retryCount: 0 });
          await tx.objectStore('failedSyncQueue').delete(item.key as number);
        }
        await tx.done;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos:sync-queue-updated'));
        }
      } catch (err) {
        console.warn('Failed-queue re-queue pass error (non-fatal):', err);
      }
    };

    requeueFailedItems();

    // Once-per-schema-version silent reconcile. If this device has never
    // cleaned the legacy random-id phantom logs, do it now. No user click,
    // no UI. If the flag is already set, this is a no-op.
    const RECONCILE_FLAG = 'pos:reconcile_v1_done';
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        if (localStorage.getItem(RECONCILE_FLAG)) return;
        if (!navigator.onLine) return; // needs cloud; will try again next boot
        const r = await reconcileProductSaleLogs();
        console.log(`🧼 Silent boot reconcile: kept ${r.keptFromCloud}, removed ${r.removedLocal}, queued ${r.pushed}`);
        localStorage.setItem(RECONCILE_FLAG, new Date().toISOString());
      } catch (err) {
        console.warn('Silent boot reconcile failed (non-fatal):', err);
      }
    })();

    // Auto-forensic dump: if this device boots with backlog (pending or
    // failed sync items), silently upload a snapshot so the stuck state is
    // captured before anything drains. Throttled to once every 6 hours per
    // device so we don't saturate the snapshot table. The server-side
    // prune trigger keeps only the 3 most recent rows per device regardless.
    const AUTO_DUMP_FLAG = 'pos:last_auto_dump';
    const AUTO_DUMP_THROTTLE_MS = 6 * 60 * 60 * 1000;
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        if (!navigator.onLine) return;
        const lastStr = localStorage.getItem(AUTO_DUMP_FLAG);
        const lastAt = lastStr ? new Date(lastStr).getTime() : 0;
        if (lastAt && Date.now() - lastAt < AUTO_DUMP_THROTTLE_MS) return;

        const db = await dbPromise();
        const [pending, failed] = await Promise.all([
          db.count('syncQueue'),
          db.count('failedSyncQueue'),
        ]);
        if (pending === 0 && failed === 0) return; // nothing worth capturing

        const { dumpLocalState } = await import('../utils/diagnostics');
        const r = await dumpLocalState({
          note: `auto-dump on boot (pending=${pending}, failed=${failed})`,
        });
        localStorage.setItem(AUTO_DUMP_FLAG, new Date().toISOString());
        console.log(`📸 Auto-dump on boot: ${r.id} (${(r.bytes / 1024 / 1024).toFixed(2)} MB)`);
      } catch (err) {
        console.warn('Auto-dump on boot failed (non-fatal):', err);
      }
    })();

    const handleOnline = () => {
      setIsOnline(true);
      // Network just came back — pull anything stuck in failedSyncQueue and
      // let the 2s sync tick push it immediately.
      requeueFailedItems();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Schema preflight: on boot and every 5 minutes. If the cloud schema
    // lacks a column this client intends to write, we know BEFORE a sale
    // tries and fails. Posts 'pos:schema-drift' on issues — AppLayout
    // shows the red banner.
    const runPreflight = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      runSchemaPreflight().then(report => {
        if (!report.ok) {
          console.warn('[Preflight] Schema issues detected:', report.issues);
        } else {
          console.log('[Preflight] Schema OK');
        }
      }).catch(err => console.warn('[Preflight] check failed (non-fatal):', err));
    };
    runPreflight();
    const preflightInterval = setInterval(runPreflight, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(preflightInterval);
    };
  }, []);




  // ------------------------------------------------------------------
  // REALTIME — Supabase Postgres Changes broadcast every INSERT/UPDATE/DELETE
  // to every open device. This is what keeps mobile and laptop in lockstep
  // without waiting for the next pull cycle.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isOnline) return;

    type Setter<T extends { id: string }> = React.Dispatch<React.SetStateAction<T[]>>;
    type Store = 'users' | 'products' | 'sales' | 'shifts' | 'auditLogs'
      | 'voidRequests' | 'stockChangeRequests' | 'productSaleLogs';

    // Keep merge logic identical for inserts and updates: prefer newer updatedAt.
    const upsertInState = <T extends { id: string; updatedAt?: string }>(
      setState: Setter<T>,
      row: T
    ) => {
      setState(prev => {
        const idx = prev.findIndex(x => x.id === row.id);
        if (idx === -1) return [row, ...prev];
        const existing = prev[idx];
        const a = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const b = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
        if (b < a) return prev; // local copy is newer (just-written by us)
        const next = prev.slice();
        next[idx] = row;
        return next;
      });
    };

    const removeFromState = <T extends { id: string }>(setState: Setter<T>, id: string) => {
      setState(prev => prev.filter(x => x.id !== id));
    };

    const subscriptions: Array<{ table: string; store: Store; setState: any }> = [
      { table: 'users', store: 'users', setState: setUsers },
      { table: 'products', store: 'products', setState: setProducts },
      { table: 'sales', store: 'sales', setState: setSales },
      { table: 'shifts', store: 'shifts', setState: setShifts },
      { table: 'audit_logs', store: 'auditLogs', setState: setAuditLogs },
      { table: 'void_requests', store: 'voidRequests', setState: setVoidRequests },
      { table: 'stock_change_requests', store: 'stockChangeRequests', setState: setStockChangeRequests },
      { table: 'product_sale_logs', store: 'productSaleLogs', setState: setProductSaleLogs },
    ];

    const channel = supabase.channel('pos-db-changes');

    for (const { table, store, setState } of subscriptions) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        async (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => {
          try {
            const db = await dbPromise();
            if (payload.eventType === 'DELETE') {
              const id = (payload.old?.id ?? payload.new?.id) as string | undefined;
              if (!id) return;
              await db.delete(store as any, id);
              removeFromState(setState, id);
            } else {
              const row = payload.new;
              if (!row?.id) return;
              await db.put(store as any, row);
              upsertInState(setState, row);
            }
          } catch (err) {
            console.warn(`Realtime ${table} handler error:`, err);
          }
        }
      );
    }

    // Settings live in their own subscription because they're a single row.
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'business_settings' },
      async (payload: any) => {
        try {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new;
          if (!row?.id) return;
          const db = await dbPromise();
          await db.put('businessSettings', row);
          setBusinessSettings(prev => {
            const a = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
            const b = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
            return b < a ? prev : row;
          });
        } catch (err) {
          console.warn('Realtime business_settings handler error:', err);
        }
      }
    );

    // Admin command channel. An INSERT into pos_commands from the Supabase
    // SQL editor (or MCP) triggers an action on every online device. Today:
    //   - 'reload'       → location.reload()
    //   - 'dump_state'   → silent forensic snapshot
    // Commands older than 60 s are ignored so a late subscriber doesn't
    // replay stale instructions.
    channel.on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'pos_commands' },
      async (payload: any) => {
        try {
          const row = payload.new;
          if (!row?.command) return;
          const issuedAt = row.issuedAt ? new Date(row.issuedAt).getTime() : 0;
          if (issuedAt && Date.now() - issuedAt > 60_000) return;
          // Optional device targeting. Omit targetDeviceId to broadcast.
          if (row.targetDeviceId) {
            const { getOrCreateDeviceId } = await import('../utils/diagnostics');
            if (row.targetDeviceId !== getOrCreateDeviceId()) return;
          }
          console.log(`📡 pos_commands received: ${row.command}`, row);
          if (row.command === 'reload') {
            // Brief delay lets the console log flush and lets any in-flight
            // sync tick complete so a sale isn't interrupted mid-upsert.
            setTimeout(() => {
              if (typeof window !== 'undefined') window.location.reload();
            }, 500);
          } else if (row.command === 'dump_state') {
            const { dumpLocalState } = await import('../utils/diagnostics');
            dumpLocalState({
              note: row.note || 'remote-triggered',
              userName: currentUser?.name ?? null,
            }).catch(err => console.warn('remote dump_state failed:', err));
          }
        } catch (err) {
          console.warn('pos_commands handler error:', err);
        }
      }
    );

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('🔌 Realtime channel subscribed');
    });

    return () => { supabase.removeChannel(channel); };
  }, [isOnline]);

  // ------------------------------------------------------------------
  // Session Management
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    localStorage.setItem('pos_session', JSON.stringify({
      userId: currentUser.id,
      lastActivity: lastActivity
    }));

    const inactivityCheck = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const FIVE_MINUTES = 5 * 60 * 1000;

      if (timeSinceActivity >= FIVE_MINUTES) {
        console.log('⏱️ Auto-logout due to inactivity');
        setCurrentUser(null);
        localStorage.removeItem('pos_session');
      }
    }, 30000);

    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      clearInterval(inactivityCheck);
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [currentUser, lastActivity]);

  // ------------------------------------------------------------------
  // SYNC PROCESSOR — drains the entire local syncQueue in batches.
  // Callable directly via triggerSync() after any mutation, plus a
  // 2-second safety-net interval while online.
  // ------------------------------------------------------------------
  const processSyncQueueRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const BATCH_SIZE = 10;

    const processSyncQueue = async () => {
      if (isSyncRunningRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      isSyncRunningRef.current = true;

      try {
        const db = await dbPromise();
        // Drain in batches until empty or until a batch makes no progress.
        while (true) {
          const queueItems = await db.getAll('syncQueue');
          if (queueItems.length === 0) break;

          const USER_ACTION_WINDOW_MS = 30000;
          const isUserTriggered = Date.now() - lastUserActionRef.current < USER_ACTION_WINDOW_MS;
          if (isUserTriggered) setIsSyncing(true);

          const batch = queueItems.slice(0, BATCH_SIZE);
          let successCount = 0;

          for (const item of batch) {
            if (isSyncLockedRef.current) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            try {
              const result = await pushToCloud(item.type, item.payload);
              if (result.ok) {
                await db.delete('syncQueue', item.key!);
                successCount++;
              } else {
                const retryCount = (item.retryCount || 0) + 1;
                const lastError = result.error;
                if (retryCount >= 5) {
                  await db.add('failedSyncQueue', { ...item, lastError, failedAt: Date.now(), totalRetries: retryCount, canRetry: true });
                  await db.delete('syncQueue', item.key!);
                  console.error(`❌ Item ${item.key} moved to failed queue after ${retryCount} retries: ${lastError}`);
                } else {
                  await db.put('syncQueue', { ...item, retryCount, lastError });
                }
              }
            } catch (error) {
              console.error(`Error syncing item ${item.key}:`, error);
            }
          }

          // If nothing succeeded this round, stop — every item failed and is
          // either being retried or moved to the failed queue. Leave the rest
          // for the next interval tick.
          if (successCount === 0) break;
        }
      } catch (error) {
        console.error('Sync queue processing error:', error);
      } finally {
        isSyncRunningRef.current = false;
        setIsSyncing(false);
      }
    };

    processSyncQueueRef.current = processSyncQueue;
    if (isOnline) {
      processSyncQueue();
    }
    const syncInterval = setInterval(() => { if (isOnline) processSyncQueue(); }, 2000);

    return () => {
      clearInterval(syncInterval);
    };
  }, [isOnline]);

  // Callable from any action handler — fires the processor without awaiting.
  const triggerSync = useCallback(() => {
    lastUserActionRef.current = Date.now();
    processSyncQueueRef.current().catch(err => console.warn('triggerSync error:', err));
  }, []);

  // Any addToSyncQueue() call (or inline syncQueue add) dispatches this event;
  // we listen here so the cloud push fires within milliseconds of the mutation.
  useEffect(() => {
    const onQueued = () => triggerSync();
    window.addEventListener(SYNC_QUEUE_EVENT, onQueued);
    return () => window.removeEventListener(SYNC_QUEUE_EVENT, onQueued);
  }, [triggerSync]);

  const currentShift = shifts.find(s => s.status === 'OPEN' && s.cashierId === currentUser?.id) || null;

  // ------------------------------------------------------------------
  // 3. ACTION HANDLERS
  // ------------------------------------------------------------------

  const addLog = async (action: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: newId(),
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      details,
    };

    setAuditLogs(prev => [newLog, ...prev]);

    const db = await dbPromise();
    await db.put('auditLogs', newLog);

    await addToSyncQueue('LOG', newLog);
  };

  const login = (pin: string) => {
    const user = users.find(u => u.pin === pin);
    if (user) {
      setCurrentUser(user);
      setLastActivity(Date.now());
      localStorage.setItem('pos_session', JSON.stringify({
        userId: user.id,
        lastActivity: Date.now()
      }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pos_session');
  };

  const updateUser = async (updatedUser: User) => {
    const userWithTimestamp = { ...updatedUser, updatedAt: new Date().toISOString() };
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? userWithTimestamp : u));
    const db = await dbPromise();
    await db.put('users', userWithTimestamp);
    await addLog('USER_UPDATE', `Updated user details for ${updatedUser.name}`);
    await addToSyncQueue('UPDATE_USER', userWithTimestamp);
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: newId(),
      updatedAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    const db = await dbPromise();
    await db.put('users', newUser);
    await addLog('USER_ADD', `Added new user: ${newUser.name} (${newUser.role})`);
    await addToSyncQueue('ADD_USER', newUser);
  };

  const deleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      const db = await dbPromise();
      await db.delete('users', userId);
      await addLog('USER_DELETE', `Deleted user: ${user.name}`);
      await addToSyncQueue('DELETE_USER', { id: userId });
    }
  };

  const openShift = async (openingCash: number = 0) => {
    if (!currentUser) return;
    const newShift: Shift = {
      id: newId(),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      startTime: new Date().toISOString(),
      openingCash,
      status: 'OPEN',
    };
    setShifts(prev => [...prev, newShift]);

    const db = await dbPromise();
    await db.put('shifts', newShift);

    const details = openingCash > 0
      ? `Shift opened with ${CURRENCY_FORMATTER.format(openingCash)}`
      : `Shift opened (No Float)`;

    await addLog('SHIFT_OPEN', details);
    await addToSyncQueue('OPEN_SHIFT', newShift);
  };

  // Create a CLOSED shift after the fact to cover orphan sales (sales rung up
  // when no shift was open). Time window tightens to 1 minute before the
  // earliest orphan and 1 minute after the latest so it can't accidentally
  // swallow sales from a neighbouring real shift. Closing cash = expected cash
  // so reconciliation shows zero variance; admin can edit later.
  const createBackfillShift = async (params: {
    cashierId: string;
    cashierName: string;
    startTime: string;
    endTime: string;
    expectedCash: number;
    comments?: string;
  }): Promise<Shift> => {
    const newShift: Shift = {
      id: newId(),
      cashierId: params.cashierId,
      cashierName: params.cashierName,
      startTime: params.startTime,
      endTime: params.endTime,
      openingCash: 0,
      closingCash: params.expectedCash,
      expectedCash: params.expectedCash,
      status: 'CLOSED',
      comments: params.comments || `Backfill shift created by ${currentUser?.name ?? 'admin'} to attribute orphan sales.`,
      updatedAt: new Date().toISOString(),
    };

    setShifts(prev => [...prev, newShift]);
    const db = await dbPromise();
    await db.put('shifts', newShift);
    await addToSyncQueue('CLOSE_SHIFT', newShift);
    await addLog(
      'SHIFT_BACKFILL',
      `Backfill shift created for ${params.cashierName} covering ${new Date(params.startTime).toLocaleString()} → ${new Date(params.endTime).toLocaleString()}, revenue ${CURRENCY_FORMATTER.format(params.expectedCash)}`,
    );
    return newShift;
  };

  const closeShift = async (
    closingCash: number,
    comments?: string,
    opts?: { expectedCash?: number },
  ): Promise<Shift | undefined> => {
    if (!currentShift) return undefined;
    // Synchronous guard — a rapid double-submit can fire the second call
    // before the first `setShifts` has committed, so `if (!currentShift)`
    // alone is not enough.
    if (isClosingShiftRef.current) return undefined;
    isClosingShiftRef.current = true;

    try {
      // The exact instant the close fires. We use the same moment as both
      // the shift's endTime and the upper bound of the sales filter so the
      // saved shift window exactly matches what was counted.
      const closedAt = new Date();

      // If the caller pre-computed expectedCash (POS modal already shows it
      // on the receipt), trust that number — eliminates divergence between
      // what the cashier sees and what the database stores. Otherwise
      // compute it here with the canonical helper.
      const expected = opts?.expectedCash ?? shiftCashExpected(currentShift, sales, closedAt).expectedCash;

      const updatedShift: Shift = {
        ...currentShift,
        endTime: closedAt.toISOString(),
        closingCash,
        expectedCash: expected,
        status: 'CLOSED',
        comments,
        updatedAt: closedAt.toISOString(),
      };

      setShifts(prev => prev.map(s => s.id === currentShift.id ? updatedShift : s));

      const db = await dbPromise();
      await db.put('shifts', updatedShift);
      await addLog(
        'SHIFT_CLOSE',
        `Shift closed. Counted: ${CURRENCY_FORMATTER.format(closingCash)}, Expected: ${CURRENCY_FORMATTER.format(expected)}${comments ? `. Comments: ${comments}` : ''}`,
      );
      await addToSyncQueue('CLOSE_SHIFT', updatedShift);
      return updatedShift;
    } finally {
      isClosingShiftRef.current = false;
    }
  };

  /**
   * PROCESS SALE - FIXED VERSION
   * ✅ FIX 1: Unique Sale ID with random suffix
   * ✅ FIX 2: Deterministic Log ID (saleId-productId)
   * ✅ FIX 3: Duplicate check before creating logs
   */
  const processSale = async (
    items: SaleItem[],
    paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'SPLIT',
    splitPayment?: { cashAmount: number; mobileAmount: number }
  ) => {
    if (!currentUser) return undefined;

    // Synchronous ref check prevents race condition from rapid double-clicks
    if (isSyncLockedRef.current) {
      throw new Error('Another sale is being processed. Please wait.');
    }
    isSyncLockedRef.current = true;
    lastUserActionRef.current = Date.now(); // Stamp user action so sync toast shows

    try {
      const db = await dbPromise();
      const tx = db.transaction(['sales', 'products', 'productSaleLogs', 'syncQueue'], 'readwrite');

      // 1. Validation Phase
      for (const item of items) {
        const dbProduct = await tx.objectStore('products').get(item.productId);
        if (!dbProduct) {
          throw new Error(`Product not found: ${item.productName}`);
        }

        // 🚨 NEW VALIDATION: HARD STOP FOR ZERO COST
        if (!dbProduct.costPrice || dbProduct.costPrice <= 0) {
          throw new Error(
            `❌ CANNOT SELL: '${dbProduct.name}' has no Buying Price (Cost) recorded. ` +
            `Please ask a manager to update the Cost Price in Inventory before selling this item to prevent corrupted profit reports.`
          );
        }

        if (dbProduct.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${dbProduct.name}.`);
        }
      }

      // 2. Create Sale with Unique ID
      const timestamp = new Date().toISOString();
      const totalAmount = items.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
      const totalCost = items.reduce((acc, item) => acc + (item.costAtSale * item.quantity), 0);

      // ✅ FIX 1: Unique Sale ID (timestamp + random suffix)
      const saleId = newId();

      const newSale: Sale = {
        id: saleId,
        timestamp,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        items,
        totalAmount,
        totalCost,
        paymentMethod,
        splitPayment,
        isVoided: false,
      };

      // 3. Update Products and Create Logs
      const updatedProducts: Product[] = [];
      const newProductSaleLogs: ProductSaleLog[] = [];
      const stockDeltaItems: Array<{ productId: string; quantity: number }> = [];

      for (const item of items) {
        const dbProduct = await tx.objectStore('products').get(item.productId);
        if (!dbProduct) continue;

        const updatedProduct = {
          ...dbProduct,
          stock: dbProduct.stock - item.quantity,
          updatedAt: new Date().toISOString()
        };

        updatedProducts.push(updatedProduct);
        await tx.objectStore('products').put(updatedProduct);
        stockDeltaItems.push({ productId: item.productId, quantity: item.quantity });

        const logId = `${newSale.id}-${item.productId}`;
        const existingLog = await tx.objectStore('productSaleLogs').get(logId);

        if (!existingLog) {
          const saleLog: ProductSaleLog = {
            id: logId,
            productId: item.productId,
            productName: item.productName,
            saleId: newSale.id,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            costAtSale: item.costAtSale,
            timestamp: newSale.timestamp,
            cashierId: currentUser.id,
            cashierName: currentUser.name
          };

          newProductSaleLogs.push(saleLog);
          await tx.objectStore('productSaleLogs').put(saleLog);
          await tx.objectStore('syncQueue').add({
            type: 'PRODUCT_SALE_LOG',
            payload: saleLog,
            timestamp: Date.now()
          });
        } else {
          console.warn(`⚠️ Duplicate log detected for sale ${newSale.id} - product ${item.productId}. Skipping.`);
        }
      }

      // 4. Save Sale and enqueue the atomic SALE_WITH_STOCK — stock is only
      //    decremented in the cloud if the sale upsert succeeds.
      await tx.objectStore('sales').put(newSale);
      await tx.objectStore('syncQueue').add({
        type: 'SALE_WITH_STOCK',
        payload: { sale: newSale, items: stockDeltaItems },
        timestamp: Date.now()
      });

      await tx.done;
      triggerSync();

      // Update React State
      setProducts(prev => prev.map(p => {
        const updated = updatedProducts.find(up => up.id === p.id);
        return updated || p;
      }));
      setSales(prev => [newSale, ...prev]);
      setProductSaleLogs(prev => [...newProductSaleLogs, ...prev]);

      await addLog('SALE', `Sale #${newSale.id} processed for ${CURRENCY_FORMATTER.format(totalAmount)} via ${paymentMethod}`);

      return newSale;
    } catch (error) {
      console.error('Sale processing failed:', error);
      throw error;
    } finally {
      isSyncLockedRef.current = false;
    }
  };

  const updateSale = async (updatedSale: Sale) => {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));

    const db = await dbPromise();
    await db.put('sales', updatedSale);

    await addToSyncQueue('UPDATE_SALE', updatedSale);
    await addLog('SALE_UPDATE', `Updated sale #${updatedSale.id.slice(-8)} - Total: ${CURRENCY_FORMATTER.format(updatedSale.totalAmount)}`);
  };

  const deleteSale = async (saleId: string) => {
    if (!currentUser) return;

    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    if (sale.isVoided) {
      throw new Error('Cannot delete a voided sale. Voided sales are already reversed.');
    }

    const db = await dbPromise();
    const tx = db.transaction(['sales', 'products', 'productSaleLogs', 'syncQueue'], 'readwrite');

    try {
      const updatedProducts = [...products];

      for (const item of sale.items) {
        const dbProduct = await tx.objectStore('products').get(item.productId);

        if (dbProduct) {
          const restoredStock = dbProduct.stock + item.quantity;

          const updatedProduct = {
            ...dbProduct,
            stock: restoredStock,
            updatedAt: new Date().toISOString()
          };

          const idx = updatedProducts.findIndex(p => p.id === item.productId);
          if (idx > -1) updatedProducts[idx] = updatedProduct;

          await tx.objectStore('products').put(updatedProduct);

          await tx.objectStore('syncQueue').add({
            type: 'SALE_STOCK_DELTA',
            payload: {
              productId: item.productId,
              quantity: -item.quantity
            },
            timestamp: Date.now()
          });
        }
      }

      const allLogs = await tx.objectStore('productSaleLogs').getAll();
      const logsToDelete = allLogs.filter(log => log.saleId === saleId);

      for (const log of logsToDelete) {
        await tx.objectStore('productSaleLogs').delete(log.id);
        await tx.objectStore('syncQueue').add({
          type: 'DELETE_PRODUCT_SALE_LOG',
          payload: { id: log.id },
          timestamp: Date.now()
        });
      }

      await tx.objectStore('sales').delete(saleId);
      await tx.objectStore('syncQueue').add({
        type: 'DELETE_SALE',
        payload: { id: saleId },
        timestamp: Date.now()
      });

      await tx.done;
      triggerSync();

      setProducts(updatedProducts);
      setSales(prev => prev.filter(s => s.id !== saleId));
      setProductSaleLogs(prev => prev.filter(log => log.saleId !== saleId));

      await addLog('SALE_DELETE', `Deleted sale #${saleId.slice(-8)} - Stock restored for ${sale.items.length} items`);

      console.log(`✅ Sale ${saleId} deleted successfully. Stock restored.`);
    } catch (error) {
      console.error('Sale deletion failed:', error);
      throw error;
    }
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...productData,
      id: newId(),
      updatedAt: new Date().toISOString(),
    };
    setProducts(prev => [...prev, newProduct]);

    const db = await dbPromise();
    await db.put('products', newProduct);
    lastUserActionRef.current = Date.now();
    await addLog('PRODUCT_ADD', `Added product: ${newProduct.name} (${newProduct.size})`);
    await addToSyncQueue('ADD_PRODUCT', newProduct);
  };

  const updateProduct = async (product: Product, skipConflictCheck: boolean = false) => {
    if (!currentUser) throw new Error('No user logged in');

    const db = await dbPromise();

    if (!skipConflictCheck) {
      const currentProduct = products.find(p => p.id === product.id);
      const dbProduct = await db.get('products', product.id);

      if (dbProduct && currentProduct) {
        if (product.version !== undefined && dbProduct.version !== undefined) {
          if (product.version < dbProduct.version) {
            throw new Error(
              `CONFLICT: This product was modified by ${dbProduct.lastModifiedByName || 'another user'}. ` +
              `Please refresh and try again. Your version: ${product.version}, Current version: ${dbProduct.version}`
            );
          }
        }

        if (product.updatedAt && dbProduct.updatedAt) {
          const productTime = new Date(product.updatedAt).getTime();
          const dbTime = new Date(dbProduct.updatedAt).getTime();

          if (productTime < dbTime) {
            throw new Error(
              `CONFLICT: This product was modified by ${dbProduct.lastModifiedByName || 'another user'} ` +
              `at ${new Date(dbProduct.updatedAt).toLocaleString()}. Please refresh and try again.`
            );
          }
        }
      }
    }

    const oldProduct = products.find(p => p.id === product.id);
    const priceHistory = product.priceHistory || oldProduct?.priceHistory || [];

    if (oldProduct && (oldProduct.costPrice !== product.costPrice || oldProduct.sellingPrice !== product.sellingPrice)) {
      const priceChange = {
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        oldCostPrice: oldProduct.costPrice,
        newCostPrice: product.costPrice,
        oldSellingPrice: oldProduct.sellingPrice,
        newSellingPrice: product.sellingPrice,
      };
      priceHistory.push(priceChange);

      await addLog(
        'PRICE_CHANGE',
        `${product.name}: Cost ${oldProduct.costPrice} → ${product.costPrice}, ` +
        `Selling ${oldProduct.sellingPrice} → ${product.sellingPrice}`
      );
    }

    const productWithMetadata = {
      ...product,
      updatedAt: new Date().toISOString(),
      version: (product.version || 0) + 1,
      lastModifiedBy: currentUser.id,
      lastModifiedByName: currentUser.name,
      priceHistory,
    };

    const tx = db.transaction(['products', 'syncQueue'], 'readwrite');
    try {
      await tx.objectStore('products').put(productWithMetadata);
      await tx.objectStore('syncQueue').add({
        type: 'UPDATE_PRODUCT',
        payload: productWithMetadata,
        timestamp: Date.now()
      });
      await tx.done;
      triggerSync();

      setProducts(prev => prev.map(p => p.id === product.id ? productWithMetadata : p));

      await addLog('PRODUCT_EDIT', `Updated product: ${product.name} (${product.size})`);
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  };

  const deleteProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setProducts(prev => prev.filter(p => p.id !== productId));

    const db = await dbPromise();
    await db.delete('products', productId);
    await addLog('PRODUCT_DELETE', `Deleted product: ${product.name} (${product.size})`);
    await addToSyncQueue('DELETE_PRODUCT', { id: productId });
  };

  const adjustStock = async (productId: string, change: number, reason: string) => {
    if (!currentUser) throw new Error('No user logged in');

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const updatedProduct = {
      ...product,
      stock: product.stock + change,
      updatedAt: new Date().toISOString(),
      version: (product.version || 0) + 1,
      lastModifiedBy: currentUser.id,
      lastModifiedByName: currentUser.name
    };

    const db = await dbPromise();
    const tx = db.transaction(['products', 'syncQueue'], 'readwrite');

    try {
      await tx.objectStore('products').put(updatedProduct);
      await tx.objectStore('syncQueue').add({
        type: 'ADJUST_STOCK',
        payload: updatedProduct,
        timestamp: Date.now()
      });
      await tx.done;
      triggerSync();

      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      await addLog('INVENTORY_ADJ', `Adjusted ${product.name} by ${change}. Reason: ${reason}`);
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      throw error;
    }
  };

  const receiveStock = async (productId: string, quantity: number, newCost?: number, supplierName?: string) => {
    if (!currentUser) throw new Error('No user logged in');

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const priceHistory = product.priceHistory || [];
    const priceChanged = newCost !== undefined && newCost !== product.costPrice;

    if (priceChanged) {
      const priceChange = {
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        oldCostPrice: product.costPrice,
        newCostPrice: newCost!,
        oldSellingPrice: product.sellingPrice,
        newSellingPrice: product.sellingPrice,
        reason: `Stock receipt: ${quantity} units received`
      };
      priceHistory.push(priceChange);

      await addLog(
        'PRICE_CHANGE',
        `${product.name}: Cost price changed from ${product.costPrice} to ${newCost} during stock receipt`
      );
    }

    const updatedProduct = {
      ...product,
      stock: product.stock + quantity,
      costPrice: newCost !== undefined ? newCost : product.costPrice,
      updatedAt: new Date().toISOString(),
      version: (product.version || 0) + 1,
      lastModifiedBy: currentUser.id,
      lastModifiedByName: currentUser.name,
      priceHistory
    };

    const db = await dbPromise();
    const tx = db.transaction(['products', 'syncQueue', 'stockChangeRequests'], 'readwrite');

    try {
      const stockRequest: StockChangeRequest = {
        id: newId(),
        productId,
        productName: product.name,
        changeType: 'RECEIVE',
        quantityChange: quantity,
        newCost,
        supplierName,
        requestedBy: currentUser.id,
        requestedByName: currentUser.name,
        requestedAt: new Date().toISOString(),
        status: 'APPROVED',
        currentStock: product.stock,
        reviewedBy: currentUser.id,
        reviewedByName: currentUser.name,
        reviewedAt: new Date().toISOString(),
        reviewNotes: 'Auto-approved receiver stock input',
      };

      await tx.objectStore('products').put(updatedProduct);
      await tx.objectStore('stockChangeRequests').put(stockRequest);
      await tx.objectStore('syncQueue').add({
        type: 'RECEIVE_STOCK',
        payload: updatedProduct,
        timestamp: Date.now()
      });
      await tx.objectStore('syncQueue').add({
        type: 'STOCK_CHANGE_APPROVED',
        payload: { request: stockRequest, product: updatedProduct },
        timestamp: Date.now()
      });
      await tx.done;
      triggerSync();

      lastUserActionRef.current = Date.now(); // Stamp so sync toast shows after stock receipt
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      setStockChangeRequests(prev => [stockRequest, ...prev]);

      const logMessage = priceChanged
        ? `Received ${quantity} of ${product.name} (${product.size}) from ${supplierName || 'Unknown'}. Cost price updated to ${newCost}.`
        : `Received ${quantity} of ${product.name} (${product.size}) from ${supplierName || 'Unknown'}.`;
      await addLog('STOCK_RECEIVE', logMessage);
    } catch (error) {
      console.error('Failed to receive stock:', error);
      throw error;
    }
  };

  const requestVoid = async (saleId: string, reason: string) => {
    if (!currentUser) return;
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    const newRequest: VoidRequest = {
      id: newId(),
      saleId,
      sale,
      requestedBy: currentUser.id,
      requestedByName: currentUser.name,
      requestedAt: new Date().toISOString(),
      reason,
      status: 'PENDING',
    };

    setVoidRequests(prev => [newRequest, ...prev]);
    const db = await dbPromise();
    await db.put('voidRequests', newRequest);
    await addLog('VOID_REQUEST', `Requested void for Sale #${saleId}. Reason: ${reason}`);
    await addToSyncQueue('VOID_REQUEST', newRequest);
  };

  const approveVoid = async (requestId: string, notes?: string) => {
    if (!currentUser) return;
    const request = voidRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'PENDING') return;

    const updatedRequest: VoidRequest = {
      ...request,
      status: 'APPROVED',
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    };

    const updatedSale: Sale = {
      ...request.sale,
      isVoided: true,
      voidedAt: new Date().toISOString(),
      voidedBy: currentUser.name,
      voidReason: request.reason,
    };

    const db = await dbPromise();
    const tx = db.transaction(['voidRequests', 'sales', 'products', 'syncQueue'], 'readwrite');

    try {
      await tx.objectStore('voidRequests').put(updatedRequest);
      await tx.objectStore('sales').put(updatedSale);

      const updatedProducts = [...products];

      for (const item of request.sale.items) {
        const dbProduct = await tx.objectStore('products').get(item.productId);

        if (dbProduct) {
          const updatedProduct = {
            ...dbProduct,
            stock: dbProduct.stock + item.quantity,
            updatedAt: new Date().toISOString()
          };

          const idx = updatedProducts.findIndex(p => p.id === item.productId);
          if (idx > -1) updatedProducts[idx] = updatedProduct;

          await tx.objectStore('products').put(updatedProduct);

          await tx.objectStore('syncQueue').add({
            type: 'SALE_STOCK_DELTA',
            payload: {
              productId: item.productId,
              quantity: -item.quantity
            },
            timestamp: Date.now()
          });
        }
      }

      await tx.objectStore('syncQueue').add({
        type: 'VOID_APPROVED',
        payload: { request: updatedRequest, sale: updatedSale },
        timestamp: Date.now()
      });

      await tx.done;
      triggerSync();

      setVoidRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));
      setSales(prev => prev.map(s => s.id === request.saleId ? updatedSale : s));
      setProducts(updatedProducts);

      await addLog('VOID_APPROVED', `Approved void for Sale #${request.saleId}${notes ? `. Notes: ${notes}` : ''}`);
    } catch (error) {
      console.error('Failed to approve void:', error);
      throw error;
    }
  };

  const rejectVoid = async (requestId: string, notes?: string) => {
    if (!currentUser) return;
    const request = voidRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'PENDING') return;

    const updatedRequest: VoidRequest = {
      ...request,
      status: 'REJECTED',
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    };

    setVoidRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));
    const db = await dbPromise();
    await db.put('voidRequests', updatedRequest);
    await addLog('VOID_REJECTED', `Rejected void for Sale #${request.saleId}${notes ? `. Notes: ${notes}` : ''}`);
    await addToSyncQueue('VOID_REJECTED', updatedRequest);
  };

  const requestStockChange = async (
    productId: string,
    changeType: 'ADJUST' | 'RECEIVE',
    quantityChange: number,
    reason?: string,
    newCost?: number,
    supplierName?: string
  ) => {
    if (!currentUser) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newRequest: StockChangeRequest = {
      id: newId(),
      productId,
      productName: product.name,
      changeType,
      quantityChange,
      reason,
      newCost,
      supplierName,
      requestedBy: currentUser.id,
      requestedByName: currentUser.name,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      currentStock: product.stock,
    };

    setStockChangeRequests(prev => [newRequest, ...prev]);
    const db = await dbPromise();
    await db.put('stockChangeRequests', newRequest);
    await addLog('STOCK_CHANGE_REQUEST', `Requested ${changeType.toLowerCase()} for ${product.name}: ${quantityChange > 0 ? '+' : ''}${quantityChange}${reason ? `. Reason: ${reason}` : ''}`);
    await addToSyncQueue('STOCK_CHANGE_REQUEST', newRequest);
  };

  const approveStockChange = async (requestId: string, notes?: string) => {
    if (!currentUser) return;
    const request = stockChangeRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'PENDING') return;

    const updatedRequest: StockChangeRequest = {
      ...request,
      status: 'APPROVED',
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    };

    const product = products.find(p => p.id === request.productId);
    if (!product) return;

    const updatedProduct = {
      ...product,
      stock: product.stock + request.quantityChange,
      costPrice: request.newCost !== undefined ? request.newCost : product.costPrice,
      updatedAt: new Date().toISOString()
    };

    setStockChangeRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));
    setProducts(prev => prev.map(p => p.id === request.productId ? updatedProduct : p));

    const db = await dbPromise();
    await db.put('stockChangeRequests', updatedRequest);
    await db.put('products', updatedProduct);

    await addLog('STOCK_CHANGE_APPROVED', `Approved ${request.changeType.toLowerCase()} for ${request.productName}: ${request.quantityChange > 0 ? '+' : ''}${request.quantityChange}${notes ? `. Notes: ${notes}` : ''}`);
    await addToSyncQueue('STOCK_CHANGE_APPROVED', { request: updatedRequest, product: updatedProduct });
  };

  const rejectStockChange = async (requestId: string, notes?: string) => {
    if (!currentUser) return;
    const request = stockChangeRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'PENDING') return;

    const updatedRequest: StockChangeRequest = {
      ...request,
      status: 'REJECTED',
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    };

    setStockChangeRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));
    const db = await dbPromise();
    await db.put('stockChangeRequests', updatedRequest);
    await addLog('STOCK_CHANGE_REJECTED', `Rejected ${request.changeType.toLowerCase()} for ${request.productName}${notes ? `. Notes: ${notes}` : ''}`);
    await addToSyncQueue('STOCK_CHANGE_REJECTED', updatedRequest);
  };

  const updateBusinessSettings = async (settings: BusinessSettings) => {
    setBusinessSettings(settings);
    const db = await dbPromise();
    await db.put('businessSettings', settings);
    await addLog('SETTINGS_UPDATE', `Updated business settings: ${settings.businessName}`);
    await addToSyncQueue('UPDATE_SETTINGS', settings);
  };

  const prepareDataFix = async (): Promise<{ salesChanges: SaleReconciliation[]; productChanges: ProductReconciliation[] }> => {
    console.log('🔍 Analyzing data for reconciliation...');

    const salesChanges: SaleReconciliation[] = [];
    const productChanges: ProductReconciliation[] = [];

    const corruptedSales = sales.filter(sale =>
      sale.totalAmount === 0 || sale.totalCost === 0 ||
      sale.items.some(item => item.priceAtSale === 0 || item.costAtSale === 0)
    );

    for (const sale of corruptedSales) {
      const priceChanges: Array<{
        productName: string;
        size: string;
        oldPrice: number;
        newPrice: number;
        oldCost: number;
        newCost: number;
        quantity: number;
      }> = [];

      let canFix = true;
      const updatedItems: SaleItem[] = [];

      for (const item of sale.items) {
        let product = products.find(p => p.id === item.productId);

        if (!product) {
          product = products.find(p =>
            p.name.toLowerCase() === item.productName.toLowerCase() &&
            p.size === item.size
          );
        }

        if (!product) {
          canFix = false;
          break;
        }

        const newPriceAtSale = item.priceAtSale === 0 ? product.sellingPrice : item.priceAtSale;
        const newCostAtSale = item.costAtSale === 0 ? product.costPrice : item.costAtSale;

        if (newPriceAtSale === 0 || newCostAtSale === 0) {
          canFix = false;
          break;
        }

        if (item.priceAtSale !== newPriceAtSale || item.costAtSale !== newCostAtSale) {
          priceChanges.push({
            productName: item.productName,
            size: item.size,
            oldPrice: item.priceAtSale,
            newPrice: newPriceAtSale,
            oldCost: item.costAtSale,
            newCost: newCostAtSale,
            quantity: item.quantity
          });
        }

        updatedItems.push({
          ...item,
          productId: product.id,
          priceAtSale: newPriceAtSale,
          costAtSale: newCostAtSale
        });
      }

      if (canFix && priceChanges.length > 0) {
        const newTotalAmount = updatedItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
        const newTotalCost = updatedItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);

        salesChanges.push({
          originalSale: sale,
          fixedSale: {
            ...sale,
            items: updatedItems,
            totalAmount: newTotalAmount,
            totalCost: newTotalCost
          },
          priceChanges
        });
      }
    }

    const productSalesMap = new Map<string, number>();
    for (const sale of sales) {
      if (sale.isVoided) continue;
      for (const item of sale.items) {
        const currentCount = productSalesMap.get(item.productId) || 0;
        productSalesMap.set(item.productId, currentCount + item.quantity);
      }
    }

    for (const product of products) {
      const calculatedUnitsSold = productSalesMap.get(product.id) || 0;
      const currentUnitsSold = product.unitsSold || 0;
      const cost = Number(product.costPrice) || 0;
      const stock = Number(product.stock) || 0;

      let needsUpdate = false;
      let newStock = stock;
      let newCostPrice = cost;

      if (cost > 1000000 || cost < 0) {
        newCostPrice = 0;
        needsUpdate = true;
      }
      if (stock > 100000 || stock < 0) {
        newStock = 0;
        needsUpdate = true;
      }

      if (calculatedUnitsSold !== currentUnitsSold || needsUpdate) {
        productChanges.push({
          product,
          oldUnitsSold: currentUnitsSold,
          newUnitsSold: calculatedUnitsSold,
          oldStock: needsUpdate ? stock : undefined,
          newStock: needsUpdate ? newStock : undefined,
          oldCostPrice: (cost > 1000000 || cost < 0) ? cost : undefined,
          newCostPrice: (cost > 1000000 || cost < 0) ? newCostPrice : undefined
        });
      }
    }

    console.log(`📊 Analysis complete: ${salesChanges.length} sales to fix, ${productChanges.length} products to update`);
    return { salesChanges, productChanges };
  };

  const applyDataFix = async (
    salesChanges: SaleReconciliation[],
    productChanges: ProductReconciliation[]
  ): Promise<{ fixed: number; total: number }> => {
    console.log('✅ Applying data fixes...');
    const db = await dbPromise();

    let fixedCount = 0;

    if (salesChanges.length > 0) {
      const tx = db.transaction(['sales', 'productSaleLogs'], 'readwrite');

      for (const change of salesChanges) {
        await tx.objectStore('sales').put(change.fixedSale);

        for (const item of change.fixedSale.items) {
          const existingLogs = productSaleLogs.filter(
            log => log.saleId === change.fixedSale.id && log.productId === item.productId
          );

          for (const log of existingLogs) {
            const updatedLog: ProductSaleLog = {
              ...log,
              priceAtSale: item.priceAtSale,
              costAtSale: item.costAtSale
            };
            await tx.objectStore('productSaleLogs').put(updatedLog);
          }
        }
        fixedCount++;
      }

      await tx.done;

      setSales(prev => prev.map(sale => {
        const updated = salesChanges.find(c => c.originalSale.id === sale.id);
        return updated ? updated.fixedSale : sale;
      }));
    }

    if (productChanges.length > 0) {
      const tx2 = db.transaction(['products', 'syncQueue'], 'readwrite');

      for (const change of productChanges) {
        const updatedProduct = {
          ...change.product,
          unitsSold: change.newUnitsSold,
          stock: change.newStock !== undefined ? change.newStock : change.product.stock,
          costPrice: change.newCostPrice !== undefined ? change.newCostPrice : change.product.costPrice,
          updatedAt: new Date().toISOString()
        };

        await tx2.objectStore('products').put(updatedProduct);

        await tx2.objectStore('syncQueue').add({
          type: 'UPDATE_PRODUCT',
          payload: updatedProduct,
          timestamp: Date.now()
        });

        fixedCount++;
      }

      await tx2.done;

      setProducts(prev => prev.map(product => {
        const updated = productChanges.find(c => c.product.id === product.id);
        if (updated) {
          return {
            ...product,
            unitsSold: updated.newUnitsSold,
            stock: updated.newStock !== undefined ? updated.newStock : product.stock,
            costPrice: updated.newCostPrice !== undefined ? updated.newCostPrice : product.costPrice,
            updatedAt: new Date().toISOString()
          };
        }
        return product;
      }));
    }

    if (salesChanges.length > 0) {
      console.log('📊 Recalculating unitsSold for affected products...');
      const affectedProductIds = new Set<string>();
      salesChanges.forEach(change => {
        change.fixedSale.items.forEach(item => affectedProductIds.add(item.productId));
      });

      const allSales = await db.getAll('sales');
      const productSalesMap = new Map<string, number>();

      for (const sale of allSales) {
        if (sale.isVoided) continue;
        for (const item of sale.items) {
          if (affectedProductIds.has(item.productId)) {
            const currentCount = productSalesMap.get(item.productId) || 0;
            productSalesMap.set(item.productId, currentCount + item.quantity);
          }
        }
      }

      const tx3 = db.transaction(['products', 'syncQueue'], 'readwrite');
      for (const productId of affectedProductIds) {
        const product = products.find(p => p.id === productId);
        if (product) {
          const correctUnitsSold = productSalesMap.get(productId) || 0;
          if (product.unitsSold !== correctUnitsSold) {
            const updatedProduct = {
              ...product,
              unitsSold: correctUnitsSold,
              updatedAt: new Date().toISOString()
            };
            await tx3.objectStore('products').put(updatedProduct);
            await tx3.objectStore('syncQueue').add({
              type: 'UPDATE_PRODUCT',
              payload: updatedProduct,
              timestamp: Date.now()
            });
            console.log(`  ✓ ${product.name}: unitsSold corrected to ${correctUnitsSold}`);

            setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
          }
        }
      }
      await tx3.done;
    }

    await addLog('DATA_FIX', `Applied data fixes: ${salesChanges.length} sales corrected, ${productChanges.length} products updated`);

    console.log(`✅ Data fix complete: ${fixedCount} items fixed`);
    return { fixed: fixedCount, total: salesChanges.length + productChanges.length };
  };

  const fixCorruptedSales = async (): Promise<{ fixed: number; total: number }> => {
    console.log('🔧 Starting comprehensive data fix...');
    const db = await dbPromise();

    let fixedCount = 0;
    let skippedCount = 0;
    let missingLogsCreated = 0;
    const unfixableSales: string[] = [];

    const corruptedSales = sales.filter(sale =>
      sale.totalAmount === 0 || sale.totalCost === 0 ||
      sale.items.some(item => item.priceAtSale === 0 || item.costAtSale === 0)
    );

    console.log(`Found ${corruptedSales.length} corrupted sales to fix`);

    const updatedSales: Sale[] = [];
    const updatedLogs: ProductSaleLog[] = [];
    const newLogs: ProductSaleLog[] = [];
    const updatedProducts: Product[] = [];

    const tx = db.transaction(['sales', 'productSaleLogs'], 'readwrite');

    for (const sale of corruptedSales) {
      let canFix = true;
      const updatedItems: SaleItem[] = [];
      const unfixableReasons: string[] = [];

      for (const item of sale.items) {
        let product = products.find(p => p.id === item.productId);
        if (!product) {
          product = products.find(p =>
            p.name.toLowerCase() === item.productName.toLowerCase() && p.size === item.size
          );
        }

        if (!product) {
          unfixableReasons.push(`Product not found: ${item.productName}`);
          canFix = false;
          break;
        }

        let newPriceAtSale = item.priceAtSale;
        let newCostAtSale = item.costAtSale;

        if (item.priceAtSale === 0 || item.costAtSale === 0) {
          if (product.priceHistory && product.priceHistory.length > 0) {
            const saleDate = new Date(sale.timestamp).getTime();
            const relevantPriceChange = product.priceHistory
              .filter(ph => new Date(ph.timestamp).getTime() <= saleDate)
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

            if (relevantPriceChange) {
              if (item.priceAtSale === 0) newPriceAtSale = relevantPriceChange.newSellingPrice || product.sellingPrice;
              if (item.costAtSale === 0) newCostAtSale = relevantPriceChange.newCostPrice || product.costPrice;
            }
          }

          if (newPriceAtSale === 0) newPriceAtSale = product.sellingPrice;
          if (newCostAtSale === 0) newCostAtSale = product.costPrice;
        }

        if (newPriceAtSale === 0 || newCostAtSale === 0) {
          unfixableReasons.push(`${product.name}: No valid price/cost data`);
          canFix = false;
          break;
        }

        updatedItems.push({
          ...item,
          productId: product.id,
          priceAtSale: newPriceAtSale,
          costAtSale: newCostAtSale
        });
      }

      if (canFix && updatedItems.length > 0) {
        const newTotalAmount = updatedItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
        const newTotalCost = updatedItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);
        const updatedSale: Sale = { ...sale, items: updatedItems, totalAmount: newTotalAmount, totalCost: newTotalCost };

        await tx.objectStore('sales').put(updatedSale);
        updatedSales.push(updatedSale);
        fixedCount++;

        for (const item of updatedItems) {
          const existingLogs = productSaleLogs.filter(log => log.saleId === sale.id && log.productId === item.productId);
          if (existingLogs.length > 0) {
            for (const log of existingLogs) {
              const updatedLog: ProductSaleLog = { ...log, priceAtSale: item.priceAtSale, costAtSale: item.costAtSale };
              await tx.objectStore('productSaleLogs').put(updatedLog);
              updatedLogs.push(updatedLog);
            }
          } else {
            const newLog: ProductSaleLog = {
              id: `${sale.id}-${item.productId}`,
              productId: item.productId,
              productName: item.productName,
              saleId: sale.id,
              quantity: item.quantity,
              priceAtSale: item.priceAtSale,
              costAtSale: item.costAtSale,
              timestamp: sale.timestamp,
              cashierId: sale.cashierId,
              cashierName: sale.cashierName
            };
            await tx.objectStore('productSaleLogs').put(newLog);
            newLogs.push(newLog);
            missingLogsCreated++;
          }
        }
      } else {
        unfixableSales.push(`Sale #${sale.id.slice(-8)}: ${unfixableReasons.join(', ')}`);
        skippedCount++;
      }
    }
    await tx.done;

    console.log('📊 Checking for missing logs across all sales...');
    const tx1b = db.transaction(['productSaleLogs'], 'readwrite');
    for (const sale of sales) {
      if (sale.isVoided) continue;
      for (const item of sale.items) {
        const existingLog = productSaleLogs.find(log => log.saleId === sale.id && log.productId === item.productId);
        if (!existingLog) {
          const newLog: ProductSaleLog = {
            id: `${sale.id}-${item.productId}`,
            productId: item.productId,
            productName: item.productName,
            saleId: sale.id,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            costAtSale: item.costAtSale,
            timestamp: sale.timestamp,
            cashierId: sale.cashierId,
            cashierName: sale.cashierName
          };
          await tx1b.objectStore('productSaleLogs').put(newLog);
          newLogs.push(newLog);
          missingLogsCreated++;
        }
      }
    }
    await tx1b.done;
    console.log(`📝 Created ${missingLogsCreated} missing logs`);

    console.log('📊 Recalculating unitsSold...');
    const productSalesMap = new Map<string, number>();
    for (const sale of sales) {
      if (sale.isVoided) continue;
      for (const item of sale.items) {
        const currentCount = productSalesMap.get(item.productId) || 0;
        productSalesMap.set(item.productId, currentCount + item.quantity);
      }
    }

    const tx2 = db.transaction(['products'], 'readwrite');
    let unitsFixedCount = 0;
    for (const product of products) {
      const calculatedUnitsSold = productSalesMap.get(product.id) || 0;
      if (calculatedUnitsSold !== (product.unitsSold || 0)) {
        const updatedProduct = { ...product, unitsSold: calculatedUnitsSold, updatedAt: new Date().toISOString() };
        await tx2.objectStore('products').put(updatedProduct);
        updatedProducts.push(updatedProduct);
        unitsFixedCount++;
      }
    }
    await tx2.done;

    console.log('🔧 Fixing unrealistic values...');
    const tx3 = db.transaction(['products'], 'readwrite');
    let valueFixedCount = 0;
    for (const product of products) {
      const cost = Number(product.costPrice) || 0;
      const stock = Number(product.stock) || 0;
      let needsFix = false;
      let updatedProduct = { ...product };

      if (cost > 1000000 || cost < 0) { updatedProduct.costPrice = 0; needsFix = true; }
      if (stock > 100000 || stock < 0) { updatedProduct.stock = 0; needsFix = true; }

      if (needsFix) {
        updatedProduct.updatedAt = new Date().toISOString();
        await tx3.objectStore('products').put(updatedProduct);
        updatedProducts.push(updatedProduct);
        valueFixedCount++;
      }
    }
    await tx3.done;

    if (updatedSales.length > 0) setSales(prev => prev.map(sale => updatedSales.find(s => s.id === sale.id) || sale));
    if (updatedLogs.length > 0 || newLogs.length > 0) {
      setProductSaleLogs(prev => {
        const updated = prev.map(log => updatedLogs.find(l => l.id === log.id) || log);
        return [...newLogs, ...updated];
      });
    }
    if (updatedProducts.length > 0) setProducts(prev => prev.map(product => updatedProducts.find(p => p.id === product.id) || product));

    await addLog('DATA_FIX', `Fixed ${fixedCount} sales, created ${missingLogsCreated} logs, recalculated ${unitsFixedCount} products, fixed ${valueFixedCount} unrealistic values (${skippedCount} unfixable)`);

    if (unfixableSales.length > 0) {
      console.warn('🚫 UNFIXABLE SALES:', unfixableSales);
    }

    console.log(`✅ Fix complete: ${fixedCount} sales, ${missingLogsCreated} logs, ${unitsFixedCount} unitsSold, ${valueFixedCount} values`);
    return { fixed: fixedCount + missingLogsCreated + unitsFixedCount + valueFixedCount, total: corruptedSales.length + unitsFixedCount + valueFixedCount };
  };

  const reconcileStock = async (): Promise<{ reconciled: number; errors: string[] }> => {
    console.log('📊 Starting stock reconciliation...');
    const errors: string[] = [];
    let reconciledCount = 0;

    try {
      const db = await dbPromise();
      const tx = db.transaction(['products'], 'readwrite');
      const updatedProducts: Product[] = [];

      for (const product of products) {
        if (product.stock < 0) {
          console.warn(`  ⚠️ ${product.name}: Negative stock (${product.stock}), setting to 0`);
          const updatedProduct = {
            ...product,
            stock: 0,
            updatedAt: new Date().toISOString()
          };
          await tx.objectStore('products').put(updatedProduct);
          updatedProducts.push(updatedProduct);
          errors.push(`${product.name} had negative stock: ${product.stock}`);
          reconciledCount++;
        }
      }

      await tx.done;

      if (updatedProducts.length > 0) {
        setProducts(prev => prev.map(p => {
          const updated = updatedProducts.find(up => up.id === p.id);
          return updated || p;
        }));

        await addLog('STOCK_RECONCILE', `Reconciled stock for ${reconciledCount} products`);
      }

      console.log(`✅ Stock reconciliation complete: ${reconciledCount} products updated`);
      return { reconciled: reconciledCount, errors };

    } catch (error) {
      console.error('❌ Stock reconciliation failed:', error);
      errors.push(`Reconciliation failed: ${error}`);
      return { reconciled: reconciledCount, errors };
    }
  };

  const refreshProductSaleLogs = async () => {
    try {
      const db = await dbPromise();
      const allLogs = await db.getAll('productSaleLogs');
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setProductSaleLogs(allLogs);
      console.log(`✅ Refreshed ${allLogs.length} product sale logs from IndexedDB`);
    } catch (error) {
      console.error('❌ Failed to refresh product sale logs:', error);
    }
  };

  /**
   * ✅ NEW FUNCTION: CLEANUP DUPLICATE LOGS
   * Finds and removes duplicate product sale logs based on saleId-productId
   * Keeps the most recent log when duplicates exist
   */
  const cleanupDuplicateLogs = async (): Promise<{ removed: number; errors: string[] }> => {
    console.log('🧹 Starting duplicate log cleanup...');
    const db = await dbPromise();
    const errors: string[] = [];
    let removedCount = 0;

    try {
      const allLogs = await db.getAll('productSaleLogs');

      // Group logs by saleId-productId
      const logMap = new Map<string, ProductSaleLog[]>();

      for (const log of allLogs) {
        const key = `${log.saleId}-${log.productId}`;
        if (!logMap.has(key)) {
          logMap.set(key, []);
        }
        logMap.get(key)!.push(log);
      }

      // Find and remove duplicates
      const tx = db.transaction(['productSaleLogs'], 'readwrite');

      for (const [key, logs] of logMap.entries()) {
        if (logs.length > 1) {
          // Sort by timestamp (keep newest)
          logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          // Keep first (newest), delete rest
          for (let i = 1; i < logs.length; i++) {
            await tx.objectStore('productSaleLogs').delete(logs[i].id);
            removedCount++;
            console.log(`  🗑️ Removed duplicate log: ${logs[i].id}`);
          }
        }
      }

      await tx.done;

      // Refresh state
      await refreshProductSaleLogs();

      await addLog('CLEANUP_DUPLICATES', `Removed ${removedCount} duplicate product sale logs`);

      console.log(`✅ Cleanup complete: ${removedCount} duplicates removed`);
      return { removed: removedCount, errors };

    } catch (error) {
      console.error('❌ Duplicate cleanup failed:', error);
      errors.push(`Cleanup failed: ${error}`);
      return { removed: removedCount, errors };
    }
  };

  // Cloud-as-source-of-truth reconcile for product_sale_logs. Groups local rows
  // by (saleId,productId). If the cloud has the pair, keep the row whose id
  // matches the cloud row and discard the others LOCALLY only — no cloud delete
  // is ever enqueued (prevents the dedup panel from wiping the canonical cloud
  // row when legacy random-id siblings still live in IndexedDB). If the cloud
  // does not have the pair, the row with canonical id `${saleId}-${productId}`
  // wins (falls back to newest timestamp); winner gets enqueued for push, losers
  // are dropped locally.
  const reconcileProductSaleLogs = async (): Promise<{ removedLocal: number; pushed: number; keptFromCloud: number; errors: string[] }> => {
    const errors: string[] = [];
    let removedLocal = 0;
    let pushed = 0;
    let keptFromCloud = 0;

    try {
      const db = await dbPromise();
      const localLogs = await db.getAll('productSaleLogs') as ProductSaleLog[];

      // Build an earliest-timestamp floor so we only pull cloud rows that could
      // correspond to anything we have locally. fetchAll is paginated past 1000.
      const minTs = localLogs.reduce<string | null>((acc, l) => {
        if (!l.timestamp) return acc;
        return !acc || l.timestamp < acc ? l.timestamp : acc;
      }, null);

      const cloudLogs = await fetchAll<ProductSaleLog>(
        'product_sale_logs',
        { column: 'timestamp', ascending: false },
        q => (minTs ? q.gte('timestamp', minTs) : q)
      );

      const cloudByPair = new Map<string, ProductSaleLog>();
      for (const c of cloudLogs) {
        cloudByPair.set(`${c.saleId}-${c.productId}`, c);
      }

      const localByPair = new Map<string, ProductSaleLog[]>();
      for (const l of localLogs) {
        const key = `${l.saleId}-${l.productId}`;
        const arr = localByPair.get(key);
        if (arr) arr.push(l); else localByPair.set(key, [l]);
      }

      const tx = db.transaction(['productSaleLogs', 'syncQueue'], 'readwrite');
      const logStore = tx.objectStore('productSaleLogs');
      const syncStore = tx.objectStore('syncQueue');

      for (const [pair, group] of localByPair.entries()) {
        const cloudWinner = cloudByPair.get(pair);
        if (cloudWinner) {
          // Make sure the cloud winner exists locally, then drop siblings.
          await logStore.put(cloudWinner);
          keptFromCloud++;
          for (const l of group) {
            if (l.id !== cloudWinner.id) {
              await logStore.delete(l.id);
              removedLocal++;
            }
          }
        } else {
          // Cloud-absent: pick canonical-id row if present, else newest.
          const canonicalId = pair;
          let winner = group.find(l => l.id === canonicalId);
          if (!winner) {
            winner = [...group].sort((a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0];
          }
          for (const l of group) {
            if (l.id !== winner.id) {
              await logStore.delete(l.id);
              removedLocal++;
            }
          }
          await syncStore.add({
            type: 'PRODUCT_SALE_LOG',
            payload: winner,
            timestamp: Date.now(),
          });
          pushed++;
        }
      }

      await tx.done;

      await refreshProductSaleLogs();
      triggerSync();

      await addLog(
        'RECONCILE_PRODUCT_SALE_LOGS',
        `Reconciled local product sale logs with cloud: kept ${keptFromCloud} from cloud, removed ${removedLocal} local-only siblings, queued ${pushed} local-only rows for push`
      );

      return { removedLocal, pushed, keptFromCloud, errors };
    } catch (error) {
      console.error('❌ reconcileProductSaleLogs failed:', error);
      errors.push(String(error));
      return { removedLocal, pushed, keptFromCloud, errors };
    }
  };

  // Per-table local-vs-cloud id-set diff. Read-only: never writes anything.
  const verifySyncIntegrity = async (): Promise<Array<{ table: string; local: number; cloud: number; missingLocal: number; missingCloud: number }>> => {
    const db = await dbPromise();
    const sources: Array<{ cloudTable: string; localStore: Parameters<typeof db.getAll>[0] }> = [
      { cloudTable: 'products', localStore: 'products' },
      { cloudTable: 'users', localStore: 'users' },
      { cloudTable: 'sales', localStore: 'sales' },
      { cloudTable: 'shifts', localStore: 'shifts' },
      { cloudTable: 'audit_logs', localStore: 'auditLogs' },
      { cloudTable: 'void_requests', localStore: 'voidRequests' },
      { cloudTable: 'stock_change_requests', localStore: 'stockChangeRequests' },
      { cloudTable: 'product_sale_logs', localStore: 'productSaleLogs' },
    ];

    const out: Array<{ table: string; local: number; cloud: number; missingLocal: number; missingCloud: number }> = [];
    for (const { cloudTable, localStore } of sources) {
      try {
        const [localRows, cloudRows] = await Promise.all([
          db.getAll(localStore) as Promise<Array<{ id: string }>>,
          fetchAll<{ id: string }>(cloudTable),
        ]);
        const localIds = new Set(localRows.map(r => r.id));
        const cloudIds = new Set(cloudRows.map(r => r.id));
        let missingLocal = 0;
        for (const id of cloudIds) if (!localIds.has(id)) missingLocal++;
        let missingCloud = 0;
        for (const id of localIds) if (!cloudIds.has(id)) missingCloud++;
        out.push({
          table: cloudTable,
          local: localRows.length,
          cloud: cloudRows.length,
          missingLocal,
          missingCloud,
        });
      } catch (error) {
        console.error(`integrity check failed for ${cloudTable}:`, error);
        out.push({ table: cloudTable, local: -1, cloud: -1, missingLocal: -1, missingCloud: -1 });
      }
    }
    return out;
  };

  /**
   * FETCH HISTORY
   * Manually pulls older data from Supabase for a specific date range.
   * Useful for auditing older records not kept in local sync (standard 7 days).
   */
  const fetchHistory = async (
    table: 'sales' | 'shifts' | 'audit_logs' | 'product_sale_logs' | 'void_requests' | 'stock_change_requests',
    startDate: string,
    endDate: string
  ) => {
    try {
      setIsSyncing(true);
      const db = await dbPromise();
      
      // Map local table names to Supabase table names if different
      const tableMap: Record<string, string> = {
        'audit_logs': 'audit_logs', // Ensure match with fetching logic
        'stock_change_requests': 'stock_change_requests',
        'void_requests': 'void_requests',
        'product_sale_logs': 'product_sale_logs'
      };
      
      const sbTable = tableMap[table] || table;
      
      // Determine time column name
      let timeCol = 'timestamp';
      if (['shifts'].includes(table)) timeCol = 'startTime';
      if (['void_requests', 'stock_change_requests'].includes(table)) timeCol = 'requestedAt';

      console.log(`🔍 Fetching history for ${table} from ${startDate} to ${endDate}...`);

      // Paginate so we never silently truncate at the 1,000-row PostgREST cap.
      const data = await fetchAll<any>(
        sbTable,
        { column: timeCol, ascending: false },
        q => q.gte(timeCol, startDate).lte(timeCol, endDate + 'T23:59:59.999Z')
      );

      if (data && data.length > 0) {
        // Map data back to state
        if (table === 'sales') {
          const cloudIds = new Set(data.map(s => s.id));
          const merged = [...data, ...sales.filter(s => !cloudIds.has(s.id))];
          setSales(merged);
          for (const s of data) await db.put('sales', s);
        } else if (table === 'shifts') {
          const cloudIds = new Set(data.map(s => s.id));
          const merged = [...data, ...shifts.filter(s => !cloudIds.has(s.id))];
          setShifts(merged);
          for (const s of data) await db.put('shifts', s);
        } else if (table === 'audit_logs') {
          const cloudIds = new Set(data.map(l => l.id));
          const merged = [...data, ...auditLogs.filter(l => !cloudIds.has(l.id))];
          setAuditLogs(merged);
          for (const l of data) await db.put('auditLogs', l);
        } else if (table === 'void_requests') {
           const cloudIds = new Set(data.map(v => v.id));
           const merged = [...data, ...voidRequests.filter(v => !cloudIds.has(v.id))];
           setVoidRequests(merged);
           for (const v of data) await db.put('voidRequests', v);
        } else if (table === 'stock_change_requests') {
           const cloudIds = new Set(data.map(s => s.id));
           const merged = [...data, ...stockChangeRequests.filter(s => !cloudIds.has(s.id))];
           setStockChangeRequests(merged);
           for (const s of data) await db.put('stockChangeRequests', s);
        } else if (table === 'product_sale_logs') {
           const cloudIds = new Set(data.map(l => l.id));
           const merged = [...data, ...productSaleLogs.filter(l => !cloudIds.has(l.id))];
           setProductSaleLogs(merged);
           for (const l of data) await db.put('productSaleLogs', l);
        }
        
        console.log(`✅ Fetched and merged ${data.length} records.`);
      } else {
        console.log('ℹ️ No records found for this range.');
      }
    } catch (error) {
      console.error('❌ History fetch failed:', error);
      alert('Failed to fetch historical data. Please check your connection.');
    } finally {
      setIsSyncing(false);
    }
  };


  const contextValue = useMemo(() => ({
    currentUser,
    users,
    products,
    sales,
    shifts,
    auditLogs,
    currentShift,
    isLoading,
    isOnline,
    isSyncing,
    dataLoadedTimestamp,
    login,
    logout,
    updateUser,
    addUser,
    deleteUser,
    processSale,
    updateSale,
    deleteSale,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    receiveStock,
    openShift,
    closeShift,
    createBackfillShift,
    voidRequests,
    requestVoid,
    approveVoid,
    rejectVoid,
    stockChangeRequests,
    requestStockChange,
    approveStockChange,
    rejectStockChange,
    productSaleLogs,
    setProductSaleLogs,
    businessSettings,
    updateBusinessSettings,
    prepareDataFix,
    applyDataFix,
    fixCorruptedSales,
    reconcileStock,
    refreshProductSaleLogs,
    cleanupDuplicateLogs,
    reconcileProductSaleLogs,
    verifySyncIntegrity,
    fetchHistory,
  }), [
    currentUser,
    users,
    products,
    sales,
    shifts,
    auditLogs,
    currentShift,
    isLoading,
    isOnline,
    isSyncing,
    dataLoadedTimestamp,
    // Functions are stable or memoized (implied by design patterns, though explicit useCallback would be better if they weren't assumed stable from useStore/setup)
    // Dependencies that might change referentially should be included.
    // Ideally action handlers should be wrapped in useCallback in their definitions to be truly stable,
    // but wrapping the value object is a huge first step.
    businessSettings,
  ]);

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};