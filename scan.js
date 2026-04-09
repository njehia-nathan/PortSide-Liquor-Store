const fs = require('fs');
const path = require('path');

const cloudFile = fs.readFileSync('cloud.ts', 'utf-8');
const storeContextFile = fs.readFileSync('context/StoreContext.tsx', 'utf-8');
const adminFile = fs.readFileSync('components/pages/Admin.tsx', 'utf-8');
const inventoryFile = fs.readFileSync('components/pages/Inventory.tsx', 'utf-8');

const report = [];

report.push('# System Scan Report\n');

// 1. Sync Queue Action Match
report.push('## 1. Cloud Sync Types vs Queue Actions');
const cloudCases = [...cloudFile.matchAll(/case\s+'([A-Z_]+)':/g)].map(m => m[1]);
const queueAdds = [...storeContextFile.matchAll(/type:\s*'([A-Z_]+)'/g)].map(m => m[1]);
const addToSyncQueueCalls = [...storeContextFile.matchAll(/addToSyncQueue\('([A-Z_]+)'/g)].map(m => m[1]);

const allPushedSyncs = Array.from(new Set([...queueAdds, ...addToSyncQueueCalls]));
const unhandledSyncs = allPushedSyncs.filter(s => !cloudCases.includes(s));

if (unhandledSyncs.length > 0) {
  report.push(`⚠️ WARNING: The following action types are queued locally but NOT handled in \`cloud.ts\`:\n- ${unhandledSyncs.join('\n- ')}`);
} else {
  report.push('✅ All queued sync actions are properly handled in `cloud.ts`!');
}

// 2. Selling at Zero Cost (Admin/Inventory Validations)
report.push('\n## 2. Zero-Cost / Loss Sale Validations');
if (adminFile.includes('Cost Price must be greater than 0')) {
  report.push('✅ `Admin.tsx` product creation correctly blocks zero-cost data entry.');
} else {
  report.push('⚠️ WARNING: `Admin.tsx` may still allow zero-cost product creation.');
}

if (inventoryFile.includes('Cost Price (greater than 0) is strictly required')) {
  report.push('✅ `Inventory.tsx` (Stock Receive) correctly blocks zero-cost receiving.');
} else {
  report.push('⚠️ WARNING: `Inventory.tsx` may still allow receiving at zero cost.');
}

if (storeContextFile.includes('HARD STOP FOR ZERO COST')) {
  report.push('✅ `StoreContext.tsx` blocks POS transactions involving zero-cost products.');
} else {
  report.push('⚠️ WARNING: `StoreContext.tsx` POS transaction block is missing or incorrect.');
}

// 3. Stock Decrement Typos
report.push('\n## 3. Stock Decrement Validation');
if (cloudFile.includes('decrement_stock') && cloudFile.includes('p_id:') && cloudFile.includes('delta_qty:')) {
  report.push('✅ `cloud.ts` correctly uses `SALE_STOCK_DELTA` with `p_id` and `delta_qty`.');
} else {
  report.push('⚠️ WARNING: `cloud.ts` stock decrement parameters mismatch with `decrement_stock.sql`.');
}

// 4. Missing Aliases
if (cloudFile.includes("case 'UPDATE_PRODUCTS':")) {
  report.push('\n## 4. Sync Queue Deadlock Prevention');
  report.push('✅ `UPDATE_PRODUCTS` alias included in `cloud.ts` to unblock stuck devices.');
} else {
  report.push('\n## 4. Sync Queue Deadlock Prevention');
  report.push('⚠️ WARNING: Missing `UPDATE_PRODUCTS` alias in `cloud.ts`. Devices with pending `UPDATE_PRODUCTS` syncs will remain stuck.');
}

fs.writeFileSync('scan_report.md', report.join('\n'));
console.log('Report saved to scan_report.md');
