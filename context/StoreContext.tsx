import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import {
  User, Product, Sale, Shift, AuditLog, Role, SaleItem, BusinessSettings, VoidRequest
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

  // --- INVENTORY ACTIONS ---
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  adjustStock: (productId: string, change: number, reason: string) => Promise<void>;
  receiveStock: (productId: string, quantity: number, newCost?: number) => Promise<void>;

  // --- SHIFT ACTIONS ---
  openShift: (openingCash?: number) => Promise<void>;
  closeShift: (closingCash: number, comments?: string) => Promise<void>;

  // --- VOID REQUEST ACTIONS ---
  requestVoid: (saleId: string, reason: string) => Promise<void>;
  approveVoid: (requestId: string, notes?: string) => Promise<void>;
  rejectVoid: (requestId: string, notes?: string) => Promise<void>;

  // --- SETTINGS ACTIONS ---
  updateBusinessSettings: (settings: BusinessSettings) => Promise<void>;
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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [voidRequests, setVoidRequests] = useState<VoidRequest[]>([]);
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

        // Fetch all data from local stores
        let loadedUsers = await db.getAll('users');
        let loadedProducts = await db.getAll('products');
        let loadedSales = await db.getAll('sales');
        let loadedShifts = await db.getAll('shifts');
        const loadedLogs = await db.getAll('auditLogs');
        let loadedVoidRequests = await db.getAll('voidRequests');

        // CLOUD SYNC PULL (On Startup)
        // If we are online, we try to fetch the latest "truth" from the server
        // for all data stores to ensure multi-device consistency.
        if (navigator.onLine) {
          try {
            // 1. Users
            const { data: cloudUsers } = await supabase.from('users').select('*');
            if (cloudUsers && cloudUsers.length > 0) {
              for (const u of cloudUsers) await db.put('users', u);
              loadedUsers = cloudUsers;
            }

            // 2. Products
            const { data: cloudProducts } = await supabase.from('products').select('*');
            if (cloudProducts && cloudProducts.length > 0) {
              for (const p of cloudProducts) await db.put('products', p);
              loadedProducts = cloudProducts;
            }

            // 3. Sales (merge cloud sales with local - cloud is source of truth for existing IDs)
            const { data: cloudSales } = await supabase.from('sales').select('*');
            if (cloudSales && cloudSales.length > 0) {
              // Merge: Cloud sales take precedence, but keep local-only sales
              const cloudSaleIds = new Set(cloudSales.map((s: Sale) => s.id));
              const localOnlySales = loadedSales.filter(s => !cloudSaleIds.has(s.id));
              const mergedSales = [...cloudSales, ...localOnlySales];
              for (const s of cloudSales) await db.put('sales', s);
              loadedSales = mergedSales;
            }

            // 4. Shifts (same merge strategy)
            const { data: cloudShifts } = await supabase.from('shifts').select('*');
            if (cloudShifts && cloudShifts.length > 0) {
              const cloudShiftIds = new Set(cloudShifts.map((s: Shift) => s.id));
              const localOnlyShifts = loadedShifts.filter(s => !cloudShiftIds.has(s.id));
              const mergedShifts = [...cloudShifts, ...localOnlyShifts];
              for (const s of cloudShifts) await db.put('shifts', s);
              loadedShifts = mergedShifts;
            }

            // 5. Business Settings (cloud takes precedence)
            const { data: cloudSettings } = await supabase.from('business_settings').select('*').eq('id', 'default').single();
            if (cloudSettings) {
              await db.put('businessSettings', cloudSettings);
              setBusinessSettings(cloudSettings);
              console.log('☁️ Business settings loaded from cloud');
            }

            console.log('☁️ Cloud sync pull complete');
          } catch (cloudErr) {
            console.warn("Could not fetch initial cloud data, using local.", cloudErr);
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
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    const db = await dbPromise();
    await db.put('users', updatedUser);
    await addLog('USER_UPDATE', `Updated user details for ${updatedUser.name}`);
    await addToSyncQueue('UPDATE_USER', updatedUser);
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
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
   */
  const processSale = async (items: SaleItem[], paymentMethod: 'CASH' | 'CARD' | 'MOBILE') => {
    if (!currentUser) return undefined;

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

    // DB Transaction: We need to update Products AND save Sale together
    const db = await dbPromise();
    const tx = db.transaction(['products', 'sales', 'syncQueue'], 'readwrite');

    // 1. Update Inventory locally (Optimistic)
    const updatedProducts = [...products];

    for (const item of items) {
      const idx = updatedProducts.findIndex(p => p.id === item.productId);
      if (idx > -1) {
        updatedProducts[idx] = {
          ...updatedProducts[idx],
          stock: updatedProducts[idx].stock - item.quantity
        };
        // Update product in DB
        await tx.objectStore('products').put(updatedProducts[idx]);

        // Queue the product update so Cloud inventory matches
        await tx.objectStore('syncQueue').add({
          type: 'UPDATE_PRODUCT',
          payload: updatedProducts[idx],
          timestamp: Date.now()
        });
      }
    }

    // Update React State
    setProducts(updatedProducts);
    setSales(prev => [newSale, ...prev]);

    // 2. Save Sale to DB
    await tx.objectStore('sales').put(newSale);
    await tx.objectStore('syncQueue').add({
      type: 'SALE',
      payload: newSale,
      timestamp: Date.now()
    });

    // Commit transaction
    await tx.done;

    await addLog('SALE', `Sale #${newSale.id} processed for ${CURRENCY_FORMATTER.format(totalAmount)} via ${paymentMethod}`);

    return newSale;
  };

  /**
   * Inventory Management Functions
   */
  const addProduct = async (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
    };
    setProducts(prev => [...prev, newProduct]);

    const db = await dbPromise();
    await db.put('products', newProduct);
    await addLog('PRODUCT_ADD', `Added product: ${newProduct.name} (${newProduct.size})`);
    await addToSyncQueue('ADD_PRODUCT', newProduct);
  };

  const updateProduct = async (product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));

    const db = await dbPromise();
    await db.put('products', product);
    await addLog('PRODUCT_EDIT', `Updated product: ${product.name} (${product.size})`);
    await addToSyncQueue('UPDATE_PRODUCT', product);
  };

  const adjustStock = async (productId: string, change: number, reason: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const updatedProduct = { ...product, stock: product.stock + change };
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
      costPrice: newCost !== undefined ? newCost : product.costPrice
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
   * Business Settings
   */
  const updateBusinessSettings = async (settings: BusinessSettings) => {
    setBusinessSettings(settings);
    const db = await dbPromise();
    await db.put('businessSettings', settings);
    await addLog('SETTINGS_UPDATE', `Updated business settings: ${settings.businessName}`);
    await addToSyncQueue('UPDATE_SETTINGS', settings);
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
      addProduct,
      updateProduct,
      adjustStock,
      receiveStock,
      openShift,
      closeShift,
      voidRequests,
      requestVoid,
      approveVoid,
      rejectVoid,
      businessSettings,
      updateBusinessSettings,
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