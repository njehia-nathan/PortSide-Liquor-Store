# EDGE CASES & ADDITIONAL BUGS

## 🐛 EDGE CASES THAT BREAK THE SYSTEM

### Edge Case #1: Rapid Price Changes
**Scenario**: User changes price multiple times quickly (1000 → 1500 → 2000 → 1800)

**What Happens**:
- Each change creates a sync queue item
- All 4 items queue up
- They sync in order, but timestamps might be identical (same second)
- Last-write-wins logic fails when timestamps are equal
- Final price is unpredictable

**Location**: `@context/StoreContext.tsx:168-180`

---

### Edge Case #2: Offline Price Changes
**Scenario**: Device goes offline, user changes 10 product prices, device comes back online

**What Happens**:
- All 10 changes queue for sync
- Sync loop processes them one by one (every 5 seconds)
- Takes 50 seconds to sync all changes
- During this time, if user refreshes page, cloud loads old prices
- Some changes sync, some don't
- Partial state corruption

**Location**: `@context/StoreContext.tsx:466-522`

---

### Edge Case #3: Browser Crash During Edit
**Scenario**: User opens product edit form, changes price, browser crashes before save

**What Happens**:
- Form state is lost (React state, not persisted)
- No autosave mechanism
- User has to re-enter all changes
- If they don't remember exact values, data is lost

**Location**: `@components/pages/Admin.tsx:356-373`

---

### Edge Case #4: Simultaneous Edits Same Product
**Scenario**: Two users edit the same product at the exact same time

**What Happens**:
1. User A opens edit form (price = 1000)
2. User B opens edit form (price = 1000)
3. User A changes to 1500, saves
4. User B changes to 2000, saves
5. Both create sync queue items with different timestamps
6. Whichever syncs last wins
7. One user's change is silently lost

**No Locking Mechanism**: No way to prevent this

---

### Edge Case #5: Price Change During Active Sale
**Scenario**: Cashier is in middle of creating a sale, admin changes product price

**What Happens**:
- Cashier added product to cart with old price
- Admin changes price in inventory
- Cashier completes sale
- Sale records OLD price (from when item was added to cart)
- But product now has NEW price
- Reports show inconsistency

**Location**: `@components/pages/POS.tsx:159-170`

**Code Evidence**:
```typescript
// POS.tsx:168-169
priceAtSale: c.sellingPrice,  // ⚠️ Uses price at moment of adding to cart
costAtSale: c.costPrice
```

---

### Edge Case #6: Negative Stock After Price Change
**Scenario**: Product has negative stock (bug), user changes price

**What Happens**:
- `updateProduct` doesn't validate stock levels
- Price change saves with negative stock
- System continues with corrupted data
- Stock reconciliation might fix it, but price history is lost

**Location**: `@context/StoreContext.tsx:957-965`

---

### Edge Case #7: Extremely Large Price Values
**Scenario**: User accidentally enters 10000000 (10 million) as price

**What Happens**:
- No validation on price input
- Saves to database
- Reports show absurd profit margins
- Currency formatter might break with huge numbers
- Can corrupt financial reports

**Location**: `@components/pages/Admin.tsx:367-368`

**Code Evidence**:
```typescript
// No validation, just parseFloat
value={productFormData.costPrice} 
onChange={e => setProductFormData({...productFormData, costPrice: parseFloat(e.target.value) || 0})}
```

---

### Edge Case #8: Price Change While Void Request Pending
**Scenario**: Sale is made, void request submitted, then admin changes product price

**What Happens**:
- Void request has sale with OLD prices
- Product now has NEW prices
- When void is approved, stock is restored
- But which price should be used for profit calculations?
- Audit trail shows inconsistent data

**Location**: `@context/StoreContext.tsx:1037-1112`

---

### Edge Case #9: Sync Queue Grows During Network Outage
**Scenario**: Network is down for 2 hours, 500 transactions happen

**What Happens**:
- 500+ items queue up in IndexedDB
- When network returns, sync loop tries to process all
- Browser becomes unresponsive
- User might force-close browser
- Sync queue corrupted, some items lost

**Location**: `@context/StoreContext.tsx:466-522`

---

### Edge Case #10: Timestamp Precision Issues
**Scenario**: Two devices in different timezones change same product

