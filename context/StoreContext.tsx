import React, { createContext, useContext, useEffect, useState, useMemo, PropsWithChildren } from 'react';
import {
  User, Product, Sale, Shift, AuditLog, Role, SaleItem, BusinessSettings, VoidRequest, StockChangeRequest, ProductSaleLog
} from '../types';
import { SaleReconciliation, ProductReconciliation } from '../components/ReconciliationDialog';
import { INITIAL_USERS, INITIAL_PRODUCTS, CURRENCY_FORMATTER } from '../constants';
import { dbPromise, addToSyncQueue } from '../db';
import { pushToCloud, supabase } from '../cloud';

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
  closeShift: (closingCash: number, comments?: string) => Promise<void>;

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
  fetchHistory: (table: 'sales' | 'shifts' | 'audit_logs' | 'product_sale_logs' | 'void_requests' | 'stock_change_requests', startDate: string, endDate: string) => Promise<void>;
}

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
  const [isSyncLocked, setIsSyncLocked] = useState(false);
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
      try {
        const db = await dbPromise();

        // Restore user session
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

        let loadedUsers: User[] = [];
        let loadedProducts: Product[] = [];
        let loadedSales: Sale[] = [];
        let loadedShifts: Shift[] = [];
        let loadedLogs: AuditLog[] = [];
        let loadedVoidRequests: VoidRequest[] = [];
        let loadedStockChangeRequests: StockChangeRequest[] = [];
        let loadedProductSaleLogs: ProductSaleLog[] = [];
        let cloudLoadSuccess = false;

        // STEP 1: Try to load from Supabase
        if (navigator.onLine) {
          try {
            console.log('🌐 Loading data from Supabase...');
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            // --- LOCAL PRUNING ---
            if (!isPhone) {
              const syncCount = await db.count('syncQueue');
              const failedCount = await db.count('failedSyncQueue');
              if (syncCount === 0 && failedCount === 0) {
                const pruneStores = ['sales', 'auditLogs', 'productSaleLogs'] as const;
                for (const storeName of pruneStores) {
                  const tx = db.transaction(storeName, 'readwrite');
                  const index = tx.store.index('timestamp');
                  let cursor = await index.openCursor(IDBKeyRange.upperBound(sevenDaysAgo));
                  while (cursor) {
                    await cursor.delete();
                    cursor = await cursor.continue();
                  }
                  await tx.done;
                }
                console.log('🧹 Local Data Pruning Complete: Cleaned records older than 7 days.');
              } else {
                console.log(`⚠️ Pruning skipped: ${syncCount} pending syncs, ${failedCount} failed syncs.`);
              }
            }

            const smartMerge = async <T extends { id: string; updatedAt?: string; version?: number }>(
              storeName: string,
              cloudData: T[],
              localData: T[]
            ): Promise<T[]> => {
              const merged = new Map<string, T>();

              cloudData.forEach(item => merged.set(item.id, item));

              for (const localItem of localData) {
                const cloudItem = merged.get(localItem.id);

                if (!cloudItem) {
                  merged.set(localItem.id, localItem);
                  await addToSyncQueue(`UPDATE_${storeName.toUpperCase()}`, localItem);
                  console.log(`📤 Local-only ${storeName}:`, localItem.id);
                } else {
                  const localVersion = localItem.version ?? 0;
                  const cloudVersion = cloudItem.version ?? 0;

                  if (localVersion > cloudVersion) {
                    merged.set(localItem.id, localItem);
                    await addToSyncQueue(`UPDATE_${storeName.toUpperCase()}`, localItem);
                    console.log(`🔄 Local ${storeName} is newer (v${localVersion} > v${cloudVersion}):`, localItem.id);
                  } else if (localVersion === cloudVersion && localItem.updatedAt && cloudItem.updatedAt) {
                    try {
                      const localTime = new Date(localItem.updatedAt).getTime();
                      const cloudTime = new Date(cloudItem.updatedAt).getTime();

                      if (!isNaN(localTime) && !isNaN(cloudTime) && localTime > cloudTime) {
                        merged.set(localItem.id, localItem);
                        await addToSyncQueue(`UPDATE_${storeName.toUpperCase()}`, localItem);
                        console.log(`🔄 Local ${storeName} is newer by timestamp:`, localItem.id);
                      }
                    } catch (error) {
                      console.warn(`⚠️ Invalid timestamp for ${storeName}:`, localItem.id);
                    }
                  }
                }
              }

              return Array.from(merged.values());
            };

            const localUsers = await db.getAll('users');
            const localProducts = await db.getAll('products');
            const localSales = await db.getAll('sales');
            const localShifts = await db.getAll('shifts');
            const localAuditLogs = await db.getAll('auditLogs');
            const localVoidRequests = await db.getAll('voidRequests');
            const localStockRequests = await db.getAll('stockChangeRequests');

            const fetchAllPaginated = async (table: string, timeColumn: string, timeLimit: string, orderBy: string) => {
              let allData: any[] = [];
              let page = 0;
              const pageSize = 1000;
              let hasMore = true;

              while (hasMore) {
                let query = supabase.from(table).select('*');
                if (timeLimit) {
                  // Ensure correct typing since Supabase has different column names
                  query = query.gte(timeColumn, timeLimit);
                }
                const { data, error } = await query
                  .range(page * pageSize, (page + 1) * pageSize - 1)
                  .order(orderBy, { ascending: false });

                if (error) {
                  console.error(`❌ Error fetching ${table}:`, error);
                  break;
                }

                if (data && data.length > 0) {
                  allData = [...allData, ...data];
                  if (data.length < pageSize) hasMore = false;
                  page++;
                } else {
                  hasMore = false;
                }
              }
              return allData;
            };

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            console.log('⚡ Fetching all records from Supabase in parallel...');
            const [
              { data: cloudUsers },
              { data: cloudProducts },
              allCloudSales,
              allCloudShifts,
              allCloudAuditLogs,
              allCloudVoidRequests,
              allCloudStockRequests,
              allCloudLogs,
              { data: cloudSettings }
            ] = await Promise.all([
              supabase.from('users').select('*'),
              supabase.from('products').select('*'),
              fetchAllPaginated('sales', 'timestamp', sevenDaysAgo, 'timestamp'),
              // Fetch shifts with a 30-day limit to prevent hard loading
              fetchAllPaginated('shifts', 'startTime', thirtyDaysAgo, 'startTime'),
              fetchAllPaginated('audit_logs', 'timestamp', sevenDaysAgo, 'timestamp'),
              fetchAllPaginated('void_requests', 'requestedAt', thirtyDaysAgo, 'requestedAt'),
              fetchAllPaginated('stock_change_requests', 'requestedAt', thirtyDaysAgo, 'requestedAt'),
              fetchAllPaginated('product_sale_logs', 'timestamp', sevenDaysAgo, 'timestamp'),
              supabase.from('business_settings').select('*').eq('id', 'default').single()
            ]);

            // 1. Users
            if (cloudUsers && cloudUsers.length > 0) {
              loadedUsers = await smartMerge('users', cloudUsers, localUsers);
              for (const u of loadedUsers) await db.put('users', u);
              console.log('✅ Merged', loadedUsers.length, 'users');
            } else if (localUsers.length > 0) {
              loadedUsers = localUsers;
            }

            // 2. Products
            if (cloudProducts && cloudProducts.length > 0) {
              loadedProducts = await smartMerge('products', cloudProducts, localProducts);
              for (const p of loadedProducts) await db.put('products', p);
              console.log('✅ Merged', loadedProducts.length, 'products');
            } else if (localProducts.length > 0) {
              loadedProducts = localProducts;
            }

            // 3. Sales
            if (isPhone && allCloudSales.length > 0) {
              loadedSales = allCloudSales;
            } else if (allCloudSales.length > 0) {
              const cloudSaleIds = new Set(allCloudSales.map((s: any) => s.id));
              const localOnlySales = localSales.filter(s => !cloudSaleIds.has(s.id));
              loadedSales = [...allCloudSales, ...localOnlySales];
              for (const s of loadedSales) await db.put('sales', s);
              if (localOnlySales.length > 0) {
                for (const sale of localOnlySales) await addToSyncQueue('SALE', sale);
              }
            } else {
              loadedSales = localSales;
            }

            // 4. Shifts (Fixing the local-only disappearing bug)
            if (allCloudShifts.length > 0) {
              const cloudShiftIds = new Set(allCloudShifts.map((s: any) => s.id));
              const localOnlyShifts = localShifts.filter(s => !cloudShiftIds.has(s.id));
              loadedShifts = [...allCloudShifts, ...localOnlyShifts];
              for (const s of loadedShifts) await db.put('shifts', s);
              if (localOnlyShifts.length > 0) {
                console.log('📤 Found', localOnlyShifts.length, 'local-only shifts');
                for (const shift of localOnlyShifts) {
                  await addToSyncQueue(shift.status === 'OPEN' ? 'OPEN_SHIFT' : 'CLOSE_SHIFT', shift);
                }
              }
            } else {
              loadedShifts = localShifts;
            }

            // 5. Audit Logs
            if (isPhone && allCloudAuditLogs.length > 0) {
              loadedLogs = allCloudAuditLogs;
            } else if (allCloudAuditLogs.length > 0) {
              const cloudLogIds = new Set(allCloudAuditLogs.map((l: any) => l.id));
              const localOnlyAuditLogs = localAuditLogs.filter(l => !cloudLogIds.has(l.id));
              loadedLogs = [...allCloudAuditLogs, ...localOnlyAuditLogs];
              for (const l of loadedLogs) await db.put('auditLogs', l);
              if (localOnlyAuditLogs.length > 0) {
                for (const log of localOnlyAuditLogs) await addToSyncQueue('LOG', log);
              }
            } else {
              loadedLogs = localAuditLogs;
            }

            // 6. Void Requests
            if (allCloudVoidRequests.length > 0) {
              const cloudVoidIds = new Set(allCloudVoidRequests.map((v: any) => v.id));
              const localOnlyVoidRequests = localVoidRequests.filter(v => !cloudVoidIds.has(v.id));
              loadedVoidRequests = [...allCloudVoidRequests, ...localOnlyVoidRequests];
              for (const v of loadedVoidRequests) await db.put('voidRequests', v);
              if (localOnlyVoidRequests.length > 0) {
                for (const vr of localOnlyVoidRequests) {
                   await addToSyncQueue(
                      vr.status === 'PENDING' ? 'VOID_REQUEST' : (vr.status === 'APPROVED' ? 'VOID_APPROVED' : 'VOID_REJECTED'),
                      (vr.status === 'APPROVED') ? { request: vr, sale: vr.sale } : vr
                   );
                }
              }
            } else {
              loadedVoidRequests = localVoidRequests;
            }

            // 7. Stock Change Requests
            if (allCloudStockRequests.length > 0) {
              const cloudStockIds = new Set(allCloudStockRequests.map((s: any) => s.id));
              const localOnlyStockRequests = localStockRequests.filter(s => !cloudStockIds.has(s.id));
              loadedStockChangeRequests = [...allCloudStockRequests, ...localOnlyStockRequests];
              for (const s of loadedStockChangeRequests) await db.put('stockChangeRequests', s);
              if (localOnlyStockRequests.length > 0) {
                 for (const sr of localOnlyStockRequests) {
                    await addToSyncQueue('STOCK_CHANGE_REQUEST', sr);
                 }
              }
            } else {
              loadedStockChangeRequests = localStockRequests;
            }

            // 8. Product Sale Logs
            if (isPhone && allCloudLogs.length > 0) {
              loadedProductSaleLogs = allCloudLogs;
            } else if (allCloudLogs.length > 0) {
              loadedProductSaleLogs = allCloudLogs;
              for (const l of allCloudLogs) await db.put('productSaleLogs', l);
            }

            // 9. Business Settings
            const localSettings = await db.get('businessSettings', 'default');
            if (cloudSettings && localSettings) {
              const cloudTime = cloudSettings.updatedAt ? new Date(cloudSettings.updatedAt).getTime() : 0;
              const localTime = localSettings.updatedAt ? new Date(localSettings.updatedAt).getTime() : 0;

              if (localTime > cloudTime) {
                await db.put('businessSettings', localSettings);
                setBusinessSettings(localSettings);
                await addToSyncQueue('UPDATE_SETTINGS', localSettings);
                console.log('✅ Using local business settings');
              } else {
                await db.put('businessSettings', cloudSettings);
                setBusinessSettings(cloudSettings);
                console.log('✅ Using cloud business settings');
              }
            } else if (cloudSettings) {
              await db.put('businessSettings', cloudSettings);
              setBusinessSettings(cloudSettings);
            } else if (localSettings) {
              setBusinessSettings(localSettings);
              await addToSyncQueue('UPDATE_SETTINGS', localSettings);
            }

            cloudLoadSuccess = true;
            console.log('✅ All data loaded from Supabase');
          } catch (cloudErr) {
            console.warn("⚠️ Could not fetch from Supabase, falling back to local storage.", cloudErr);
            cloudLoadSuccess = false;
          }
        }

        // STEP 2: Load from local if cloud failed
        if (!cloudLoadSuccess || !navigator.onLine) {
          console.log('💾 Loading data from local IndexedDB...');
          if (loadedUsers.length === 0) loadedUsers = await db.getAll('users');
          if (loadedProducts.length === 0) loadedProducts = await db.getAll('products');
          if (loadedSales.length === 0) loadedSales = await db.getAll('sales');
          if (loadedShifts.length === 0) loadedShifts = await db.getAll('shifts');
          if (loadedLogs.length === 0) loadedLogs = await db.getAll('auditLogs');
          if (loadedVoidRequests.length === 0) loadedVoidRequests = await db.getAll('voidRequests');
          if (loadedStockChangeRequests.length === 0) loadedStockChangeRequests = await db.getAll('stockChangeRequests');
          if (loadedProductSaleLogs.length === 0) loadedProductSaleLogs = await db.getAll('productSaleLogs');
          console.log('✅ Loaded data from local storage');
        }

        // STEP 3: Merge local-only data
        if (cloudLoadSuccess && navigator.onLine) {
          try {
            const localSales = await db.getAll('sales');
            const cloudSaleIds = new Set(loadedSales.map(s => s.id));
            const localOnlySales = localSales.filter(s => !cloudSaleIds.has(s.id));
            if (localOnlySales.length > 0) {
              loadedSales = [...loadedSales, ...localOnlySales];
              console.log('📤 Found', localOnlySales.length, 'local-only sales to sync');
            }

            const localProducts = await db.getAll('products');
            const cloudProductIds = new Set(loadedProducts.map(p => p.id));
            const localOnlyProducts = localProducts.filter(p => !cloudProductIds.has(p.id));
            if (localOnlyProducts.length > 0) {
              loadedProducts = [...loadedProducts, ...localOnlyProducts];
              console.log('📤 Found', localOnlyProducts.length, 'local-only products to sync');
            }

            const localLogs = await db.getAll('productSaleLogs');
            const cloudLogIds = new Set(loadedProductSaleLogs.map(l => l.id));

            const logKeyMap = new Map<string, typeof loadedProductSaleLogs[0]>();
            for (const log of loadedProductSaleLogs) {
              const key = `${log.saleId}-${log.productId}`;
              const existing = logKeyMap.get(key);
              if (!existing || new Date(log.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
                logKeyMap.set(key, log);
              }
            }

            let localOnlyLogsCount = 0;
            let duplicatesSkipped = 0;
            for (const localLog of localLogs) {
              if (cloudLogIds.has(localLog.id)) {
                continue;
              }

              const key = `${localLog.saleId}-${localLog.productId}`;
              const existingLog = logKeyMap.get(key);

              if (existingLog) {
                const localTime = new Date(localLog.timestamp).getTime();
                const existingTime = new Date(existingLog.timestamp).getTime();

                if (localTime > existingTime) {
                  logKeyMap.set(key, localLog);
                  await db.delete('productSaleLogs', existingLog.id);
                  localOnlyLogsCount++;
                } else {
                  await db.delete('productSaleLogs', localLog.id);
                  duplicatesSkipped++;
                }
              } else {
                logKeyMap.set(key, localLog);
                localOnlyLogsCount++;
              }
            }

            loadedProductSaleLogs = Array.from(logKeyMap.values());

            if (localOnlyLogsCount > 0) {
              console.log('📤 Found', localOnlyLogsCount, 'local-only product sale logs to sync');
            }
            if (duplicatesSkipped > 0) {
              console.log('🗑️ Cleaned up', duplicatesSkipped, 'duplicate product sale logs');
            }
          } catch (mergeErr) {
            console.warn('⚠️ Error merging local-only data:', mergeErr);
          }
        }

        // SEEDING
        if (loadedUsers.length === 0) {
          const legacyUsers = localStorage.getItem('bk_users');
          const seedUsers = legacyUsers ? JSON.parse(legacyUsers) : INITIAL_USERS;

          const finalSeedUsers = seedUsers.map((u: any) => {
            if (!u.permissions) {
              if (u.role === Role.ADMIN) return { ...u, permissions: ['POS', 'INVENTORY', 'REPORTS', 'ADMIN'] };
              if (u.role === Role.MANAGER) return { ...u, permissions: ['POS', 'INVENTORY', 'REPORTS'] };
              return { ...u, permissions: ['POS'] };
            }
            return u;
          });

          for (const u of finalSeedUsers) await db.put('users', u);
          loadedUsers = finalSeedUsers;
          console.log('✅ Seeded users to IndexedDB:', loadedUsers.length);
        } else {
          console.log('✅ Loaded users from IndexedDB:', loadedUsers.length);
        }

        if (loadedProducts.length === 0) {
          const legacyProducts = localStorage.getItem('bk_products');
          const seedProducts = legacyProducts ? JSON.parse(legacyProducts) : INITIAL_PRODUCTS;
          for (const p of seedProducts) await db.put('products', p);
          loadedProducts = seedProducts;
        }

        // Sort Data
        loadedSales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        loadedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        loadedVoidRequests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        loadedStockChangeRequests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        loadedProductSaleLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Load Business Settings
        const loadedSettings = await db.get('businessSettings', 'default');
        if (loadedSettings) {
          setBusinessSettings(loadedSettings);
        } else {
          const defaultSettings: BusinessSettings = {
            id: 'default',
            businessName: 'Grab Bottle',
            phone: '+254 700 000000',
            email: '',
            location: 'Nairobi, Kenya',
            logoUrl: '',
            receiptFooter: 'Thank you for your business!',
            evolutionApiUrl: '',
            evolutionApiKey: '',
            evolutionInstance: ''
          };
          await db.put('businessSettings', defaultSettings);
          setBusinessSettings(defaultSettings);
        }

        // Update React State
        setUsers(loadedUsers);
        setProducts(loadedProducts);
        setSales(loadedSales);
        setShifts(loadedShifts);
        setAuditLogs(loadedLogs);
        setVoidRequests(loadedVoidRequests);
        setStockChangeRequests(loadedStockChangeRequests);
        setProductSaleLogs(loadedProductSaleLogs);

        setDataLoadedTimestamp(Date.now());
        console.log(`✅ Data fully loaded: ${loadedProductSaleLogs.length} product sale logs ready`);

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
          } catch (e) {
            // Already handled
          }
        }
      } catch (err) {
        console.error("Failed to load database:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
  // BACKGROUND SYNC PROCESSOR
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isOnline) return;

    const processSyncQueue = async () => {
      if (isSyncing) return;

      try {
        const db = await dbPromise();
        const queueItems = await db.getAll('syncQueue');

        if (queueItems.length === 0) return;

        setIsSyncing(true);
        console.log(`🔄 Processing ${queueItems.length} items in sync queue...`);

        const results = await Promise.all(
          queueItems.map(async (item) => {
            try {
              const success = await pushToCloud(item.type, item.payload);
              if (success) {
                await db.delete('syncQueue', item.key!);
                return { success: true, key: item.key };
              } else {
                const retryCount = (item.retryCount || 0) + 1;
                if (retryCount >= 5) {
                  await db.add('failedSyncQueue', {
                    ...item,
                    failedAt: Date.now(),
                    totalRetries: retryCount,
                    canRetry: true
                  });
                  await db.delete('syncQueue', item.key!);
                  console.error(`❌ Item ${item.key} moved to failed queue after ${retryCount} retries`);
                } else {
                  await db.put('syncQueue', { ...item, retryCount });
                }
                return { success: false, key: item.key };
              }
            } catch (error) {
              console.error(`Error syncing item ${item.key}:`, error);
              return { success: false, key: item.key };
            }
          })
        );

        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          console.log(`✅ Successfully synced ${successCount}/${queueItems.length} items to cloud`);
        }
      } catch (error) {
        console.error('Sync queue processing error:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    processSyncQueue();
    const syncInterval = setInterval(processSyncQueue, 5000);

    return () => {
      clearInterval(syncInterval);
    };
  }, [isOnline, isSyncing]);

  const currentShift = shifts.find(s => s.status === 'OPEN' && s.cashierId === currentUser?.id) || null;

  // ------------------------------------------------------------------
  // 3. ACTION HANDLERS
  // ------------------------------------------------------------------

  const addLog = async (action: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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

  const closeShift = async (closingCash: number, comments?: string) => {
    if (!currentShift) return;

    const shiftSales = sales.filter(s =>
      new Date(s.timestamp) > new Date(currentShift.startTime) &&
      s.cashierId === currentShift.cashierId &&
      s.paymentMethod === 'CASH' &&
      !s.isVoided
    );
    const totalCashSales = shiftSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const expected = currentShift.openingCash + totalCashSales;

    const updatedShift: Shift = {
      ...currentShift,
      endTime: new Date().toISOString(),
      closingCash,
      expectedCash: expected,
      status: 'CLOSED',
      comments,
    };

    setShifts(prev => prev.map(s => s.id === currentShift.id ? updatedShift : s));

    const db = await dbPromise();
    await db.put('shifts', updatedShift);
    await addLog('SHIFT_CLOSE', `Shift closed. Counted: ${CURRENCY_FORMATTER.format(closingCash)}, Expected: ${CURRENCY_FORMATTER.format(expected)}${comments ? `. Comments: ${comments}` : ''}`);
    await addToSyncQueue('CLOSE_SHIFT', updatedShift);
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

    if (isSyncLocked) {
      throw new Error('Another sale is being processed. Please wait.');
    }
    setIsSyncLocked(true);

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
      const saleId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

      for (const item of items) {
        const dbProduct = await tx.objectStore('products').get(item.productId);
        if (!dbProduct) continue;

        // Update product stock
        const updatedProduct = {
          ...dbProduct,
          stock: dbProduct.stock - item.quantity,
          updatedAt: new Date().toISOString()
        };

        updatedProducts.push(updatedProduct);
        await tx.objectStore('products').put(updatedProduct);

        // Only send the exact subtraction to the cloud to prevent overwriting
        await tx.objectStore('syncQueue').add({
          type: 'SALE_STOCK_DELTA',
          payload: { 
            productId: item.productId, 
            quantity: item.quantity 
          },
          timestamp: Date.now()
        });

        // ✅ FIX 2: Deterministic Log ID (saleId-productId)
        const logId = `${newSale.id}-${item.productId}`;

        // ✅ FIX 3: Check if log already exists
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

      // 4. Save Sale
      await tx.objectStore('sales').put(newSale);
      await tx.objectStore('syncQueue').add({
        type: 'SALE',
        payload: newSale,
        timestamp: Date.now()
      });

      await tx.done;

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
      setIsSyncLocked(false);
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
      id: Date.now().toString(),
      updatedAt: new Date().toISOString(),
    };
    setProducts(prev => [...prev, newProduct]);

    const db = await dbPromise();
    await db.put('products', newProduct);
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
        id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      
      const { data, error } = await supabase
        .from(sbTable)
        .select('*')
        .gte(timeCol, startDate)
        .lte(timeCol, endDate + 'T23:59:59.999Z');

      if (error) throw error;

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