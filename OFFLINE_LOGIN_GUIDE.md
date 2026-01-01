# Offline Login & Sync Guide

## ✅ What's Already Working

### 1. **Offline Login**
Your app already supports offline login! Here's how it works:

- **Users are stored in IndexedDB** (`@c:\Users\ADMIN\Documents\GitHub\PortSide-Liquor-Store\db.ts`)
- **On first load**, users sync from Supabase to local DB (`@c:\Users\ADMIN\Documents\GitHub\PortSide-Liquor-Store\context\StoreContext.tsx:136-141`)
- **When offline**, login uses local IndexedDB data (`@c:\Users\ADMIN\Documents\GitHub\PortSide-Liquor-Store\context\StoreContext.tsx:466-478`)
- **Session persistence** via localStorage for 5 minutes of inactivity

### 2. **Product Search on Inventory Page**
Already implemented at `@c:\Users\ADMIN\Documents\GitHub\PortSide-Liquor-Store\components\pages\Inventory.tsx:253-258`
- Searches by: Product name, SKU, or Barcode
- Works in real-time as you type

### 3. **Stock Change Approval System**
Fully implemented with offline support:
- Requests stored locally in IndexedDB
- Syncs to Supabase when online
- Admin approval interface at `/admin/stock-approvals`

---

## 🔧 Setup Required

### Step 1: Run SQL Schema in Supabase

Open your Supabase SQL Editor and run the updated schema:

**File:** `supabase_schema.sql`

**New table added (lines 154-181):**
```sql
CREATE TABLE IF NOT EXISTS stock_change_requests (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL CHECK ("changeType" IN ('ADJUST', 'RECEIVE')),
    "quantityChange" INTEGER NOT NULL,
    reason TEXT,
    "newCost" NUMERIC(10, 2),
    "requestedBy" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    "reviewedBy" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "reviewNotes" TEXT,
    "currentStock" INTEGER NOT NULL
);

ALTER TABLE stock_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON stock_change_requests FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_stock_change_requests_status ON stock_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_change_requests_requested_at ON stock_change_requests("requestedAt" DESC);
```

### Step 2: Verify Supabase Connection

Your Supabase is already configured in `cloud.ts`:
- **URL:** `https://gdmezqfvlirkaamwfqmf.supabase.co`
- **Connection:** Active and working

---