**What Happens**:
- Device A (UTC+3) changes price at 14:00:00.123
- Device B (UTC+0) changes price at 11:00:00.456
- Both convert to ISO strings
- Timestamp comparison might fail due to timezone handling
- Wrong version wins

**Location**: `@context/StoreContext.tsx:168-180`

---

## 🚨 ADDITIONAL CRITICAL BUGS

### Bug #1: No Input Sanitization
**Location**: `@components/pages/Admin.tsx:367-368`

**Issue**: Price inputs accept any value
- Can enter negative prices
- Can enter text (becomes 0)
- Can enter scientific notation (1e10)
- Can paste malicious strings

**Fix Needed**: Add validation
```typescript
const validatePrice = (value: string): number => {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0 || num > 10000000) {
    throw new Error('Invalid price');
  }
  return num;
};
```

---

### Bug #2: Missing Error Boundaries
**Location**: All components

**Issue**: If price update throws error, entire app crashes
- No error boundary to catch it
- User sees blank screen
- Has to refresh and lose all unsaved work

**Fix Needed**: Add React Error Boundaries

---

### Bug #3: No Debouncing on Price Input
**Location**: `@components/pages/Admin.tsx:367-368`

**Issue**: Every keystroke triggers state update
- Type "1500" → 4 state updates (1, 15, 150, 1500)
- Can cause performance issues
- Can trigger unnecessary re-renders

**Fix Needed**: Debounce input changes

---

### Bug #4: Sync Queue Has No Size Limit
**Location**: `@context/StoreContext.tsx:466-522`

**Issue**: Sync queue can grow infinitely
- If sync fails repeatedly, queue grows forever
- Can fill up IndexedDB storage quota
- Browser might crash or refuse to store more

**Fix Needed**: Add queue size limit and overflow handling

---

### Bug #5: No Backup Before Destructive Operations
**Location**: `@context/StoreContext.tsx:957-965`

**Issue**: When updating product, no backup is created
- If update corrupts data, no way to restore
- No undo mechanism
- Data loss is permanent

**Fix Needed**: Create backup before updates

---

### Bug #6: Race Condition in processSale
**Location**: `@context/StoreContext.tsx:720-834`

**Issue**: Sale processing checks stock, then updates it
- Between check and update, another sale might happen
- Both sales pass stock check
- Stock goes negative
- Overselling occurs

**Code Evidence**:
```typescript
// Lines 724-734: Check stock
for (const item of items) {
  if (product.stock < item.quantity) {
    throw new Error('Insufficient stock');
  }
}

// Lines 756-808: Update stock (NOT atomic with check)
```

**Fix Needed**: Use database transactions with locks

---

### Bug #7: Memory Leak in Sync Loop
**Location**: `@context/StoreContext.tsx:461-522`

**Issue**: `retryCountsRef` object grows forever
- Keys are added but never cleaned up properly
- After days of running, object has thousands of entries
- Memory usage grows continuously

**Code Evidence**:
```typescript
// Line 463: This object never gets fully cleared
const retryCountsRef: Record<number, number> = {};
```

**Fix Needed**: Periodic cleanup of old entries

---

### Bug #8: No Validation on updatedAt
**Location**: `@context/StoreContext.tsx:148-185`

**Issue**: `updatedAt` can be any string
- No validation that it's a valid ISO date
- Can be set to future date
- Can be set to past date (1970)
- Breaks timestamp comparison logic

**Fix Needed**: Validate timestamp format and range

---

### Bug #9: Product Form Doesn't Lock During Save
**Location**: `@components/pages/Admin.tsx:66`

**Issue**: User can click "Save" multiple times rapidly
- Creates multiple sync queue items
- Can cause duplicate updates
- Last one wins, but creates confusion

**Fix Needed**: Disable save button during save operation

---

### Bug #10: No Conflict Resolution UI
**Location**: Entire system

**Issue**: When conflicts occur, they're resolved silently
- User never knows their change was overwritten
- No notification, no warning, no error
- Silent data loss

**Fix Needed**: Show conflict resolution dialog

---

## 🔍 COMPARISON WITH SOLD ITEMS

### Issue: "Comparing what was sold before"

