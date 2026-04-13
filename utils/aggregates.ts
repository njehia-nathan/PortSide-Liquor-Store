import { Sale, Shift } from '../types';

/**
 * One source of truth for every revenue / profit / cost / units number the
 * app displays. Rules enforced here so no page can disagree with another:
 *
 *   • Voided sales contribute zero to every figure. They are never dropped
 *     from counts, but their revenue/cost/profit is zeroed.
 *   • Prices come from the SALE line items (priceAtSale / costAtSale) — the
 *     historical values captured at checkout, never the current product
 *     price (which drifts when admin edits a product).
 *   • Split payments count once; we sum totalAmount on the sale, not across
 *     splitPayment.cashAmount + mobileAmount (those are already reflected).
 *
 * Any KPI rendered anywhere in the app must flow through these helpers.
 */

export interface SalesAggregate {
  revenue: number;
  cost: number;
  profit: number;
  margin: number; // %
  units: number; // total items sold across all non-voided sales
  count: number; // number of transactions (voided and non-voided)
  voidedCount: number;
}

export const EMPTY_AGGREGATE: SalesAggregate = {
  revenue: 0,
  cost: 0,
  profit: 0,
  margin: 0,
  units: 0,
  count: 0,
  voidedCount: 0,
};

// Per-sale revenue/cost/profit. Voided → 0. Uses item-level historical prices
// rather than the sale's cached totalAmount/totalCost so the math stays correct
// even if the cached totals were written before a bug or edit.
export const saleRevenue = (sale: Sale): number => {
  if (sale.isVoided) return 0;
  return sale.items.reduce((s, i) => s + (Number(i.priceAtSale) || 0) * (Number(i.quantity) || 0), 0);
};

export const saleCost = (sale: Sale): number => {
  if (sale.isVoided) return 0;
  return sale.items.reduce((s, i) => s + (Number(i.costAtSale) || 0) * (Number(i.quantity) || 0), 0);
};

export const saleProfit = (sale: Sale): number => saleRevenue(sale) - saleCost(sale);

export const saleUnits = (sale: Sale): number => {
  if (sale.isVoided) return 0;
  return sale.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
};

export const aggregateSales = (sales: Sale[]): SalesAggregate => {
  let revenue = 0, cost = 0, units = 0, voidedCount = 0;
  for (const sale of sales) {
    if (sale.isVoided) { voidedCount++; continue; }
    for (const item of sale.items) {
      const qty = Number(item.quantity) || 0;
      revenue += (Number(item.priceAtSale) || 0) * qty;
      cost += (Number(item.costAtSale) || 0) * qty;
      units += qty;
    }
  }
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, cost, profit, margin, units, count: sales.length, voidedCount };
};

// Per-product totals computed from sales — the correct way to get "how much
// has this product earned." Current product price drifts when admin re-prices
// stock, so Inventory.tsx must NOT compute revenue as `unitsSold * sellingPrice`.
export interface ProductAggregate { units: number; revenue: number; cost: number; profit: number; }

export const aggregateByProduct = (sales: Sale[]): Map<string, ProductAggregate> => {
  const map = new Map<string, ProductAggregate>();
  for (const sale of sales) {
    if (sale.isVoided) continue;
    for (const item of sale.items) {
      const qty = Number(item.quantity) || 0;
      const rev = (Number(item.priceAtSale) || 0) * qty;
      const cst = (Number(item.costAtSale) || 0) * qty;
      const existing = map.get(item.productId);
      if (existing) {
        existing.units += qty;
        existing.revenue += rev;
        existing.cost += cst;
        existing.profit += rev - cst;
      } else {
        map.set(item.productId, { units: qty, revenue: rev, cost: cst, profit: rev - cst });
      }
    }
  }
  return map;
};

// Convenience: units-sold map (productId → qty). Used where only units matter.
export const unitsSoldByProduct = (sales: Sale[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const sale of sales) {
    if (sale.isVoided) continue;
    for (const item of sale.items) {
      const qty = Number(item.quantity) || 0;
      map.set(item.productId, (map.get(item.productId) || 0) + qty);
    }
  }
  return map;
};

// Revenue split by payment method. Voided excluded. Also returns a breakdown
// of SPLIT sales into the cash and mobile components so the Split card can
// show the cash/mobile figures inline.
export interface PaymentBreakdown {
  CASH: number;
  CARD: number;
  MOBILE: number;
  SPLIT: number;
  splitCash: number;    // sum of splitPayment.cashAmount across SPLIT sales
  splitMobile: number;  // sum of splitPayment.mobileAmount across SPLIT sales
  splitCount: number;   // number of SPLIT transactions
}

export const revenueByPayment = (sales: Sale[]): PaymentBreakdown => {
  const b: PaymentBreakdown = { CASH: 0, CARD: 0, MOBILE: 0, SPLIT: 0, splitCash: 0, splitMobile: 0, splitCount: 0 };
  for (const sale of sales) {
    if (sale.isVoided) continue;
    const rev = saleRevenue(sale);
    if (sale.paymentMethod === 'SPLIT') {
      b.SPLIT += rev;
      b.splitCount++;
      if (sale.splitPayment) {
        b.splitCash += Number(sale.splitPayment.cashAmount) || 0;
        b.splitMobile += Number(sale.splitPayment.mobileAmount) || 0;
      }
    } else {
      b[sale.paymentMethod as 'CASH' | 'CARD' | 'MOBILE'] += rev;
    }
  }
  return b;
};

