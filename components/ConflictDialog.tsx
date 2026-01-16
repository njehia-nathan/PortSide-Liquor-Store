import React, { useState } from 'react';
import { AlertTriangle, User, Clock, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { CURRENCY_FORMATTER } from '../constants';

interface ConflictDialogProps {
  localProduct: Product;
  cloudProduct: Product;
  onResolve: (resolvedProduct: Product) => void;
  onCancel: () => void;
}

/**
 * CONFLICT RESOLUTION DIALOG
 * Shows when a product has been modified by multiple users
 * Allows user to choose which version to keep or merge changes
 */
const ConflictDialog: React.FC<ConflictDialogProps> = ({
  localProduct,
  cloudProduct,
  onResolve,
  onCancel
}) => {
  const [selectedVersion, setSelectedVersion] = useState<'local' | 'cloud' | 'merge'>('local');

  const handleResolve = () => {
    if (selectedVersion === 'local') {
      onResolve(localProduct);
    } else if (selectedVersion === 'cloud') {
      onResolve(cloudProduct);
    } else {
      // Merge: Keep local prices but cloud stock
      const merged: Product = {
        ...localProduct,
        stock: cloudProduct.stock,
        version: Math.max(localProduct.version || 0, cloudProduct.version || 0) + 1
      };
      onResolve(merged);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const hasFieldConflict = (field: keyof Product) => {
    return localProduct[field] !== cloudProduct[field];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Conflict Detected</h2>
              <p className="text-white/90">This product was modified by multiple users</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Product Name */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">{localProduct.name}</h3>
            <p className="text-slate-600">Choose which version to keep or merge the changes</p>
          </div>

          {/* Version Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Local Version */}
            <div
              onClick={() => setSelectedVersion('local')}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                selectedVersion === 'local'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  checked={selectedVersion === 'local'}
                  onChange={() => setSelectedVersion('local')}
                  className="w-4 h-4"
                />
                <h4 className="font-bold text-slate-900">Your Version (Local)</h4>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User size={14} />
                  <span>{localProduct.lastModifiedByName || 'You'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={14} />
                  <span>{formatDate(localProduct.updatedAt)}</span>
                </div>
                <div className="mt-3 pt-3 border-t space-y-1">
                  <div className={hasFieldConflict('costPrice') ? 'font-semibold text-blue-600' : ''}>
                    Cost: {CURRENCY_FORMATTER.format(localProduct.costPrice)}
                  </div>
                  <div className={hasFieldConflict('sellingPrice') ? 'font-semibold text-blue-600' : ''}>
                    Selling: {CURRENCY_FORMATTER.format(localProduct.sellingPrice)}
                  </div>
                  <div className={hasFieldConflict('stock') ? 'font-semibold text-blue-600' : ''}>
                    Stock: {localProduct.stock}
                  </div>
                  <div className="text-xs text-slate-500">
                    Version: {localProduct.version || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Version */}
            <div
              onClick={() => setSelectedVersion('cloud')}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                selectedVersion === 'cloud'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  checked={selectedVersion === 'cloud'}
                  onChange={() => setSelectedVersion('cloud')}
                  className="w-4 h-4"
                />
                <h4 className="font-bold text-slate-900">Server Version (Cloud)</h4>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User size={14} />
                  <span>{cloudProduct.lastModifiedByName || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={14} />
                  <span>{formatDate(cloudProduct.updatedAt)}</span>
                </div>
                <div className="mt-3 pt-3 border-t space-y-1">
                  <div className={hasFieldConflict('costPrice') ? 'font-semibold text-orange-600' : ''}>
                    Cost: {CURRENCY_FORMATTER.format(cloudProduct.costPrice)}
                  </div>
                  <div className={hasFieldConflict('sellingPrice') ? 'font-semibold text-orange-600' : ''}>
                    Selling: {CURRENCY_FORMATTER.format(cloudProduct.sellingPrice)}
                  </div>
                  <div className={hasFieldConflict('stock') ? 'font-semibold text-orange-600' : ''}>
                    Stock: {cloudProduct.stock}
                  </div>
                  <div className="text-xs text-slate-500">
                    Version: {cloudProduct.version || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Merge Option */}
          <div
            onClick={() => setSelectedVersion('merge')}
            className={`border-2 rounded-xl p-4 cursor-pointer transition-all mb-6 ${
              selectedVersion === 'merge'
                ? 'border-purple-500 bg-purple-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <input
                type="radio"
                checked={selectedVersion === 'merge'}
                onChange={() => setSelectedVersion('merge')}
                className="w-4 h-4"
              />
              <h4 className="font-bold text-slate-900">Merge (Smart Combine)</h4>
            </div>
            <p className="text-sm text-slate-600">
              Keep your price changes but use the server's stock level
            </p>
            <div className="mt-3 pt-3 border-t text-sm space-y-1">
              <div>Cost: {CURRENCY_FORMATTER.format(localProduct.costPrice)} (from your version)</div>
              <div>Selling: {CURRENCY_FORMATTER.format(localProduct.sellingPrice)} (from your version)</div>
              <div>Stock: {cloudProduct.stock} (from server version)</div>
            </div>
          </div>

          {/* Conflict Details */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-yellow-900 mb-2">Conflicting Fields:</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              {hasFieldConflict('costPrice') && (
                <li>
                  • Cost Price: {CURRENCY_FORMATTER.format(localProduct.costPrice)} <ArrowRight size={12} className="inline" /> {CURRENCY_FORMATTER.format(cloudProduct.costPrice)}
                </li>
              )}
              {hasFieldConflict('sellingPrice') && (
                <li>
                  • Selling Price: {CURRENCY_FORMATTER.format(localProduct.sellingPrice)} <ArrowRight size={12} className="inline" /> {CURRENCY_FORMATTER.format(cloudProduct.sellingPrice)}
                </li>
              )}
              {hasFieldConflict('stock') && (
                <li>
                  • Stock: {localProduct.stock} <ArrowRight size={12} className="inline" /> {cloudProduct.stock}
                </li>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Apply {selectedVersion === 'local' ? 'Your' : selectedVersion === 'cloud' ? 'Server' : 'Merged'} Version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictDialog;
