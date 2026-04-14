// Forensic dump of all client-side state (IndexedDB + localStorage + env)
// into the Supabase client_state_snapshots table. Used before a device
// reload so the backlog can be analysed offline (via MCP SQL) to pinpoint
// why specific rows weren't pushing.

import { dbPromise } from '../db';
import { supabase } from '../cloud';

const DEVICE_ID_KEY = 'pos:device_id';

// Stable-per-device id. Cached in localStorage on first call.
export const getOrCreateDeviceId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (crypto as any)?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

const STORES = [
  'users', 'products', 'sales', 'shifts', 'auditLogs',
  'voidRequests', 'stockChangeRequests', 'productSaleLogs',
  'syncQueue', 'failedSyncQueue', 'businessSettings',
] as const;

// These stores can grow to hundreds of thousands of records. Loading them
// entirely into RAM causes the same OOM crash we're trying to diagnose.
// We capture a small sample + the real count instead.
const LARGE_STORES = new Set<string>(['syncQueue', 'failedSyncQueue']);
const LARGE_STORE_SAMPLE = 100;

interface IndexedDbSnapshot {
  data: Record<string, any[]>;
  /** Accurate row count for each store (not skewed by sampling). */
  counts: Record<string, number>;
}

const readAllIndexedDb = async (): Promise<IndexedDbSnapshot> => {
  const db = await dbPromise();
  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  for (const s of STORES) {
    try {
      if (LARGE_STORES.has(s)) {
        // Count first (cheap cursor-free IDB call), then fetch a small sample.
        const totalCount = await db.count(s as any);
        counts[s] = totalCount;
        const sample = (await db.getAll(s as any, undefined, LARGE_STORE_SAMPLE)) as any[];
        data[s] = totalCount > LARGE_STORE_SAMPLE
          ? [{ _sampled: true, totalCount, keptFirst: LARGE_STORE_SAMPLE }, ...sample]
          : sample;
      } else {
        const items = (await db.getAll(s as any)) as any[];
        data[s] = items;
        counts[s] = items.length;
      }
    } catch (err) {
      data[s] = [{ _error: String(err) }];
      counts[s] = 0;
    }
  }

  return { data, counts };
};

const readAllLocalStorage = (): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return out;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    try {
      out[key] = localStorage.getItem(key) ?? '';
    } catch (err) {
      out[key] = `<read error: ${String(err)}>`;
    }
  }
  return out;
};

const captureEnvironment = () => {
  if (typeof window === 'undefined') return { ssr: true };
  return {
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    pathname: window.location.pathname,
    href: window.location.href,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: { w: window.screen?.width ?? 0, h: window.screen?.height ?? 0 },
    language: navigator.language,
    now: new Date().toISOString(),
  };
};

export interface DumpResult {
  id: string;
  bytes: number;
  truncations: string[];
  syncQueueCount: number;
  failedSyncQueueCount: number;
}

export interface DumpOptions {
  note?: string;
  userName?: string | null;
}

// Size guardrails: if the initial insert returns a body-too-large error,
// progressively shrink the heaviest stores.
const TRUNCATION_STEPS: Array<{ store: string; keep: number }> = [
  { store: 'auditLogs', keep: 50 },
  { store: 'productSaleLogs', keep: 200 },
  { store: 'sales', keep: 200 },
];

const tryTruncate = (
  indexedDb: Record<string, any[]>,
  step: { store: string; keep: number }
): { truncation: string } | null => {
  const arr = indexedDb[step.store];
  if (!Array.isArray(arr) || arr.length <= step.keep) return null;
  const mostRecent = [...arr]
    .sort((a, b) => {
      const at = new Date(a?.timestamp ?? a?.requestedAt ?? 0).getTime();
      const bt = new Date(b?.timestamp ?? b?.requestedAt ?? 0).getTime();
      return bt - at;
    })
    .slice(0, step.keep);
  const original = arr.length;
  indexedDb[step.store] = [
    { _truncated: true, originalCount: original, keptMostRecent: mostRecent.length },
    ...mostRecent,
  ];
  return { truncation: `${step.store}: kept most recent ${step.keep} of ${original}` };
};

const isPayloadTooLargeError = (err: any): boolean => {
  const msg = String(err?.message ?? err ?? '');
  const code = String(err?.code ?? err?.status ?? '');
  return (
    code === '413' ||
    /payload too large/i.test(msg) ||
    /request entity too large/i.test(msg) ||
    /exceeds.*size/i.test(msg) ||
    /body.*too.*large/i.test(msg)
  );
};

export const dumpLocalState = async (opts: DumpOptions = {}): Promise<DumpResult> => {
  const { data: indexedDb, counts } = await readAllIndexedDb();
  const localStorageSnap = readAllLocalStorage();
  const environment = captureEnvironment();

  const truncations: string[] = [];
  const payload: Record<string, any> = {
    capturedAt: new Date().toISOString(),
    environment,
    localStorage: localStorageSnap,
    indexedDb,
    truncations,
  };

  const id = (crypto as any)?.randomUUID?.() || `snap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const deviceId = getOrCreateDeviceId();

  // Use accurate counts from db.count(), not the (possibly sampled) array length.
  const syncQueueCount = counts['syncQueue'] ?? 0;
  const failedSyncQueueCount = counts['failedSyncQueue'] ?? 0;

  const attempt = async (): Promise<{ bytes: number }> => {
    const serialized = JSON.stringify(payload);
    const bytes = serialized.length;
    const { error } = await supabase.from('client_state_snapshots').insert({
      id,
      deviceId,
      userName: opts.userName ?? null,
      syncQueueCount,
      failedSyncQueueCount,
      pathname: (environment as any).pathname ?? null,
      userAgent: (environment as any).userAgent ?? null,
      note: opts.note ?? null,
      payload,
    });
    if (error) throw error;
    return { bytes };
  };

  let lastErr: any;
  for (let attemptIdx = 0; attemptIdx <= TRUNCATION_STEPS.length; attemptIdx++) {
    try {
      const { bytes } = await attempt();
      return {
        id,
        bytes,
        truncations: [...truncations],
        syncQueueCount,
        failedSyncQueueCount,
      };
    } catch (err) {
      lastErr = err;
      if (!isPayloadTooLargeError(err)) break;
      const step = TRUNCATION_STEPS[attemptIdx];
      if (!step) break;
      const result = tryTruncate(indexedDb, step);
      if (result) truncations.push(result.truncation);
    }
  }

  throw lastErr ?? new Error('dumpLocalState failed');
};