// ─── Shift attribution ─────────────────────────────────────────────────────
// A sale can be attributed to at most ONE shift. We match by cashier id and
// sale timestamp falling inside the shift's [startTime, endTime] window
// (endTime = now for an OPEN shift). When multiple shifts for the same cashier
// overlap the same instant (a data bug, not a real case), the most recently
// started shift wins — this prevents the double-counting that makes the sum
// of per-shift totals drift above the Reports total.
//
// Sales that don't match any shift are "orphans": they were rung up outside
// any shift window (shift force-closed, shift sync lost, or no shift open
// when the cashier hit the POS). Orphans are real revenue — they show on
// the Reports page — but they were invisible in the old AdminShiftReports
// sum. We return them alongside the shift map so callers can surface them.

export interface ShiftAttribution {
  /** sale.id → shift.id (if the sale is attributed to a shift) */
  saleToShift: Map<string, string>;
  /** shift.id → Sale[] (the sales this shift owns) */
  shiftSales: Map<string, Sale[]>;
  /** Sales with no owning shift — still count toward global revenue. */
  orphans: Sale[];
}

export const attributeSalesToShifts = (sales: Sale[], shifts: Shift[]): ShiftAttribution => {
  // Pre-index shifts by cashier, sorted by startTime descending so the most
  // recently started matching shift wins.
  const byCashier = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const arr = byCashier.get(shift.cashierId) ?? [];
    arr.push(shift);
    byCashier.set(shift.cashierId, arr);
  }
  for (const arr of byCashier.values()) {
    arr.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  const saleToShift = new Map<string, string>();
  const shiftSales = new Map<string, Sale[]>();
  const orphans: Sale[] = [];
  const now = Date.now();

  for (const sale of sales) {
    const saleTime = new Date(sale.timestamp).getTime();
    const candidates = byCashier.get(sale.cashierId) ?? [];
    let picked: Shift | undefined;
    for (const shift of candidates) {
      const start = new Date(shift.startTime).getTime();
      if (saleTime < start) continue;
      const end = shift.endTime ? new Date(shift.endTime).getTime() : now;
      if (saleTime <= end) { picked = shift; break; } // first match wins (newest due to sort)
    }
    if (picked) {
      saleToShift.set(sale.id, picked.id);
      const arr = shiftSales.get(picked.id) ?? [];
      arr.push(sale);
      shiftSales.set(picked.id, arr);
    } else {
      orphans.push(sale);
    }
  }

  return { saleToShift, shiftSales, orphans };
};

// Quick aggregate for a specific shift using the same canonical rules as
// every other page (historical prices, voided excluded).
export const shiftAggregate = (shift: Shift, attribution: ShiftAttribution): SalesAggregate => {
  const sales = attribution.shiftSales.get(shift.id) ?? [];
  return aggregateSales(sales);
};

// Buckets orphan sales by cashier + local calendar day so the admin can close
// each group into one retrospective shift. Each bucket carries the time window
// and running revenue totals needed to mint that shift.
export interface OrphanGroup {
  key: string;            // `${cashierId}|${yyyy-mm-dd}`
  cashierId: string;
  cashierName: string;
  date: string;           // yyyy-mm-dd in local time
  earliest: string;       // ISO — earliest sale timestamp in this group
  latest: string;         // ISO — latest sale timestamp in this group
  sales: Sale[];
  aggregate: SalesAggregate;
}

export const groupOrphansByCashierDay = (orphans: Sale[]): OrphanGroup[] => {
  const groups = new Map<string, { cashierId: string; cashierName: string; date: string; earliestMs: number; latestMs: number; sales: Sale[] }>();
  for (const sale of orphans) {
    const d = new Date(sale.timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;
    const key = `${sale.cashierId}|${date}`;
    const t = d.getTime();
    const existing = groups.get(key);
    if (existing) {
      existing.sales.push(sale);
      if (t < existing.earliestMs) existing.earliestMs = t;
      if (t > existing.latestMs) existing.latestMs = t;
    } else {
      groups.set(key, {
        cashierId: sale.cashierId,
        cashierName: sale.cashierName,
        date,
        earliestMs: t,
        latestMs: t,
        sales: [sale],
      });
    }
  }
  return Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      cashierId: g.cashierId,
      cashierName: g.cashierName,
      date: g.date,
      earliest: new Date(g.earliestMs).toISOString(),
      latest: new Date(g.latestMs).toISOString(),
      sales: g.sales,
      aggregate: aggregateSales(g.sales),
    }))
    // Newest day first; within a day, alphabetical cashier.
    .sort((a, b) => (b.date.localeCompare(a.date)) || a.cashierName.localeCompare(b.cashierName));
};
