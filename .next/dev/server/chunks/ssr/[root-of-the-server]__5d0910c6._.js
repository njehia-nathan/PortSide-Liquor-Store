module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/types.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AlcoholType",
    ()=>AlcoholType,
    "Role",
    ()=>Role
]);
var Role = /*#__PURE__*/ function(Role) {
    Role["ADMIN"] = "ADMIN";
    Role["MANAGER"] = "MANAGER";
    Role["CASHIER"] = "CASHIER";
    return Role;
}({});
var AlcoholType = /*#__PURE__*/ function(AlcoholType) {
    AlcoholType["WHISKEY"] = "Whiskey";
    AlcoholType["VODKA"] = "Vodka";
    AlcoholType["GIN"] = "Gin";
    AlcoholType["RUM"] = "Rum";
    AlcoholType["WINE"] = "Wine";
    AlcoholType["BEER"] = "Beer";
    AlcoholType["RTD"] = "RTD";
    AlcoholType["OTHER"] = "Other";
    return AlcoholType;
}({});
}),
"[project]/constants.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CURRENCY_FORMATTER",
    ()=>CURRENCY_FORMATTER,
    "INITIAL_PRODUCTS",
    ()=>INITIAL_PRODUCTS,
    "INITIAL_USERS",
    ()=>INITIAL_USERS
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/types.ts [app-ssr] (ecmascript)");
;
const INITIAL_USERS = [
    {
        id: 'u1',
        name: 'Owner Admin',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Role"].ADMIN,
        pin: '1111',
        permissions: [
            'POS',
            'INVENTORY',
            'REPORTS',
            'ADMIN'
        ]
    },
    {
        id: 'u2',
        name: 'Store Manager',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Role"].MANAGER,
        pin: '2222',
        permissions: [
            'POS',
            'INVENTORY',
            'REPORTS'
        ]
    },
    {
        id: 'u3',
        name: 'Joe Cashier',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Role"].CASHIER,
        pin: '3333',
        permissions: [
            'POS'
        ]
    }
];
const INITIAL_PRODUCTS = [
    {
        id: 'p1',
        name: 'Jameson Irish Whiskey',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AlcoholType"].WHISKEY,
        size: '750ml',
        brand: 'Jameson',
        sku: '1001',
        costPrice: 2000,
        sellingPrice: 3299,
        stock: 24,
        lowStockThreshold: 5
    },
    {
        id: 'p2',
        name: 'Jameson Irish Whiskey',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AlcoholType"].WHISKEY,
        size: '1L',
        brand: 'Jameson',
        sku: '1002',
        costPrice: 2800,
        sellingPrice: 4599,
        stock: 12,
        lowStockThreshold: 5
    },
    {
        id: 'p3',
        name: 'Smirnoff Red',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AlcoholType"].VODKA,
        size: '750ml',
        brand: 'Smirnoff',
        sku: '2001',
        costPrice: 1200,
        sellingPrice: 1999,
        stock: 36,
        lowStockThreshold: 10
    },
    {
        id: 'p4',
        name: 'Tanqueray London Dry',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AlcoholType"].GIN,
        size: '750ml',
        brand: 'Tanqueray',
        sku: '3001',
        costPrice: 1850,
        sellingPrice: 2999,
        stock: 15,
        lowStockThreshold: 5
    },
    {
        id: 'p5',
        name: 'Corona Extra 6pk',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AlcoholType"].BEER,
        size: '330ml x6',
        brand: 'Corona',
        sku: '4001',
        costPrice: 800,
        sellingPrice: 1399,
        stock: 50,
        lowStockThreshold: 12
    }
];
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
});
}),
"[project]/db.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addToSyncQueue",
    ()=>addToSyncQueue,
    "dbPromise",
    ()=>dbPromise,
    "getDB",
    ()=>getDB,
    "initDB",
    ()=>initDB
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$idb$2f$build$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/idb/build/index.js [app-ssr] (ecmascript)");
;
// Name of the database in the browser's developer tools
const DB_NAME = 'PortSidePOS_DB';
const DB_VERSION = 2; // Bumped for businessSettings store
const initDB = async ()=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$idb$2f$build$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["openDB"])(DB_NAME, DB_VERSION, {
        upgrade (db) {
            // Create 'users' table if missing, using 'id' as the primary key
            if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', {
                keyPath: 'id'
            });
            // Create 'products' table
            if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', {
                keyPath: 'id'
            });
            // Create 'sales' table
            if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', {
                keyPath: 'id'
            });
            // Create 'shifts' table
            if (!db.objectStoreNames.contains('shifts')) db.createObjectStore('shifts', {
                keyPath: 'id'
            });
            // Create 'auditLogs' table
            if (!db.objectStoreNames.contains('auditLogs')) db.createObjectStore('auditLogs', {
                keyPath: 'id'
            });
            // Create 'businessSettings' table
            if (!db.objectStoreNames.contains('businessSettings')) db.createObjectStore('businessSettings', {
                keyPath: 'id'
            });
            // Create 'syncQueue' table with auto-incrementing numbers for keys
            if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', {
                keyPath: 'key',
                autoIncrement: true
            });
        }
    });
};
// Singleton promise to ensure we only open the DB once
// Only initialize on client side (browser) - not on server
let dbPromiseInternal = null;
const getDB = ()=>{
    if ("TURBOPACK compile-time truthy", 1) {
        // Server-side: return a rejected promise
        return Promise.reject(new Error('IndexedDB is not available on the server'));
    }
    //TURBOPACK unreachable
    ;
};
const dbPromise = getDB;
const addToSyncQueue = async (type, payload)=>{
    const db = await getDB();
    await db.add('syncQueue', {
        type,
        payload,
        timestamp: Date.now()
    });
};
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/punycode [external] (punycode, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("punycode", () => require("punycode"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[project]/cloud.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pushToCloud",
    ()=>pushToCloud,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/module/index.js [app-ssr] (ecmascript) <locals>");
;
// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// Real credentials provided by user
const SUPABASE_URL = 'https://gdmezqfvlirkaamwfqmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbWV6cWZ2bGlya2FhbXdmcW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTI0MzEsImV4cCI6MjA4MTM4ODQzMX0.YymnaJGMt-z63v8lyXdIoVX7m6u7ZqJM8AFU4QImoRs';
// Check if keys are configured.
const IS_CONFIGURED = SUPABASE_URL !== 'https://xyzcompany.supabase.co';
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(SUPABASE_URL, SUPABASE_KEY);
const pushToCloud = async (type, payload)=>{
    // If user hasn't set up Supabase yet, just pretend we synced it.
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        let table = '';
        let action = 'upsert'; // Default to upsert (insert or update)
        // Map internal action types to Supabase Database Tables
        switch(type){
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
                if (error.code === '42703') {
                    console.error(`[Cloud Sync] Schema Error: A column is missing in Supabase table '${table}'. Check your SQL setup.`, error.message);
                }
                throw error;
            }
        }
        return true; // Success
    } catch (error) {
        console.error(`[Cloud Error] Failed to sync ${type}:`, error);
        return false; // Failed, keep in queue
    }
};
}),
"[project]/context/StoreContext.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StoreProvider",
    ()=>StoreProvider,
    "useStore",
    ()=>useStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/types.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/constants.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/db.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$cloud$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/cloud.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
const StoreContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(undefined);
const StoreProvider = ({ children })=>{
    // --- LOCAL STATE ---
    // These hold the data currently displayed on the screen
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [isOnline, setIsOnline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(navigator.onLine);
    const [isSyncing, setIsSyncing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [currentUser, setCurrentUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [users, setUsers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [products, setProducts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [sales, setSales] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [shifts, setShifts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [auditLogs, setAuditLogs] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [businessSettings, setBusinessSettings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // ------------------------------------------------------------------
    // 1. INITIALIZATION
    // Loads data from IndexedDB when the app starts.
    // ------------------------------------------------------------------
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const loadData = async ()=>{
            try {
                const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
                // Fetch all data from local stores
                let loadedUsers = await db.getAll('users');
                let loadedProducts = await db.getAll('products');
                let loadedSales = await db.getAll('sales');
                let loadedShifts = await db.getAll('shifts');
                const loadedLogs = await db.getAll('auditLogs');
                // CLOUD SYNC PULL (On Startup)
                // If we are online, we try to fetch the latest "truth" from the server
                // for all data stores to ensure multi-device consistency.
                if (navigator.onLine) {
                    try {
                        // 1. Users
                        const { data: cloudUsers } = await __TURBOPACK__imported__module__$5b$project$5d2f$cloud$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('users').select('*');
                        if (cloudUsers && cloudUsers.length > 0) {
                            for (const u of cloudUsers)await db.put('users', u);
                            loadedUsers = cloudUsers;
                        }
                        // 2. Products
                        const { data: cloudProducts } = await __TURBOPACK__imported__module__$5b$project$5d2f$cloud$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('products').select('*');
                        if (cloudProducts && cloudProducts.length > 0) {
                            for (const p of cloudProducts)await db.put('products', p);
                            loadedProducts = cloudProducts;
                        }
                        // 3. Sales (merge cloud sales with local - cloud is source of truth for existing IDs)
                        const { data: cloudSales } = await __TURBOPACK__imported__module__$5b$project$5d2f$cloud$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('sales').select('*');
                        if (cloudSales && cloudSales.length > 0) {
                            // Merge: Cloud sales take precedence, but keep local-only sales
                            const cloudSaleIds = new Set(cloudSales.map((s)=>s.id));
                            const localOnlySales = loadedSales.filter((s)=>!cloudSaleIds.has(s.id));
                            const mergedSales = [
                                ...cloudSales,
                                ...localOnlySales
                            ];
                            for (const s of cloudSales)await db.put('sales', s);
                            loadedSales = mergedSales;
                        }
                        // 4. Shifts (same merge strategy)
                        const { data: cloudShifts } = await __TURBOPACK__imported__module__$5b$project$5d2f$cloud$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('shifts').select('*');
                        if (cloudShifts && cloudShifts.length > 0) {
                            const cloudShiftIds = new Set(cloudShifts.map((s)=>s.id));
                            const localOnlyShifts = loadedShifts.filter((s)=>!cloudShiftIds.has(s.id));
                            const mergedShifts = [
                                ...cloudShifts,
                                ...localOnlyShifts
                            ];
                            for (const s of cloudShifts)await db.put('shifts', s);
                            loadedShifts = mergedShifts;
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
                    const seedUsers = legacyUsers ? JSON.parse(legacyUsers) : __TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["INITIAL_USERS"];
                    // Normalize permissions to ensure data integrity
                    const finalSeedUsers = seedUsers.map((u)=>{
                        if (!u.permissions) {
                            if (u.role === __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Role"].ADMIN) return {
                                ...u,
                                permissions: [
                                    'POS',
                                    'INVENTORY',
                                    'REPORTS',
                                    'ADMIN'
                                ]
                            };
                            if (u.role === __TURBOPACK__imported__module__$5b$project$5d2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Role"].MANAGER) return {
                                ...u,
                                permissions: [
                                    'POS',
                                    'INVENTORY',
                                    'REPORTS'
                                ]
                            };
                            return {
                                ...u,
                                permissions: [
                                    'POS'
                                ]
                            };
                        }
                        return u;
                    });
                    // Save seeds to DB
                    for (const u of finalSeedUsers)await db.put('users', u);
                    loadedUsers = finalSeedUsers;
                }
                // Seed Products if empty
                if (loadedProducts.length === 0) {
                    const legacyProducts = localStorage.getItem('bk_products');
                    const seedProducts = legacyProducts ? JSON.parse(legacyProducts) : __TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["INITIAL_PRODUCTS"];
                    for (const p of seedProducts)await db.put('products', p);
                    loadedProducts = seedProducts;
                }
                // Sort Data (Newest first for logs/sales)
                loadedSales.sort((a, b)=>new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                loadedLogs.sort((a, b)=>new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                // Load Business Settings
                const loadedSettings = await db.get('businessSettings', 'default');
                if (loadedSettings) {
                    setBusinessSettings(loadedSettings);
                } else {
                    // Set default settings
                    const defaultSettings = {
                        id: 'default',
                        businessName: 'Port Side Liquor',
                        phone: '+254 700 000000',
                        email: '',
                        location: 'Nairobi, Kenya',
                        logoUrl: '/icons/icon-192x192.png',
                        receiptFooter: 'Thank you for your business!'
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
            } catch (err) {
                console.error("Failed to load database:", err);
            } finally{
                setIsLoading(false);
            }
        };
        loadData();
        // Setup Event Listeners for Internet Connection
        const handleOnline = ()=>setIsOnline(true);
        const handleOffline = ()=>setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return ()=>{
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    // ------------------------------------------------------------------
    // 2. CLOUD SYNCHRONIZATION LOOP
    // Checks for pending jobs in the queue and sends them to Cloud.
    // Enhanced with retry tracking and failure handling.
    // ------------------------------------------------------------------
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // Track retry attempts per job key (in memory, resets on page reload)
        const retryCountsRef = {};
        const MAX_RETRIES = 5;
        const syncData = async ()=>{
            // If we have no internet, we cannot sync.
            if (!isOnline) return;
            const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
            // Get keys and values separately since IDB auto-increment keys aren't in the value
            const keys = await db.getAllKeys('syncQueue');
            const values = await db.getAll('syncQueue');
            if (keys.length > 0) {
                setIsSyncing(true);
                console.log(`☁️ Starting Sync: ${keys.length} items pending...`);
                // Process queue items one by one
                for(let i = 0; i < keys.length; i++){
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
                    const success = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$cloud$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["pushToCloud"])(job.type, job.payload);
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
        return ()=>clearInterval(interval);
    }, [
        isOnline
    ]); // Only re-run when online status changes
    // Computed value: The currently active shift for the logged-in user
    const currentShift = shifts.find((s)=>s.status === 'OPEN' && s.cashierId === currentUser?.id) || null;
    // ------------------------------------------------------------------
    // 3. ACTION HANDLERS
    // ------------------------------------------------------------------
    /**
   * Add Audit Log
   * Records important actions for security.
   */ const addLog = async (action, details)=>{
        if (!currentUser) return;
        const newLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action,
            details
        };
        // Update UI immediately (Optimistic)
        setAuditLogs((prev)=>[
                newLog,
                ...prev
            ]);
        // Save to Local DB
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('auditLogs', newLog);
        // Queue for Cloud
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('LOG', newLog);
    };
    const login = (pin)=>{
        const user = users.find((u)=>u.pin === pin);
        if (user) {
            setCurrentUser(user);
            return true;
        }
        return false;
    };
    const logout = ()=>{
        setCurrentUser(null);
    };
    /**
   * User Management Actions
   */ const updateUser = async (updatedUser)=>{
        setUsers((prev)=>prev.map((u)=>u.id === updatedUser.id ? updatedUser : u));
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('users', updatedUser);
        await addLog('USER_UPDATE', `Updated user details for ${updatedUser.name}`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('UPDATE_USER', updatedUser);
    };
    const addUser = async (userData)=>{
        const newUser = {
            ...userData,
            id: Date.now().toString()
        };
        setUsers((prev)=>[
                ...prev,
                newUser
            ]);
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('users', newUser);
        await addLog('USER_ADD', `Added new user: ${newUser.name} (${newUser.role})`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('ADD_USER', newUser);
    };
    const deleteUser = async (userId)=>{
        const user = users.find((u)=>u.id === userId);
        if (user) {
            setUsers((prev)=>prev.filter((u)=>u.id !== userId));
            const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
            await db.delete('users', userId);
            await addLog('USER_DELETE', `Deleted user: ${user.name}`);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('DELETE_USER', {
                id: userId
            });
        }
    };
    /**
   * Shift Management
   * Controls opening and closing the cash drawer sessions.
   * Updated: openingCash is now optional (defaults to 0) for businesses without a fixed float.
   */ const openShift = async (openingCash = 0)=>{
        if (!currentUser) return;
        const newShift = {
            id: Date.now().toString(),
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            startTime: new Date().toISOString(),
            openingCash,
            status: 'OPEN'
        };
        setShifts((prev)=>[
                ...prev,
                newShift
            ]);
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('shifts', newShift);
        const details = openingCash > 0 ? `Shift opened with ${__TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CURRENCY_FORMATTER"].format(openingCash)}` : `Shift opened (No Float)`;
        await addLog('SHIFT_OPEN', details);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('OPEN_SHIFT', newShift);
    };
    const closeShift = async (closingCash)=>{
        if (!currentShift) return;
        // Calculate how much cash should be in drawer based on sales
        const shiftSales = sales.filter((s)=>new Date(s.timestamp) > new Date(currentShift.startTime) && s.cashierId === currentShift.cashierId && s.paymentMethod === 'CASH');
        const totalCashSales = shiftSales.reduce((acc, s)=>acc + s.totalAmount, 0);
        const expected = currentShift.openingCash + totalCashSales;
        const updatedShift = {
            ...currentShift,
            endTime: new Date().toISOString(),
            closingCash,
            expectedCash: expected,
            status: 'CLOSED'
        };
        setShifts((prev)=>prev.map((s)=>s.id === currentShift.id ? updatedShift : s));
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('shifts', updatedShift);
        await addLog('SHIFT_CLOSE', `Shift closed. Counted: ${__TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CURRENCY_FORMATTER"].format(closingCash)}, Expected: ${__TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CURRENCY_FORMATTER"].format(expected)}`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('CLOSE_SHIFT', updatedShift);
    };
    /**
   * PROCESS SALE
   * The core function of the POS. Handles money and inventory deduction.
   */ const processSale = async (items, paymentMethod)=>{
        if (!currentUser) return undefined;
        const totalAmount = items.reduce((sum, item)=>sum + item.priceAtSale * item.quantity, 0);
        const totalCost = items.reduce((sum, item)=>sum + item.costAtSale * item.quantity, 0);
        const newSale = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            totalAmount,
            totalCost,
            paymentMethod,
            items
        };
        // DB Transaction: We need to update Products AND save Sale together
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        const tx = db.transaction([
            'products',
            'sales',
            'syncQueue'
        ], 'readwrite');
        // 1. Update Inventory locally (Optimistic)
        const updatedProducts = [
            ...products
        ];
        for (const item of items){
            const idx = updatedProducts.findIndex((p)=>p.id === item.productId);
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
        setSales((prev)=>[
                newSale,
                ...prev
            ]);
        // 2. Save Sale to DB
        await tx.objectStore('sales').put(newSale);
        await tx.objectStore('syncQueue').add({
            type: 'SALE',
            payload: newSale,
            timestamp: Date.now()
        });
        // Commit transaction
        await tx.done;
        await addLog('SALE', `Sale #${newSale.id} processed for ${__TURBOPACK__imported__module__$5b$project$5d2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CURRENCY_FORMATTER"].format(totalAmount)} via ${paymentMethod}`);
        return newSale;
    };
    /**
   * Inventory Management Functions
   */ const addProduct = async (productData)=>{
        const newProduct = {
            ...productData,
            id: Date.now().toString()
        };
        setProducts((prev)=>[
                ...prev,
                newProduct
            ]);
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('products', newProduct);
        await addLog('PRODUCT_ADD', `Added product: ${newProduct.name} (${newProduct.size})`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('ADD_PRODUCT', newProduct);
    };
    const updateProduct = async (product)=>{
        setProducts((prev)=>prev.map((p)=>p.id === product.id ? product : p));
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('products', product);
        await addLog('PRODUCT_EDIT', `Updated product: ${product.name} (${product.size})`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('UPDATE_PRODUCT', product);
    };
    const adjustStock = async (productId, change, reason)=>{
        const product = products.find((p)=>p.id === productId);
        if (!product) return;
        const updatedProduct = {
            ...product,
            stock: product.stock + change
        };
        setProducts((prev)=>prev.map((p)=>p.id === productId ? updatedProduct : p));
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('products', updatedProduct);
        await addLog('INVENTORY_ADJ', `Adjusted ${product.name} by ${change}. Reason: ${reason}`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('ADJUST_STOCK', updatedProduct); // Send full product object to simple overwrite
    };
    const receiveStock = async (productId, quantity, newCost)=>{
        const product = products.find((p)=>p.id === productId);
        if (!product) return;
        const updatedProduct = {
            ...product,
            stock: product.stock + quantity,
            costPrice: newCost !== undefined ? newCost : product.costPrice
        };
        setProducts((prev)=>prev.map((p)=>p.id === productId ? updatedProduct : p));
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('products', updatedProduct);
        await addLog('STOCK_RECEIVE', `Received ${quantity} of ${product.name}.`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('RECEIVE_STOCK', updatedProduct);
    };
    /**
   * Business Settings
   */ const updateBusinessSettings = async (settings)=>{
        setBusinessSettings(settings);
        const db = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dbPromise"])();
        await db.put('businessSettings', settings);
        await addLog('SETTINGS_UPDATE', `Updated business settings: ${settings.businessName}`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["addToSyncQueue"])('UPDATE_SETTINGS', settings);
    };
    if (isLoading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"
                }, void 0, false, {
                    fileName: "[project]/context/StoreContext.tsx",
                    lineNumber: 561,
                    columnNumber: 15
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "text-xl font-bold",
                    children: "Loading System..."
                }, void 0, false, {
                    fileName: "[project]/context/StoreContext.tsx",
                    lineNumber: 562,
                    columnNumber: 15
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-slate-400 mt-2",
                    children: "Initializing Database"
                }, void 0, false, {
                    fileName: "[project]/context/StoreContext.tsx",
                    lineNumber: 563,
                    columnNumber: 15
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/context/StoreContext.tsx",
            lineNumber: 560,
            columnNumber: 11
        }, ("TURBOPACK compile-time value", void 0));
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StoreContext.Provider, {
        value: {
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
            businessSettings,
            updateBusinessSettings
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/context/StoreContext.tsx",
        lineNumber: 569,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
const useStore = ()=>{
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(StoreContext);
    if (context === undefined) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};
}),
"[project]/app/layout.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RootLayout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$context$2f$StoreContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/context/StoreContext.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
function RootLayout({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("html", {
        lang: "en",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("head", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        charSet: "UTF-8"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 15,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        name: "viewport",
                        content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 16,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                        children: "Port Side Liquor POS"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("link", {
                        rel: "manifest",
                        href: "/manifest.json"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 18,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        name: "theme-color",
                        content: "#0f172a"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 19,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        name: "apple-mobile-web-app-capable",
                        content: "yes"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 20,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        name: "apple-mobile-web-app-status-bar-style",
                        content: "black-translucent"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 21,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("link", {
                        rel: "icon",
                        type: "image/png",
                        href: "/icons/icon-192x192.png"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 22,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("link", {
                        rel: "apple-touch-icon",
                        href: "/icons/icon-192x192.png"
                    }, void 0, false, {
                        fileName: "[project]/app/layout.tsx",
                        lineNumber: 23,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/layout.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("body", {
                className: "bg-gray-100 text-gray-900 antialiased select-none",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$context$2f$StoreContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StoreProvider"], {
                    children: children
                }, void 0, false, {
                    fileName: "[project]/app/layout.tsx",
                    lineNumber: 26,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/layout.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/layout.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__5d0910c6._.js.map