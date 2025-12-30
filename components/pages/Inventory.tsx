'use client';

import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, AlcoholType } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Save,
  BellRing,
  Edit2,
  X,
  Search,
  Barcode,
  Package,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  PlusCircle,
  Camera,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Inventory = () => {
  const { products, receiveStock, adjustStock, updateProduct, addProduct } = useStore();

  const [activeTab, setActiveTab] = useState<'VIEW' | 'RECEIVE' | 'ADJUST' | 'ALERTS'>('VIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [newCost, setNewCost] = useState('');
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editAlertValue, setEditAlertValue] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', type: AlcoholType.WHISKEY, size: '', brand: '', sku: '', barcode: '',
    costPrice: 0, sellingPrice: 0, stock: 0, lowStockThreshold: 5
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 5));
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0);

  const handleBarcodeScanned = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (product) {
      setSelectedProductId(product.id);
      setBarcodeInput('');
      setShowBarcodeScanner(false);
    } else {
      alert('Product not found for this barcode');
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty === 0) return;

    const product = products.find(p => p.id === selectedProductId);
    if (activeTab === 'RECEIVE') {
      const cost = newCost ? parseFloat(newCost) : undefined;
      receiveStock(selectedProductId, qty, cost);
      showSuccess(`✓ Received ${qty} units of ${product?.name}`);
    } else if (activeTab === 'ADJUST') {
      if (!reason) return;
      adjustStock(selectedProductId, qty, reason);
      showSuccess(`✓ Adjusted ${product?.name} by ${qty > 0 ? '+' : ''}${qty}`);
    }

    setQuantity('');
    setReason('');
    setNewCost('');
    setSelectedProductId('');
  };

  const startEditAlert = (product: Product) => {
    setEditingAlertId(product.id);
    setEditAlertValue((product.lowStockThreshold || 5).toString());
  };

  const handleUpdateAlert = (product: Product) => {
    const val = parseInt(editAlertValue);
    if (!isNaN(val) && val >= 0) {
      updateProduct({ ...product, lowStockThreshold: val });
    }
    setEditingAlertId(null);
  };

  return (
    <div className="p-3 lg:p-6 max-w-7xl mx-auto">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <CheckCircle2 size={20} />
          {successMessage}
        </div>
      )}

      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Package size={20} className="text-white" />
              </div>
              Inventory
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage stock levels, receive shipments, and track alerts</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Products</p>
                <p className="text-xl font-bold text-slate-800">{products.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDown size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Units</p>
                <p className="text-xl font-bold text-slate-800">{totalItems.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Inventory Value</p>
                <p className="text-lg font-bold text-slate-800">{CURRENCY_FORMATTER.format(totalInventoryValue)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lowStockProducts.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <TrendingDown size={20} className={lowStockProducts.length > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Low Stock Items</p>
                <p className={`text-xl font-bold ${lowStockProducts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{lowStockProducts.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {[
            { id: 'VIEW', label: 'Stock Levels', icon: AlertCircle },
            { id: 'RECEIVE', label: 'Receive Stock', icon: ArrowDown },
            { id: 'ADJUST', label: 'Adjustments', icon: ArrowUp },
            { id: 'ALERTS', label: 'Stock Alerts', icon: BellRing },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as typeof activeTab); setSelectedProductId(''); }}
              className={`flex items-center gap-2 px-4 lg:px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'VIEW' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 lg:p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2 justify-between">
              <input
                type="text"
                placeholder="Filter by name, SKU, or barcode..."
                className="w-full lg:max-w-md px-3 lg:px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
              >
                <PlusCircle size={16} /> Add Product
              </button>
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
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {p.stock} in stock
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono text-xs">{p.sku}</span>
                      <span className="font-bold text-slate-700">{CURRENCY_FORMATTER.format(p.costPrice * p.stock)}</span>
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
                    <th className="px-6 py-4">Barcode</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-slate-500">{p.sku}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.barcode || '-'}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                      <td className="px-6 py-4 text-slate-600">{p.type}</td>
                      <td className="px-6 py-4 text-slate-600">{p.size}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.stock <= (p.lowStockThreshold || 5) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">{CURRENCY_FORMATTER.format(p.costPrice * p.stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'ALERTS' && (
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

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredProducts.map(p => {
                const threshold = p.lowStockThreshold || 5;
                return (
                  <div key={p.id} className="p-3 hover:bg-slate-50 flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-slate-900">{p.name}</h4>
                      <p className="text-xs text-slate-500">{p.type} • {p.size}</p>
                    </div>
                    <div>
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
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Low Stock Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map(p => {
                    const threshold = p.lowStockThreshold || 5;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono text-slate-500">{p.sku}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                        <td className="px-6 py-4 text-slate-600">{p.type}</td>
                        <td className="px-6 py-4 text-slate-600">{p.size}</td>
                        <td className="px-6 py-4">{p.stock}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'RECEIVE' && (
          <div className="p-3 lg:p-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <ArrowDown size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Receive Stock</h2>
                  <p className="text-xs text-slate-500">Add incoming shipment to inventory</p>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Product Selection */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Product *</label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="-- Select Product --" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.size}) - Stock: {p.stock}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Quantity *</label>
                    <input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-green-500 outline-none" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} required min="1" />
                  </div>

                  {/* New Cost */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">New Cost</label>
                    <input type="number" step="0.01" className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Optional" value={newCost} onChange={e => setNewCost(e.target.value)} />
                  </div>

                  {/* Barcode - Assigns to product */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                      <Barcode size={12} /> Assign Barcode
                    </label>
                    <input
                      type="text"
                      placeholder="Scan barcode to assign to selected product..."
                      className="w-full p-2 border-2 border-amber-300 rounded-lg bg-amber-50 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (barcodeInput.trim() && selectedProductId) {
                            const product = products.find(p => p.id === selectedProductId);
                            if (product) {
                              updateProduct({ ...product, barcode: barcodeInput.trim() });
                              showSuccess(`Barcode assigned to ${product.name}`);
                              setBarcodeInput('');
                            }
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Assign Button */}
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="button"
                      disabled={!barcodeInput.trim() || !selectedProductId}
                      onClick={() => {
                        if (barcodeInput.trim() && selectedProductId) {
                          const product = products.find(p => p.id === selectedProductId);
                          if (product) {
                            updateProduct({ ...product, barcode: barcodeInput.trim() });
                            showSuccess(`Barcode assigned to ${product.name}`);
                            setBarcodeInput('');
                          }
                        }
                      }}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Barcode size={14} /> Assign Barcode
                    </button>
                    <button type="submit" disabled={!selectedProductId || !quantity} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <ArrowDown size={14} /> Receive Stock
                    </button>
                  </div>
                </div>

                {/* Selected Product Info */}
                {selectedProductId && (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-500">Product:</span> <span className="font-bold">{products.find(p => p.id === selectedProductId)?.name}</span></div>
                    <div><span className="text-slate-500">Current Stock:</span> <span className="font-bold">{products.find(p => p.id === selectedProductId)?.stock}</span></div>
                    <div><span className="text-slate-500">Barcode:</span> <span className="font-mono font-bold">{products.find(p => p.id === selectedProductId)?.barcode || 'None'}</span></div>
                    {quantity && <div><span className="text-slate-500">New Stock:</span> <span className="font-bold text-green-600">{(products.find(p => p.id === selectedProductId)?.stock || 0) + parseInt(quantity || '0')}</span></div>}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {activeTab === 'ADJUST' && (
          <div className="p-3 lg:p-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <ArrowUp size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Stock Adjustment</h2>
                  <p className="text-xs text-slate-500">Correct inventory for breakage, theft, or errors</p>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Product Selection */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Product *</label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="-- Select Product --" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.size}) - Stock: {p.stock}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity Change */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Change (+/-) *</label>
                    <input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-orange-500 outline-none" placeholder="-1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
                  </div>

                  {/* Barcode Scanner */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Scan</label>
                    <button type="button" onClick={() => setShowBarcodeScanner(true)} className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center gap-1 text-sm font-medium">
                      <Barcode size={14} /> Scan
                    </button>
                  </div>

                  {/* Reason */}
                  <div className="col-span-2 lg:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reason *</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Breakage, Theft, Count correction..." value={reason} onChange={e => setReason(e.target.value)} required />
                  </div>

                  {/* Submit Button */}
                  <div className="col-span-2 lg:col-span-4">
                    <button type="submit" disabled={!selectedProductId || !quantity || !reason} className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <Save size={14} /> Apply Adjustment
                    </button>
                  </div>
                </div>

                {/* Selected Product Info */}
                {selectedProductId && (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-500">Product:</span> <span className="font-bold">{products.find(p => p.id === selectedProductId)?.name}</span></div>
                    <div><span className="text-slate-500">Current Stock:</span> <span className="font-bold">{products.find(p => p.id === selectedProductId)?.stock}</span></div>
                    <div><span className="text-slate-500">Barcode:</span> <span className="font-mono font-bold">{products.find(p => p.id === selectedProductId)?.barcode || 'None'}</span></div>
                    {quantity && <div><span className="text-slate-500">New Stock:</span> <span className={`font-bold ${parseInt(quantity) < 0 ? 'text-red-600' : 'text-green-600'}`}>{(products.find(p => p.id === selectedProductId)?.stock || 0) + parseInt(quantity || '0')}</span></div>}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Barcode Scanner Modal */}
        {showBarcodeScanner && (
          <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Barcode size={20} className="text-amber-500" /> Scan Barcode</h3>
              <p className="text-sm text-slate-500 mb-4">Use a barcode scanner or manually enter the barcode/SKU to select a product.</p>
              <input
                type="text"
                autoFocus
                placeholder="Scan barcode here..."
                className="w-full border-2 border-amber-400 p-4 rounded-lg text-lg font-mono text-center focus:ring-2 focus:ring-amber-500 outline-none"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && barcodeInput.trim()) {
                    handleBarcodeScanned(barcodeInput.trim());
                  }
                }}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    if (barcodeInput.trim()) {
                      handleBarcodeScanned(barcodeInput.trim());
                    }
                  }}
                  disabled={!barcodeInput.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold"
                >
                  Find Product
                </button>
                <button
                  onClick={() => { setBarcodeInput(''); setShowBarcodeScanner(false); }}
                  className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddProductModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
            <div className="bg-white rounded-t-2xl lg:rounded-xl shadow-2xl p-4 lg:p-6 w-full lg:max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg lg:text-xl font-bold mb-4 lg:mb-6 flex items-center gap-2">
                <PlusCircle size={20} className="text-amber-500" /> Add New Product
              </h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const { id, ...productData } = newProduct as Product;
                addProduct(productData);
                showSuccess(`✓ Product "${newProduct.name}" added successfully`);
                setShowAddProductModal(false);
                setNewProduct({
                  name: '',
                  type: AlcoholType.WHISKEY,
                  size: '',
                  brand: '',
                  sku: '',
                  barcode: '',
                  costPrice: 0,
                  sellingPrice: 0,
                  stock: 0,
                  lowStockThreshold: 5
                });
              }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Product Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.type}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        type: e.target.value as AlcoholType,
                      })
                    }
                  >
                    {Object.values(AlcoholType).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Size *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 750ml"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.size}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, size: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SKU *</label>
                  <input
                    required
                    type="text"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.sku}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, sku: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Barcode size={14} /> Barcode
                  </label>
                  <input
                    type="text"
                    placeholder="Scan or enter barcode"
                    className="w-full border p-2.5 rounded-lg text-sm font-mono"
                    value={newProduct.barcode || ''}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        barcode: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Brand *</label>
                  <input
                    required
                    type="text"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.brand}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, brand: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-600">
                    Low Stock Alert
                  </label>
                  <input
                    required
                    type="number"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.lowStockThreshold}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        lowStockThreshold: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cost Price *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.costPrice}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        costPrice: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Selling Price *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.sellingPrice}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        sellingPrice: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Initial Stock</label>
                  <input
                    type="number"
                    className="w-full border p-2.5 rounded-lg text-sm"
                    value={newProduct.stock}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        stock: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2 flex gap-3 mt-4 lg:mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={16} /> Add Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;