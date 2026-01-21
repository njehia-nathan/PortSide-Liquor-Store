'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight, DollarSign, Package, TrendingUp } from 'lucide-react';
import { Sale, Product } from '../types';
import { CURRENCY_FORMATTER } from '../constants';

export interface SaleReconciliation {
  originalSale: Sale;
  fixedSale: Sale;
  priceChanges: Array<{
    productName: string;
    size: string;
    oldPrice: number;
    newPrice: number;
    oldCost: number;
    newCost: number;
    quantity: number;
  }>;
}

export interface ProductReconciliation {
  product: Product;
  oldUnitsSold: number;
  newUnitsSold: number;
  oldStock?: number;
  newStock?: number;
  oldCostPrice?: number;
  newCostPrice?: number;
}

interface ReconciliationDialogProps {
  salesChanges: SaleReconciliation[];
  productChanges: ProductReconciliation[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ReconciliationDialog: React.FC<ReconciliationDialogProps> = ({
  salesChanges,
  productChanges,
  onConfirm,
  onCancel
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'products'>('sales');

  const totalSalesFixed = salesChanges.length;
  const totalProductsUpdated = productChanges.length;
  const totalPriceChanges = salesChanges.reduce((sum, change) => sum + change.priceChanges.length, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Data Reconciliation Required</h2>
              <p className="text-white/90 text-sm mt-1">
                Review the changes before applying fixes to your sales and inventory data
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-blue-500" />
                <span className="text-xs text-slate-600 font-medium">Sales to Fix</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{totalSalesFixed}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <Package size={16} className="text-purple-500" />
                <span className="text-xs text-slate-600 font-medium">Products Updated</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{totalProductsUpdated}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-500" />
                <span className="text-xs text-slate-600 font-medium">Price Corrections</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{totalPriceChanges}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sales'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Sales Changes ({totalSalesFixed})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'products'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Product Updates ({totalProductsUpdated})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sales' && (
            <div className="space-y-4">
              {salesChanges.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No sales need fixing</p>
                </div>
              ) : (
                salesChanges.map((change, idx) => (
                  <div key={change.originalSale.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          Sale #{change.originalSale.id.slice(-8)}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {new Date(change.originalSale.timestamp).toLocaleString('en-GB')}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded">
                        {change.priceChanges.length} item{change.priceChanges.length !== 1 ? 's' : ''} fixed
                      </span>
                    </div>

                    {/* Price Changes */}
                    <div className="space-y-2">
                      {change.priceChanges.map((priceChange, pidx) => (
                        <div key={pidx} className="bg-slate-50 rounded p-3 border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-900 text-sm">
                              {priceChange.productName} ({priceChange.size})
                            </span>
                            <span className="text-xs text-slate-500">Qty: {priceChange.quantity}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-slate-500 mb-1">Selling Price</p>
                              <div className="flex items-center gap-2">
                                <span className="text-red-600 line-through">
                                  {CURRENCY_FORMATTER.format(priceChange.oldPrice)}
                                </span>
                                <ArrowRight size={12} className="text-slate-400" />
                                <span className="text-green-600 font-bold">
                                  {CURRENCY_FORMATTER.format(priceChange.newPrice)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-1">Cost Price</p>
                              <div className="flex items-center gap-2">
                                <span className="text-red-600 line-through">
                                  {CURRENCY_FORMATTER.format(priceChange.oldCost)}
                                </span>
                                <ArrowRight size={12} className="text-slate-400" />
                                <span className="text-green-600 font-bold">
                                  {CURRENCY_FORMATTER.format(priceChange.newCost)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm">
                      <div>
                        <span className="text-slate-500">Old Total: </span>
                        <span className="text-red-600 line-through font-bold">
                          {CURRENCY_FORMATTER.format(change.originalSale.totalAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">New Total: </span>
                        <span className="text-green-600 font-bold">
                          {CURRENCY_FORMATTER.format(change.fixedSale.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-3">
              {productChanges.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No products need updating</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b-2 border-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-700">Product</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-slate-700">Units Sold</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-slate-700">Stock</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-slate-700">Cost Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {productChanges.map((change) => (
                        <tr key={change.product.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div>
                              <p className="font-medium text-slate-900">{change.product.name}</p>
                              <p className="text-xs text-slate-500">{change.product.size}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {change.oldUnitsSold !== change.newUnitsSold ? (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-red-600 line-through">{change.oldUnitsSold}</span>
                                <ArrowRight size={12} className="text-slate-400" />
                                <span className="text-green-600 font-bold">{change.newUnitsSold}</span>
                              </div>
                            ) : (
                              <span className="text-slate-600">{change.oldUnitsSold}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {change.oldStock !== undefined && change.newStock !== undefined && change.oldStock !== change.newStock ? (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-red-600 line-through">{change.oldStock}</span>
                                <ArrowRight size={12} className="text-slate-400" />
                                <span className="text-green-600 font-bold">{change.newStock}</span>
                              </div>
                            ) : (
                              <span className="text-slate-600">{change.product.stock}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {change.oldCostPrice !== undefined && change.newCostPrice !== undefined && change.oldCostPrice !== change.newCostPrice ? (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-red-600 line-through text-xs">
                                  {CURRENCY_FORMATTER.format(change.oldCostPrice)}
                                </span>
                                <ArrowRight size={12} className="text-slate-400" />
                                <span className="text-green-600 font-bold text-xs">
                                  {CURRENCY_FORMATTER.format(change.newCostPrice)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">
                                {CURRENCY_FORMATTER.format(change.product.costPrice)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            <p className="font-medium">⚠️ This action cannot be undone</p>
            <p className="text-xs">Old sales data will be replaced with corrected values</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-bold hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg"
            >
              Apply Fixes ({totalSalesFixed + totalProductsUpdated} changes)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
