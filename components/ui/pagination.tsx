'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  page: number;        // 1-indexed
  pageSize: number;    // Use Number.POSITIVE_INFINITY (or any value ≥ total) for "All"
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;  // "transactions", "products", etc.
  className?: string;
}

// Sentinel value used for the "All" option. We pass this through instead of a
// raw integer so the consumer can persist the admin's choice even if the total
// row count changes between renders.
const ALL_SENTINEL = Number.POSITIVE_INFINITY;

// Produces a compact page list like: [1, '…', 4, 5, 6, '…', 42]
const buildPageList = (current: number, totalPages: number): Array<number | '…'> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | '…'> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);
  if (left > 2) pages.push('…');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
};

export const Pagination: React.FC<PaginationProps> = ({
  total,
  page,
  pageSize,
  pageSizeOptions = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'rows',
  className = '',
}) => {
  // Only offer sizes that fit the dataset — no point showing "5000 per page"
  // when there are 120 rows. Keep at least one option so the dropdown never
  // renders empty.
  const visibleSizes = useMemo(() => {
    const fit = pageSizeOptions.filter(s => s < total);
    if (fit.length === 0) fit.push(pageSizeOptions[0] ?? 50);
    return fit;
  }, [pageSizeOptions, total]);
  const isAll = !isFinite(pageSize) || pageSize >= total;
  const effectiveSize = isAll ? Math.max(1, total) : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / effectiveSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const firstShown = total === 0 ? 0 : (clampedPage - 1) * effectiveSize + 1;
  const lastShown = Math.min(total, clampedPage * effectiveSize);
  const pages = useMemo(() => buildPageList(clampedPage, totalPages), [clampedPage, totalPages]);

  const go = (p: number) => onPageChange(Math.min(Math.max(1, p), totalPages));

  const btn =
    'h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md text-sm font-medium ' +
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  const activeBtn =
    'h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md text-sm font-semibold ' +
    'bg-slate-900 text-white border border-slate-900';

  return (
    <div
      className={
        'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ' +
        'px-4 py-3 bg-white border-t border-slate-200 ' +
        className
      }
    >
      {/* Left: counter + page size */}
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>
          {total === 0 ? (
            <>No {itemLabel}</>
          ) : (
            <>
              Showing <span className="font-semibold text-slate-900">{firstShown.toLocaleString()}</span>
              {' – '}
              <span className="font-semibold text-slate-900">{lastShown.toLocaleString()}</span>
              {' of '}
              <span className="font-semibold text-slate-900">{total.toLocaleString()}</span>
              {' '}{itemLabel}
            </>
          )}
        </span>
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Rows:</span>
          <select
            value={isAll ? 'all' : String(pageSize)}
            onChange={(e) => onPageSizeChange(e.target.value === 'all' ? ALL_SENTINEL : Number(e.target.value))}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {visibleSizes.map(opt => (
              <option key={opt} value={opt}>{opt.toLocaleString()}</option>
            ))}
            {total > 0 && (
              <option value="all">All ({total.toLocaleString()})</option>
            )}
          </select>
        </label>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1 flex-wrap">
        <button className={btn} onClick={() => go(1)} disabled={clampedPage === 1} aria-label="First page">
          <ChevronsLeft size={16} />
        </button>
        <button className={btn} onClick={() => go(clampedPage - 1)} disabled={clampedPage === 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-2 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              className={p === clampedPage ? activeBtn : btn}
              onClick={() => go(p)}
              aria-current={p === clampedPage ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button className={btn} onClick={() => go(clampedPage + 1)} disabled={clampedPage >= totalPages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
        <button className={btn} onClick={() => go(totalPages)} disabled={clampedPage >= totalPages} aria-label="Last page">
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
