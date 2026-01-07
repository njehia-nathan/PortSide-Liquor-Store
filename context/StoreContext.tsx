import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import {
  User, Product, Sale, Shift, AuditLog, Role, SaleItem, BusinessSettings, VoidRequest, StockChangeRequest, ProductSaleLog
} from '../types';
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
  currentShift: Shift | null;
  businessSettings: BusinessSettings | null;

  // --- APP STATE ---
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;

  // --- AUTH ACTIONS ---
  login: (pin: string) => boolean;
  logout: () => void;
  updateUser: (user: User) => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  // --- POS ACTIONS ---
  processSale: (items: SaleItem[], paymentMethod: 'CASH' | 'CARD' | 'MOBILE') => Promise<Sale | undefined>;
  updateSale: (sale: Sale) => Promise<void>;

  // --- INVENTORY ACTIONS ---
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  adjustStock: (productId: string, change: number, reason: string) => Promise<void>;
  receiveStock: (productId: string, quantity: number, newCost?: number) => Promise<void>;
  requestStockChange: (productId: string, changeType: 'ADJUST' | 'RECEIVE', quantityChange: number, reason?: string, newCost?: number) => Promise<void>;
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
  fixCorruptedSales: () => Promise<{ fixed: number; total: number }>;
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
  // These hold the data currently displayed on the screen
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncLocked, setIsSyncLocked] = useState(false); // Prevents concurrent sync operations

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
  // Loads data from IndexedDB when the app starts.
  // ------------------------------------------------------------------
  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await dbPromise();

        // Restore user session from localStorage
        const savedSession = localStorage.getItem('pos_session');
        if (savedSession) {
          try {
            const { userId, lastActivity: savedLastActivity } = JSON.parse(savedSession);
            const timeSinceActivity = Date.now() - savedLastActivity;
            const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds

            // Only restore if less than 5 minutes of inactivity
            if (timeSinceActivity < FIVE_MINUTES) {
              // Will be set after users are loaded
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

        // PRIORITY: Load from Supabase FIRST (Cloud as Source of Truth)
        // Then fall back to local storage if offline or cloud fails
        let loadedUsers: User[] = [];
        let loadedProducts: Product[] = [];
        let loadedSales: Sale[] = [];
        let loadedShifts: Shift[] = [];
        let loadedLogs: AuditLog[] = [];
        let loadedVoidRequests: VoidRequest[] = [];
        let loadedStockChangeRequests: StockChangeRequest[] = [];
        let loadedProductSaleLogs: ProductSaleLog[] = [];
        let cloudLoadSuccess = false;

        // STEP 1: Try to load from Supabase FIRST with smart merge
        if (navigator.onLine) {
          try {
            console.log('🌐 Loading data from Supabase (cloud first)...');

            // Helper function for smart merge with conflict resolution (last-write-wins)
            const smartMerge = async <T extends { id: string; updatedAt?: string }>(
              storeName: string,
              cloudData: T[],
              localData: T[]
            ): Promise<T[]> => {
              const merged = new Map<string, T>();

              // Add all cloud items first
              cloudData.forEach(item => merged.set(item.id, item));

              // Merge local items with conflict resolution
              for (const localItem of localData) {
                const cloudItem = merged.get(localItem.id);

                if (!cloudItem) {
                  // Local-only item, keep it and queue for sync
                  merged.set(localItem.id, localItem);
                  await addToSyncQueue(`UPDATE_${storeName.toUpperCase()}`, localItem);
                  console.log(`📤 Local-only ${storeName}:`, localItem.id);
                } else if (localItem.updatedAt && cloudItem.updatedAt) {
                  // Both have timestamps, use last-write-wins
                  const localTime = new Date(localItem.updatedAt).getTime();
                  const cloudTime = new Date(cloudItem.updatedAt).getTime();

                  if (localTime > cloudTime) {
                    // Local is newer, use it and queue for sync
                    merged.set(localItem.id, localItem);
                    await addToSyncQueue(`UPDATE_${storeName.toUpperCase()}`, localItem);
                    console.log(`🔄 Local ${storeName} is newer:`, localItem.id);
                  }
                  // else: cloud is newer or equal, already in merged
                }
                // else: no timestamps, cloud wins (already in merged)
              }

              return Array.from(merged.values());
            };

            // Load local data first for comparison
            const localUsers = await db.getAll('users');
            const localProducts = await db.getAll('products');

            // 1. Users from cloud with smart merge
            const { data: cloudUsers } = await supabase.from('users').select('*');
            if (cloudUsers && cloudUsers.length > 0) {
              loadedUsers = await smartMerge('users', cloudUsers, localUsers);
              for (const u of loadedUsers) await db.put('users', u);
              console.log('✅ Merged', loadedUsers.length, 'users (cloud + local)');
            } else if (localUsers.length > 0) {
              loadedUsers = localUsers;
              console.log('✅ Using local users (cloud empty)');
            }

            // 2. Products from cloud with smart merge
            const { data: cloudProducts } = await supabase.from('products').select('*');
            if (cloudProducts && cloudProducts.length > 0) {
              loadedProducts = await smartMerge('products', cloudProducts, localProducts);
              for (const p of loadedProducts) await db.put('products', p);
              console.log('✅ Merged', loadedProducts.length, 'products (cloud + local)');
            } else if (localProducts.length > 0) {
              loadedProducts = localProducts;
              console.log('✅ Using local products (cloud empty)');
            }

            // 3. Sales from cloud (immutable, so just merge by ID)
            const { data: cloudSales } = await supabase.from('sales').select('*');
            if (cloudSales && cloudSales.length > 0) {
              const localSales = await db.getAll('sales');
              const cloudSaleIds = new Set(cloudSales.map(s => s.id));
              const localOnlySales = localSales.filter(s => !cloudSaleIds.has(s.id));
              loadedSales = [...cloudSales, ...localOnlySales];
              for (const s of loadedSales) await db.put('sales', s);
              if (localOnlySales.length > 0) {
                console.log('📤 Found', localOnlySales.length, 'local-only sales');
                for (const sale of localOnlySales) {
                  await addToSyncQueue('SALE', sale);
                }
              }
              console.log('✅ Loaded', loadedSales.length, 'sales from cloud');
            }

            // 4. Shifts from cloud
            const { data: cloudShifts } = await supabase.from('shifts').select('*');
            if (cloudShifts && cloudShifts.length > 0) {
              loadedShifts = cloudShifts;
              for (const s of cloudShifts) await db.put('shifts', s);
              console.log('✅ Loaded', cloudShifts.length, 'shifts from cloud');
            }

            // 5. Audit Logs from cloud
            const { data: cloudLogs } = await supabase.from('audit_logs').select('*');
            if (cloudLogs && cloudLogs.length > 0) {
              loadedLogs = cloudLogs;
              for (const l of cloudLogs) await db.put('auditLogs', l);
              console.log('✅ Loaded', cloudLogs.length, 'audit logs from cloud');
            }

            // 6. Void Requests from cloud
            const { data: cloudVoidRequests } = await supabase.from('void_requests').select('*');
            if (cloudVoidRequests && cloudVoidRequests.length > 0) {
              loadedVoidRequests = cloudVoidRequests;
              for (const v of cloudVoidRequests) await db.put('voidRequests', v);
              console.log('✅ Loaded', cloudVoidRequests.length, 'void requests from cloud');
            }

            // 7. Stock Change Requests from cloud
            const { data: cloudStockRequests } = await supabase.from('stock_change_requests').select('*');
            if (cloudStockRequests && cloudStockRequests.length > 0) {
              loadedStockChangeRequests = cloudStockRequests;
              for (const s of cloudStockRequests) await db.put('stockChangeRequests', s);
              console.log('✅ Loaded', cloudStockRequests.length, 'stock change requests from cloud');
            }

            // 8. Product Sale Logs from cloud
            const { data: cloudProductSaleLogs } = await supabase.from('product_sale_logs').select('*');
            if (cloudProductSaleLogs && cloudProductSaleLogs.length > 0) {
              loadedProductSaleLogs = cloudProductSaleLogs;
              for (const l of cloudProductSaleLogs) await db.put('productSaleLogs', l);
              console.log('✅ Loaded', cloudProductSaleLogs.length, 'product sale logs from cloud');
            }

            // 9. Business Settings from cloud with smart merge
            const { data: cloudSettings } = await supabase.from('business_settings').select('*').eq('id', 'default').single();
            const localSettings = await db.get('businessSettings', 'default');

            if (cloudSettings && localSettings) {
              // Both exist, use last-write-wins
              const cloudTime = cloudSettings.updatedAt ? new Date(cloudSettings.updatedAt).getTime() : 0;
              const localTime = localSettings.updatedAt ? new Date(localSettings.updatedAt).getTime() : 0;

              if (localTime > cloudTime) {
                await db.put('businessSettings', localSettings);
                setBusinessSettings(localSettings);
                await addToSyncQueue('UPDATE_SETTINGS', localSettings);
                console.log('✅ Using local business settings (newer)');
              } else {
                await db.put('businessSettings', cloudSettings);
                setBusinessSettings(cloudSettings);
                console.log('✅ Using cloud business settings (newer)');
              }
            } else if (cloudSettings) {
              await db.put('businessSettings', cloudSettings);
              setBusinessSettings(cloudSettings);
              console.log('✅ Business settings loaded from cloud');
            } else if (localSettings) {
              setBusinessSettings(localSettings);
              await addToSyncQueue('UPDATE_SETTINGS', localSettings);
              console.log('✅ Using local business settings');
            }

            cloudLoadSuccess = true;
            console.log('✅ All data loaded from Supabase with smart merge');
          } catch (cloudErr) {
            console.warn("⚠️ Could not fetch from Supabase, falling back to local storage.", cloudErr);
            cloudLoadSuccess = false;
          }
        }

        // STEP 2: If cloud load failed or we're offline, load from local IndexedDB
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

        // STEP 3: Merge any local-only data (data that exists locally but not in cloud)
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
          } catch (mergeErr) {
            console.warn('⚠️ Error merging local-only data:', mergeErr);
          }
        }

        // SEEDING: If this is the very first time running the app (no users),
        // we populate the DB with the initial constants so the user can login.
        if (loadedUsers.length === 0) {
          // Check localStorage for migration (legacy support) or use constants
          const legacyUsers = localStorage.getItem('bk_users');
          const seedUsers = legacyUsers ? JSON.parse(legacyUsers) : INITIAL_USERS;

          // Normalize permissions to ensure data integrity
          const finalSeedUsers = seedUsers.map((u: any) => {
            if (!u.permissions) {
              if (u.role === Role.ADMIN) return { ...u, permissions: ['POS', 'INVENTORY', 'REPORTS', 'ADMIN'] };
              if (u.role === Role.MANAGER) return { ...u, permissions: ['POS', 'INVENTORY', 'REPORTS'] };
              return { ...u, permissions: ['POS'] };
            }
            return u;
          });

          // Save seeds to DB
          for (const u of finalSeedUsers) await db.put('users', u);
          loadedUsers = finalSeedUsers;
          console.log('✅ Seeded users to IndexedDB:', loadedUsers.length);
        } else {
          console.log('✅ Loaded users from IndexedDB:', loadedUsers.length);
        }

        // Seed Products if empty
        if (loadedProducts.length === 0) {
          const legacyProducts = localStorage.getItem('bk_products');
          const seedProducts = legacyProducts ? JSON.parse(legacyProducts) : INITIAL_PRODUCTS;
          for (const p of seedProducts) await db.put('products', p);
          loadedProducts = seedProducts;
        }

        // Sort Data (Newest first for logs/sales)
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
          // Set default settings (no logo by default - user must upload)
          const defaultSettings: BusinessSettings = {
            id: 'default',
            businessName: 'Grab Bottle ',
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

        // Restore user session after users are loaded (reuse savedSession from above)
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
            // Already handled above
          }
        }
      } catch (err) {
        console.error("Failed to load database:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Setup Event Listeners for Internet Connection
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
  // 2. CLOUD SYNCHRONIZATION LOOP
  // Checks for pending jobs in the queue and sends them to Cloud.
  // Enhanced with retry tracking and failure handling.
  // ------------------------------------------------------------------
  useEffect(() => {
    // Track retry attempts per job key (in memory, resets on page reload)
    const retryCountsRef: Record<number, number> = {};
    const MAX_RETRIES = 5;

    const syncData = async () => {
      // If we have no internet, we cannot sync.
      if (!isOnline) return;

      const db = await dbPromise();
      // Get keys and values separately since IDB auto-increment keys aren't in the value
      const keys = await db.getAllKeys('syncQueue');
      const values = await db.getAll('syncQueue');

      if (keys.length > 0) {
        setIsSyncing(true);
        console.log(`☁️ Starting Sync: ${keys.length} items pending...`);

        // Process queue items one by one
        for (let i = 0; i < keys.length; i++) {
          const jobKey = keys[i];
          const job = values[i];
          const retryCount = retryCountsRef[jobKey] || 0;

          // Skip permanently failed jobs (will be cleaned up or handled manually)
          if (retryCount >= MAX_RETRIES) {
            console.error(`❌ Job ${jobKey} (${job.type}) exceeded max retries. Moving to next item.`);
            // Optionally: Move to a dead-letter queue or delete
            // For now, delete to prevent queue blockage
            await db.delete('syncQueue', jobKey);
            delete retryCountsRef[jobKey];
            continue;
          }

          // Call our Cloud Service (Supabase)
          const success = await pushToCloud(job.type, job.payload);

          if (success) {
            // If cloud accepted it, remove from local queue
            await db.delete('syncQueue', jobKey);
            delete retryCountsRef[jobKey];
            console.log(`✅ Synced: ${job.type}`);
          } else {
            // Increment retry count and continue to next item
            retryCountsRef[jobKey] = retryCount + 1;
            console.warn(`⚠️ Sync job ${job.type} failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Will retry.`);
            // Don't break - try other items in queue
          }
        }

        setIsSyncing(false);
      }
    };

    // Run the sync check every 5 seconds
    const interval = setInterval(syncData, 5000);

    // Also run immediately if we just came online
    if (isOnline) syncData();

    return () => clearInterval(interval);
  }, [isOnline]); // Only re-run when online status changes

  // ------------------------------------------------------------------
  // 3. SESSION MANAGEMENT
  // Auto-logout after 5 minutes of inactivity
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    // Save session to localStorage
    localStorage.setItem('pos_session', JSON.stringify({
      userId: currentUser.id,
      lastActivity: lastActivity
    }));

    // Check for inactivity every 30 seconds
    const inactivityCheck = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const FIVE_MINUTES = 5 * 60 * 1000;

      if (timeSinceActivity >= FIVE_MINUTES) {
        console.log('⏱️ Auto-logout due to inactivity');
        setCurrentUser(null);
        localStorage.removeItem('pos_session');
      }
    }, 30000); // Check every 30 seconds

    // Track user activity
    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Listen for user interactions
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

  // Computed value: The currently active shift for the logged-in user
  const currentShift = shifts.find(s => s.status === 'OPEN' && s.cashierId === currentUser?.id) || null;

  // ------------------------------------------------------------------
  // 3. ACTION HANDLERS
  // ------------------------------------------------------------------

  /**
   * Add Audit Log
   * Records important actions for security.
   */
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

    // Update UI immediately (Optimistic)
    setAuditLogs(prev => [newLog, ...prev]);

    // Save to Local DB
    const db = await dbPromise();
    await db.put('auditLogs', newLog);

    // Queue for Cloud
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

  /**
   * User Management Actions
   */
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

  /**
   * Shift Management
   * Controls opening and closing the cash drawer sessions.
   * Updated: openingCash is now optional (defaults to 0) for businesses without a fixed float.
   */
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

    // Calculate how much cash should be in drawer based on sales (exclude voided)
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
   * PROCESS SALE
   * The core function of the POS. Handles money and inventory deduction.
   * CRITICAL FIX: Added stock validation, unitsSold tracking, and product sale logs.
   */
  const processSale = async (items: SaleItem[], paymentMethod: 'CASH' | 'CARD' | 'MOBILE') => {
    if (!currentUser) return undefined;

    // CRITICAL: Validate stock availability BEFORE processing sale
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productName}`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
    const totalCost = items.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);

    const newSale: Sale = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      totalAmount,
      totalCost,
      paymentMethod,
      items,
    };

    // DB Transaction: We need to update Products, save Sale, AND create product sale logs atomically
    const db = await dbPromise();
    const tx = db.transaction(['products', 'sales', 'productSaleLogs', 'syncQueue'], 'readwrite');

    try {
      // 1. Update Inventory locally (with stock deduction AND unitsSold increment)
      const updatedProducts = [...products];
      const newProductSaleLogs: ProductSaleLog[] = [];

      for (const item of items) {
        const idx = updatedProducts.findIndex(p => p.id === item.productId);
        if (idx > -1) {
          const currentProduct = updatedProducts[idx];

          // CRITICAL FIX: Update both stock AND unitsSold
          updatedProducts[idx] = {
            ...currentProduct,
            stock: currentProduct.stock - item.quantity,
            unitsSold: (currentProduct.unitsSold || 0) + item.quantity
          };

          // Update product in DB
          await tx.objectStore('products').put(updatedProducts[idx]);

          // Queue the product update so Cloud inventory matches
          await tx.objectStore('syncQueue').add({
            type: 'UPDATE_PRODUCT',
            payload: updatedProducts[idx],
            timestamp: Date.now()
          });

          // CRITICAL FIX: Create product sale log for analytics
          const saleLog: ProductSaleLog = {
            id: `${newSale.id}-${item.productId}-${Date.now()}`,
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

          // Save sale log to DB
          await tx.objectStore('productSaleLogs').put(saleLog);

          // Queue sale log for cloud sync
          await tx.objectStore('syncQueue').add({
            type: 'PRODUCT_SALE_LOG',
            payload: saleLog,
            timestamp: Date.now()
          });
        }
      }

      // 2. Save Sale to DB
      await tx.objectStore('sales').put(newSale);
      await tx.objectStore('syncQueue').add({
        type: 'SALE',
        payload: newSale,
        timestamp: Date.now()
      });

      // Commit transaction atomically
      await tx.done;

      // Update React State only after successful transaction
      setProducts(updatedProducts);
      setSales(prev => [newSale, ...prev]);
      setProductSaleLogs(prev => [...newProductSaleLogs, ...prev]);

      await addLog('SALE', `Sale #${newSale.id} processed for ${CURRENCY_FORMATTER.format(totalAmount)} via ${paymentMethod}`);

      return newSale;
    } catch (error) {
      // Transaction will auto-rollback on error
      console.error('Sale processing failed:', error);
      throw error;
    }
  };

  /**
   * UPDATE SALE
   * Updates an existing sale (e.g., fixing prices)
   */
  const updateSale = async (updatedSale: Sale) => {
    // Update React state
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));

    // Update IndexedDB
    const db = await dbPromise();
    await db.put('sales', updatedSale);

    // Queue for cloud sync
    await addToSyncQueue('UPDATE_SALE', updatedSale);
    await addLog('SALE_UPDATE', `Updated sale #${updatedSale.id.slice(-8)} - Total: ${CURRENCY_FORMATTER.format(updatedSale.totalAmount)}`);
  };

  /**
   * Inventory Management Functions
   */
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

  const updateProduct = async (product: Product) => {
    const productWithTimestamp = { ...product, updatedAt: new Date().toISOString() };
    setProducts(prev => prev.map(p => p.id === product.id ? productWithTimestamp : p));

    const db = await dbPromise();
    await db.put('products', productWithTimestamp);
    await addLog('PRODUCT_EDIT', `Updated product: ${product.name} (${product.size})`);
    await addToSyncQueue('UPDATE_PRODUCT', productWithTimestamp);
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
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const updatedProduct = { ...product, stock: product.stock + change, updatedAt: new Date().toISOString() };
    setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));

    const db = await dbPromise();
    await db.put('products', updatedProduct);
    await addLog('INVENTORY_ADJ', `Adjusted ${product.name} by ${change}. Reason: ${reason}`);
    await addToSyncQueue('ADJUST_STOCK', updatedProduct); // Send full product object to simple overwrite
  };

  const receiveStock = async (productId: string, quantity: number, newCost?: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const updatedProduct = {
      ...product,
      stock: product.stock + quantity,
      costPrice: newCost !== undefined ? newCost : product.costPrice,
      updatedAt: new Date().toISOString()
    };

    setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));

    const db = await dbPromise();
    await db.put('products', updatedProduct);
    await addLog('STOCK_RECEIVE', `Received ${quantity} of ${product.name}.`);
    await addToSyncQueue('RECEIVE_STOCK', updatedProduct);
  };

  /**
   * Void Request Management
   */
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

    // Restore inventory for voided sale
    const updatedProducts = [...products];
    for (const item of request.sale.items) {
      const idx = updatedProducts.findIndex(p => p.id === item.productId);
      if (idx > -1) {
        updatedProducts[idx] = { ...updatedProducts[idx], stock: updatedProducts[idx].stock + item.quantity };
      }
    }

    setVoidRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));
    setSales(prev => prev.map(s => s.id === request.saleId ? updatedSale : s));
    setProducts(updatedProducts);

    const db = await dbPromise();
    await db.put('voidRequests', updatedRequest);
    await db.put('sales', updatedSale);
    for (const p of updatedProducts) await db.put('products', p);

    await addLog('VOID_APPROVED', `Approved void for Sale #${request.saleId}${notes ? `. Notes: ${notes}` : ''}`);
    await addToSyncQueue('VOID_APPROVED', { request: updatedRequest, sale: updatedSale });
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

  /**
   * Stock Change Request Management
   */
  const requestStockChange = async (
    productId: string,
    changeType: 'ADJUST' | 'RECEIVE',
    quantityChange: number,
    reason?: string,
    newCost?: number
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

  /**
   * Business Settings
   */
  const updateBusinessSettings = async (settings: BusinessSettings) => {
    setBusinessSettings(settings);
    const db = await dbPromise();
    await db.put('businessSettings', settings);
    await addLog('SETTINGS_UPDATE', `Updated business settings: ${settings.businessName}`);
    await addToSyncQueue('UPDATE_SETTINGS', settings);
  };

  /**
   * FIX CORRUPTED SALES
   * Fixes sales where items have 0 cost or 0 price by recalculating from current product data
   */
  const fixCorruptedSales = async (): Promise<{ fixed: number; total: number }> => {
    const db = await dbPromise();
    const tx = db.transaction(['sales', 'productSaleLogs'], 'readwrite');

    let fixedCount = 0;
    const corruptedSales = sales.filter(sale =>
      sale.totalAmount === 0 || sale.totalCost === 0 ||
      sale.items.some(item => item.priceAtSale === 0 || item.costAtSale === 0)
    );

    const updatedSales: Sale[] = [];

    for (const sale of corruptedSales) {
      let needsUpdate = false;
      const updatedItems: SaleItem[] = [];

      for (const item of sale.items) {
        // Find the current product to get pricing info
        const product = products.find(p => p.id === item.productId);

        if (product && (item.priceAtSale === 0 || item.costAtSale === 0)) {
          // Use current product prices as fallback
          updatedItems.push({
            ...item,
            priceAtSale: item.priceAtSale === 0 ? product.sellingPrice : item.priceAtSale,
            costAtSale: item.costAtSale === 0 ? product.costPrice : item.costAtSale
          });
          needsUpdate = true;
        } else {
          updatedItems.push(item);
        }
      }

      if (needsUpdate) {
        // Recalculate totals
        const newTotalAmount = updatedItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
        const newTotalCost = updatedItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);

        const updatedSale: Sale = {
          ...sale,
          items: updatedItems,
          totalAmount: newTotalAmount,
          totalCost: newTotalCost
        };

        // Update in database
        await tx.objectStore('sales').put(updatedSale);
        updatedSales.push(updatedSale);
        fixedCount++;

        // Also update product sale logs if they exist
        for (const item of updatedItems) {
          const logId = `${sale.id}-${item.productId}-${Date.now()}`;
          const existingLogs = productSaleLogs.filter(log => log.saleId === sale.id && log.productId === item.productId);

          if (existingLogs.length > 0) {
            // Update existing log
            for (const log of existingLogs) {
              const updatedLog: ProductSaleLog = {
                ...log,
                priceAtSale: item.priceAtSale,
                costAtSale: item.costAtSale
              };
              await tx.objectStore('productSaleLogs').put(updatedLog);
            }
          }
        }
      }
    }

    await tx.done;

    // Update state
    if (updatedSales.length > 0) {
      setSales(prev => prev.map(sale => {
        const updated = updatedSales.find(s => s.id === sale.id);
        return updated || sale;
      }));

      await addLog('DATA_FIX', `Fixed ${fixedCount} corrupted sales records`);
    }

    return { fixed: fixedCount, total: corruptedSales.length };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">Loading System...</h2>
        <p className="text-slate-400 mt-2">Initializing Database</p>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{
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
      login,
      logout,
      updateUser,
      addUser,
      deleteUser,
      processSale,
      updateSale,
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
      businessSettings,
      updateBusinessSettings,
      fixCorruptedSales,
    }}>
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