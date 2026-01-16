# CRITICAL PRICE CHANGE BUGS & CONFLICTS ANALYSIS

## 🔴 CRITICAL ISSUES FOUND

### 1. **RACE CONDITION: Cloud Sync Overwrites Local Price Changes**
**Location**: `@context/StoreContext.tsx:148-211`

**The Problem**:
- When you update a product price locally, it gets saved to IndexedDB and queued for cloud sync
- BUT the `smartMerge` function uses **last-write-wins** based on `updatedAt` timestamps
- If cloud sync happens BEFORE your local change syncs, OR if another device syncs first, your price change gets OVERWRITTEN

**Code Evidence**:
```typescript
// Lines 168-180: Last-write-wins logic
if (localItem.updatedAt && cloudItem.updatedAt) {
  const localTime = new Date(localItem.updatedAt).getTime();
  const cloudTime = new Date(cloudItem.updatedAt).getTime();
  
  if (localTime > cloudTime) {
    // Local is newer, use it and queue for sync
    merged.set(localItem.id, localItem);
    await addToSyncQueue(`UPDATE_${storeName.toUpperCase()}`, localItem);
  }
  // else: cloud is newer or equal, already in merged
}
```

**Why This Causes Hell**:
- Every 5 seconds, the sync loop runs (`line 516`)
- On app startup, cloud data loads FIRST and overwrites local changes
- If you change a price and refresh the page before sync completes → REVERTED
- If two users change prices simultaneously → one gets overwritten silently

---

### 2. **MISSING updatedAt IN MULTIPLE PLACES**
**Location**: Multiple files

**The Problem**:
- `updateProduct` function adds `updatedAt` (`line 958`)
- BUT `receiveStock` adds `updatedAt` (`line 1000`)
- BUT `adjustStock` adds `updatedAt` (`line 983`)
- BUT **Admin.tsx line 66** calls `updateProduct` with the ENTIRE form data INCLUDING old `updatedAt`!

**Code Evidence**:
```typescript
// Admin.tsx:66
const handleProductSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const payload = productFormData as Product; // ⚠️ Includes OLD updatedAt!
  if (editingProduct) {
    updateProduct(payload); // This will use OLD timestamp
  }
  // ...
}
```

**Why This Causes Hell**:
- When editing a product in Admin panel, you're passing the OLD `updatedAt` from the form
- `updateProduct` then overwrites it with a NEW timestamp
- But there's a brief moment where the old timestamp exists
- This can cause merge conflicts where cloud thinks local is older

---

### 3. **PRODUCT PRICE CHANGES DON'T UPDATE SALE HISTORY**
**Location**: `@context/StoreContext.tsx:957-965`

**The Problem**:
- When you change `costPrice` or `sellingPrice`, it only updates the product
- Past sales still reference OLD prices via `priceAtSale` and `costAtSale`
- Reports show WRONG profit margins because they compare current prices with old sale prices

**Why This Causes Hell**:
- You change a price from 1000 to 1500
- Old sales show 1000 but product now shows 1500
- Reports calculate profit using CURRENT product price vs OLD sale price
- Your profit margins look completely wrong

---

### 4. **SYNC QUEUE DOESN'T HANDLE CONFLICTS**
**Location**: `@context/StoreContext.tsx:461-522`

**The Problem**:
- Sync queue processes items sequentially
- If an item fails, it retries up to 5 times then DELETES it (`line 490`)
- No conflict resolution - just "try again or delete"
- No notification to user that their change was lost

**Code Evidence**:
```typescript
// Lines 486-492
if (retryCount >= MAX_RETRIES) {
  console.error(`❌ Job ${jobKey} (${job.type}) exceeded max retries. Moving to next item.`);
  // Optionally: Move to a dead-letter queue or delete
  // For now, delete to prevent queue blockage
  await db.delete('syncQueue', jobKey);
  delete retryCountsRef[jobKey];
  continue;
}
```

**Why This Causes Hell**:
- Your price change fails to sync (network issue, schema mismatch, etc.)
- After 5 retries, it's SILENTLY DELETED from the queue
- You think your change saved, but it's gone forever
- Next time you reload, cloud overwrites with old price

---

### 5. **CLOUD LOADS BEFORE LOCAL CHANGES SYNC**
**Location**: `@context/StoreContext.tsx:104-454`

**The Problem**:
- On app startup, `loadData()` runs
- It loads from cloud FIRST (`line 144-305`)
- Then loads from local as fallback (`line 308-319`)
- But it doesn't check if local has PENDING sync queue items

**Why This Causes Hell**:
- You make a price change at 2:00 PM
- App crashes or you close browser before sync completes
- You reopen app at 2:05 PM
- Cloud loads old price and overwrites your local change
- Your pending sync queue item tries to sync, but local state already has old price

---

### 6. **NO OPTIMISTIC LOCKING OR VERSION CONTROL**
**Location**: Entire system

**The Problem**:
- No version numbers on products
- No conflict detection mechanism
- No "last modified by" tracking
- No way to know if someone else changed the price while you were editing

**Why This Causes Hell**:
- User A opens product edit at 2:00 PM (price = 1000)
- User B changes price to 1500 at 2:01 PM
- User A saves their edit at 2:02 PM (still thinks price = 1000)
- User A's change overwrites User B's change
- User B's price change is LOST