**What You're Experiencing**:
When you change a product price, the system might be comparing:
- Current product price (NEW)
- vs. Price at which items were sold (OLD)

**Where This Happens**:

1. **Reports Page** (`@components/pages/Reports.tsx:301-314`)
   - When updating a sale, it updates `priceAtSale` and `costAtSale`
   - But if product price changed, there's a mismatch
   - Reports calculate profit using sale prices, not current prices

2. **Product Sale Logs** (`@context/StoreContext.tsx:782-806`)
   - Each sale creates a log with `priceAtSale` and `costAtSale`
   - These are snapshots at time of sale
   - If you change product price, logs still have old prices
   - Analytics compare old sale prices with new product prices

3. **Fix Corrupted Sales** (`@context/StoreContext.tsx:1244-1473`)
   - This function tries to fix sales with zero prices
   - It uses CURRENT product prices to fix OLD sales
   - This corrupts historical data
   - Profit margins become inaccurate

**The Root Problem**:
- Sales should be immutable (prices frozen at time of sale)
- Product prices should be current (can change anytime)
- But the system mixes these two concepts
- When you change a product price, it doesn't update past sales
- But reports compare current prices with past sale prices
- This makes everything look wrong

---

## 🎯 SPECIFIC SCENARIOS CAUSING HELL

### Scenario A: "I changed the price but it reverted"
1. You open Admin panel
2. Edit product, change price from 1000 to 1500
3. Click Save
4. Price updates in UI (React state)
5. Saves to IndexedDB
6. Queues for cloud sync
7. **BUT** before sync completes (5 second interval)
8. You refresh the page
9. `loadData()` runs, loads from cloud (still has 1000)
10. Your local change (1500) is overwritten
11. Sync queue item tries to sync, but state already has 1000
12. Result: Price is back to 1000

### Scenario B: "Price keeps changing back and forth"
1. Device A changes price to 1500 at 14:00:00
2. Device B changes price to 2000 at 14:00:01
3. Both queue for sync
4. Device A syncs first → cloud has 1500
5. Device B syncs second → cloud has 2000
6. Device A refreshes → loads 2000 from cloud
7. Device A user thinks "WTF, I set it to 1500!"
8. Device A changes back to 1500
9. Cycle repeats forever

### Scenario C: "Reports show wrong profit"
1. Product cost = 800, selling = 1000 (profit = 200)
2. You make 10 sales
3. You change cost to 900, selling to 1200
4. Old sales still have cost = 800, selling = 1000
5. Reports compare NEW product prices (900/1200) with OLD sale prices (800/1000)
6. Profit calculations are completely wrong
7. You think you're losing money when you're actually making profit

---

## 📋 COMPLETE LIST OF ISSUES

1. ✅ Cloud sync overwrites local changes (last-write-wins)
2. ✅ Sync loop runs every 5 seconds causing race conditions
3. ✅ Page refresh loads cloud first, losing pending changes
4. ✅ No conflict detection or resolution
5. ✅ Failed syncs deleted after 5 retries silently
6. ✅ Multiple devices/tabs overwrite each other
7. ✅ Admin form uses stale data
8. ✅ No version control or optimistic locking
9. ✅ No input validation on prices
10. ✅ No error boundaries
11. ✅ No debouncing on inputs
12. ✅ Sync queue has no size limit
13. ✅ No backup before destructive operations
14. ✅ Race condition in stock checking
15. ✅ Memory leak in sync loop
16. ✅ No validation on timestamps
17. ✅ Form doesn't lock during save
18. ✅ No conflict resolution UI
19. ✅ Product prices vs sale prices confusion
20. ✅ Fix corrupted sales corrupts historical data
21. ✅ Rapid price changes cause unpredictable results
22. ✅ Offline changes can partially sync
23. ✅ Browser crash loses unsaved changes
24. ✅ Simultaneous edits silently overwrite
25. ✅ Price changes during active sales cause inconsistency
26. ✅ Negative stock not validated
27. ✅ Extremely large prices not validated
28. ✅ Price changes during void requests cause confusion
29. ✅ Network outage causes queue overflow
30. ✅ Timezone issues in timestamp comparison

**Total Critical Issues**: 30+

This system is fundamentally broken for multi-user, multi-device scenarios with price changes.
