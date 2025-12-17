'use client';

import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { AlcoholType, Product } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import { AlertCircle, ArrowDown, ArrowUp, Plus, Save, BellRing, Edit2, X } from 'lucide-react';

const Inventory = () => {
  const { products, receiveStock, adjustStock, updateProduct } = useStore();
  const [activeTab, setActiveTab] = useState<'VIEW' | 'RECEIVE' | 'ADJUST' | 'ALERTS'>('VIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [newCost, setNewCost] = useState('');
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editAlertValue, setEditAlertValue] = useState<string>('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty === 0) return;

    if (activeTab === 'RECEIVE') {
      const cost = newCost ? parseFloat(newCost) : undefined;
      receiveStock(selectedProductId, qty, cost);
    } else if (activeTab === 'ADJUST') {
      if (!reason) return;
      adjustStock(selectedProductId, qty, reason);
    }

    setQuantity('');
    setReason('');
    setNewCost('');
    alert('Inventory updated successfully');
  };

  const handleUpdateAlert = (product: Product) => {
    const newVal = parseInt(editAlertValue);
    if (!isNaN(newVal) && newVal >= 0) {
      updateProduct({ ...product, lowStockThreshold: newVal });
    }
    setEditingAlertId(null);
  };

  const startEditAlert = (product: Product) => {
    setEditingAlertId(product.id);
    setEditAlertValue((product.lowStockThreshold || 5).toString());
  };

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => { setActiveTab(id); setSelectedProductId(''); }}
      className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-6 py-2.5 lg:py-3 border-b-2 font-medium transition-colors text-xs lg:text-sm whitespace-nowrap ${
        activeTab === id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon size={16} className="lg:w-[18px] lg:h-[18px]" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
  );

  return (
    <div className="p-3 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-4 lg:mb-6 flex justify-between items-center">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Inventory</h1>
      </div>

      <div className="flex border-b border-slate-200 mb-4 lg:mb-6 overflow-x-auto -mx-3 px-3 lg:mx-0 lg:px-0">
        <TabButton id="VIEW" label="Stock Levels" icon={AlertCircle} />
        <TabButton id="RECEIVE" label="Receive Stock" icon={ArrowDown} />
        <TabButton id="ADJUST" label="Adjustments" icon={ArrowUp} />
        <TabButton id="ALERTS" label="Stock Alerts" icon={BellRing} />
      </div>

      {(activeTab === 'VIEW' || activeTab === 'ALERTS') && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-3 lg:p-4 border-b border-slate-100 bg-slate-50">
            <input
              type="text"
              placeholder="Filter by name or SKU..."
              className="w-full lg:max-w-md px-3 lg:px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredProducts.map(p => {
              const threshold = p.lowStockThreshold || 5;
              const isLow = p.stock <= threshold;
              return (
                <div key={p.id} className="p-3 hover:bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate">{p.name}</h4>
                      <p className="text-xs text-slate-500">{p.type} • {p.size}</p>
                    </div>
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {p.stock} in stock
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-mono text-xs">{p.sku}</span>
                    {activeTab === 'VIEW' && (
                      <span className="font-bold text-slate-700">{CURRENCY_FORMATTER.format(p.costPrice * p.stock)}</span>
                    )}
                    {activeTab === 'ALERTS' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Alert at:</span>
                        {editingAlertId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input type="number" className="w-12 border rounded px-2 py-1 text-xs" value={editAlertValue} onChange={e => setEditAlertValue(e.target.value)} autoFocus />
                            <button onClick={() => handleUpdateAlert(p)} className="text-green-600 p-1"><Save size={16} /></button>
                            <button onClick={() => setEditingAlertId(null)} className="text-slate-400 p-1"><X size={16} /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEditAlert(p)} className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                            {threshold} <Edit2 size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Stock</th>
                  {activeTab === 'VIEW' && <th className="px-6 py-4">Value</th>}
                  {activeTab === 'ALERTS' && <th className="px-6 py-4">Low Stock Alert</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map(p => {
                  const threshold = p.lowStockThreshold || 5;
                  const isLow = p.stock <= threshold;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-slate-500">{p.sku}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                      <td className="px-6 py-4 text-slate-600">{p.type}</td>
                      <td className="px-6 py-4 text-slate-600">{p.size}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {p.stock}
                        </span>
                      </td>
                      {activeTab === 'VIEW' && <td className="px-6 py-4 font-bold text-slate-700">{CURRENCY_FORMATTER.format(p.costPrice * p.stock)}</td>}
                      {activeTab === 'ALERTS' && (
                        <td className="px-6 py-4">
                          {editingAlertId === p.id ? (
                            <div className="flex items-center gap-2">
                              <input type="number" className="w-16 border rounded px-2 py-1" value={editAlertValue} onChange={e => setEditAlertValue(e.target.value)} autoFocus />
                              <button onClick={() => handleUpdateAlert(p)} className="text-green-600 hover:text-green-800"><Save size={18} /></button>
                              <button onClick={() => setEditingAlertId(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group">
                              <span className="font-mono">{threshold}</span>
                              <button onClick={() => startEditAlert(p)} className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-opacity" title="Edit Threshold">
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === 'RECEIVE' || activeTab === 'ADJUST') && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-8">
          <h2 className="text-lg lg:text-xl font-bold mb-4 lg:mb-6">
            {activeTab === 'RECEIVE' ? 'Receive New Shipment' : 'Correct Stock Level'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Product</label>
              <select className="w-full p-2.5 lg:p-3 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} required>
                <option value="">-- Select Product --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.size}) - Curr: {p.stock}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{activeTab === 'RECEIVE' ? 'Quantity Received' : 'Quantity Change (+/-)'}</label>
              <input type="number" className="w-full p-2.5 lg:p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base" placeholder={activeTab === 'ADJUST' ? "e.g. -1 for breakage" : "12"} value={quantity} onChange={e => setQuantity(e.target.value)} required />
              {activeTab === 'ADJUST' && <p className="text-xs text-slate-500 mt-1">Use negative numbers to remove stock.</p>}
            </div>
            {activeTab === 'RECEIVE' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">New Unit Cost (Optional)</label>
                <input type="number" step="0.01" className="w-full p-2.5 lg:p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base" placeholder="Leave empty to keep current cost" value={newCost} onChange={e => setNewCost(e.target.value)} />
              </div>
            )}
            {activeTab === 'ADJUST' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
                <textarea className="w-full p-2.5 lg:p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base" placeholder="e.g. Bottle dropped in aisle 3" value={reason} onChange={e => setReason(e.target.value)} required rows={3} />
              </div>
            )}
            <button type="submit" className="w-full bg-slate-900 text-white py-3 lg:py-4 rounded-lg font-bold hover:bg-slate-800 flex items-center justify-center gap-2 text-sm lg:text-base">
              <Save size={18} /> Confirm Update
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Inventory;