---

### 7. **ADMIN FORM DOESN'T REFRESH PRODUCT DATA**
**Location**: `@components/pages/Admin.tsx:64-66`

**The Problem**:
- When you click "Edit" on a product, it loads current product data into form
- But if another user/device changes the product while form is open, you don't see it
- You're editing STALE data

**Code Evidence**:
```typescript
// Line 64
const handleEditProduct = (product: Product) => {
  setEditingProduct(product);
  setProductFormData(product); // ⚠️ Snapshot of product at this moment
  setIsProductFormOpen(true);
};
```

**Why This Causes Hell**:
- You open edit form with price = 1000
- Another device changes price to 1500 and syncs to cloud
- You save your form (still shows 1000)
- Your save overwrites the 1500 back to 1000

---

### 8. **RECEIVE STOCK CAN CHANGE PRICES SILENTLY**
**Location**: `@context/StoreContext.tsx:992-1009`

**The Problem**:
- `receiveStock` function accepts optional `newCost` parameter
- If you receive stock with a new cost, it updates `costPrice`
- But there's no audit trail showing the price changed
- No notification to other users

**Code Evidence**:
```typescript
// Lines 996-1001
const updatedProduct = {
  ...product,
  stock: product.stock + quantity,
  costPrice: newCost !== undefined ? newCost : product.costPrice, // ⚠️ Silent price change
  updatedAt: new Date().toISOString()
};
```

**Why This Causes Hell**:
- Someone receives stock and accidentally changes cost price
- No one notices because it's buried in a stock receipt
- Profit margins suddenly look wrong
- You can't trace when/why the price changed

---

## 🔥 RACE CONDITIONS & TIMING ISSUES

### Race Condition #1: Sync Loop vs User Edits
- **Sync loop runs every 5 seconds** (`line 516`)
- User edits product → saves to local → queues for sync
- Before sync completes, sync loop loads cloud data
- Cloud data overwrites local edit

### Race Condition #2: Multiple Tabs/Devices
- Device A changes price to 1500
- Device B changes price to 2000
- Both queue for sync
- Whichever syncs last wins
- No conflict detection or merge

### Race Condition #3: Page Refresh During Sync
- User changes price
- Queued for sync but not yet sent
- User refreshes page
- `loadData()` loads cloud (old price)
- Local change lost because state reset

---

## 💣 DATA CONSISTENCY ISSUES

### Issue #1: Product Prices vs Sale Prices
- Products have `costPrice` and `sellingPrice`
- Sales have `priceAtSale` and `costAtSale`
- When you change product price, old sales keep old prices
- Reports compare NEW product prices with OLD sale prices → wrong calculations

### Issue #2: Sync Queue Can Grow Forever
- Failed sync items retry 5 times then delete
- But if network is down for hours, queue grows massive
- When network returns, thousands of items try to sync
- Can cause browser to hang or crash

### Issue #3: No Transaction Guarantees
- Product updates are separate from sync queue adds
- If app crashes between `db.put('products')` and `addToSyncQueue()`, change is lost
- No atomic operations

---

## 🎯 CRITICAL FIXES NEEDED

### Priority 1: Add Optimistic Locking
```typescript
interface Product {
  version: number; // Add version field
  lastModifiedBy: string; // Track who changed it
  lastModifiedAt: string; // When it was changed
}
```

### Priority 2: Conflict Detection
- Before saving, check if cloud version is newer
- If conflict detected, show user a merge dialog
- Let user choose: keep local, keep cloud, or merge

### Priority 3: Sync Queue Persistence
- Don't delete failed items after 5 retries
- Move to "failed" queue for manual review
- Show admin panel with failed sync items

### Priority 4: Real-time Sync Notifications
- Use Supabase real-time subscriptions
- When another device changes a product, notify all devices
- Show "Product changed by User X" banner

### Priority 5: Form Data Refresh
- When editing a product, subscribe to changes
- If product changes while form is open, show warning
- "This product was modified by User X. Refresh to see changes?"

### Priority 6: Audit Trail for Price Changes
- Log every price change with old/new values
- Show in audit logs: "Changed price from 1000 to 1500"
- Make price history visible in product details

### Priority 7: Transaction Safety
- Use IndexedDB transactions for all multi-step operations
- Ensure product update + sync queue add are atomic
- Rollback on failure

---

## 📊 SUMMARY OF HELL

Your price changes are reverting because:

1. **Cloud sync overwrites local changes** (last-write-wins with timestamps)
2. **Sync happens every 5 seconds** and can overwrite unsaved changes
3. **Page refresh loads cloud first**, losing pending local changes
4. **No conflict detection** - last save wins, others lost silently
5. **Failed syncs are deleted** after 5 retries with no notification
6. **Multiple devices/tabs** can overwrite each other
7. **Admin form uses stale data** - doesn't refresh if product changes
8. **No version control** - can't detect if someone else edited

This creates a perfect storm where:
- You change a price
- It saves locally
- Before it syncs, something loads cloud data
- Your change is overwritten
- You refresh and see old price
- You think "WTF, I just changed that!"

The system is fundamentally built for **single-user, single-device** usage. Multi-user/multi-device requires proper conflict resolution, optimistic locking, and real-time sync.