## 📱 How Offline Mode Works

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│                    ONLINE MODE                      │
├─────────────────────────────────────────────────────┤
│ 1. App loads → Fetch from Supabase                 │
│ 2. Save to IndexedDB (local cache)                 │
│ 3. User actions → Save to IndexedDB                │
│ 4. Queue sync jobs → Push to Supabase every 5s     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   OFFLINE MODE                      │
├─────────────────────────────────────────────────────┤
│ 1. App loads → Read from IndexedDB only            │
│ 2. User actions → Save to IndexedDB                │
│ 3. Queue sync jobs → Store locally                 │
│ 4. When back online → Auto-sync queued jobs        │
└─────────────────────────────────────────────────────┘
```

### Login Process (Offline-First)

**File:** `context/StoreContext.tsx`

1. **Initial Load** (lines 95-300):
   - Try to fetch users from Supabase if online
   - If offline or fails, use local IndexedDB
   - If no users exist, seed with `INITIAL_USERS` from constants

2. **Login Function** (lines 466-478):
   ```typescript
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
   ```
   - **Always uses local data** (works offline!)
   - Saves session to localStorage
   - Auto-restores session on page reload (if < 5 min inactive)

3. **Session Restoration** (lines 100-120, 280-298):
   - Checks localStorage for saved session
   - Validates inactivity timeout (5 minutes)
   - Restores user automatically

---

## 🐛 Troubleshooting Offline Login

### Issue: "Cannot login when offline"

**Cause:** Users not synced to local DB

**Solution:**
1. Connect to internet once
2. Open the app (users will sync from Supabase)
3. Now you can go offline and login will work

### Issue: "Login works online but not offline"

**Check:**
1. Open browser DevTools → Application → IndexedDB
2. Look for database: `GrabBottlePOS_DB`
3. Check `users` store has data
4. If empty, you need to sync once while online

### Issue: "Session expires too quickly"

**Current timeout:** 5 minutes of inactivity

**To change:** Edit `FIVE_MINUTES` constant in `StoreContext.tsx:106`
```typescript
const FIVE_MINUTES = 5 * 60 * 1000; // Change to desired milliseconds
```

---

## 🔄 Sync Queue System

### How It Works

**File:** `context/StoreContext.tsx` (lines 320-385)

1. **Every action** creates a sync job:
   ```typescript
   await addToSyncQueue('STOCK_CHANGE_REQUEST', newRequest);
   ```

2. **Background sync** runs every 5 seconds:
   - Checks if online
   - Processes queue items one by one
   - Retries failed jobs up to 5 times
   - Removes successfully synced items

3. **Retry Logic:**
   - Max retries: 5 attempts
   - Failed jobs deleted after max retries
   - Prevents queue blockage

### Supported Sync Types

From `cloud.ts`:
- `SALE` → sales table
- `ADD_PRODUCT`, `UPDATE_PRODUCT` → products table
- `ADJUST_STOCK`, `RECEIVE_STOCK` → products table
- `ADD_USER`, `UPDATE_USER`, `DELETE_USER` → users table
- `OPEN_SHIFT`, `CLOSE_SHIFT` → shifts table
- `LOG` → audit_logs table
- `VOID_REQUEST`, `VOID_APPROVED`, `VOID_REJECTED` → void_requests table
- `STOCK_CHANGE_REQUEST`, `STOCK_CHANGE_APPROVED`, `STOCK_CHANGE_REJECTED` → stock_change_requests table
- `UPDATE_SETTINGS` → business_settings table

---

## 📊 Data Persistence

### What's Stored Locally (IndexedDB)

| Store | Purpose | Offline Access |
|-------|---------|----------------|
| `users` | Staff login credentials | ✅ Yes |
| `products` | Inventory items | ✅ Yes |
| `sales` | Transaction history | ✅ Yes |
| `shifts` | Cash drawer sessions | ✅ Yes |
| `auditLogs` | Activity tracking | ✅ Yes |
| `voidRequests` | Void approvals | ✅ Yes |
| `stockChangeRequests` | Stock approvals | ✅ Yes |
| `businessSettings` | Store configuration | ✅ Yes |
| `syncQueue` | Pending cloud syncs | ✅ Yes |

### Session Storage (localStorage)

- **Key:** `pos_session`
- **Data:** `{ userId, lastActivity }`
- **Timeout:** 5 minutes
- **Purpose:** Auto-login on page reload

---

## 🎯 Testing Offline Mode

### Test Scenario 1: First-Time Offline Login

1. **While Online:**
   - Open app
   - Wait for "Cloud Connected" status
   - Users sync from Supabase to local DB

2. **Go Offline:**
   - Disconnect internet
   - Refresh page
   - Login should work with local data

### Test Scenario 2: Offline Stock Changes

1. **Go Offline**
2. **Navigate to Inventory**
3. **Submit stock change request**
4. **Check:**
   - Request saved locally
   - Shows "Awaiting approval" message
5. **Go Online:**
   - Request auto-syncs to Supabase
   - Admin can approve from any device

### Test Scenario 3: Multi-Device Sync

1. **Device A (Offline):**
   - Make stock change request
   - Request queued locally

2. **Device A (Back Online):**
   - Request syncs to Supabase

3. **Device B:**
   - Refresh page
   - See new request from Device A
   - Approve/reject

4. **Device A:**
   - Refresh page
   - See approval status from Device B

---

## 🚀 Next Steps

1. ✅ **Run SQL schema** in Supabase (add `stock_change_requests` table)
2. ✅ **Test offline login** (disconnect internet, try logging in)
3. ✅ **Test stock approvals** (submit request offline, approve when online)
4. ✅ **Verify product search** (type in search box on Inventory page)

---

## 📝 Summary

Your app is **fully offline-capable**:

- ✅ Login works offline (uses IndexedDB)
- ✅ All data cached locally
- ✅ Actions queued when offline
- ✅ Auto-sync when back online
- ✅ Product search functional
- ✅ Stock approval system integrated
- ✅ Session persistence (5 min timeout)

**Only requirement:** Users must connect online **once** to sync initial data from Supabase to local DB.
