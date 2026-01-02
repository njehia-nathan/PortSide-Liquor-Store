'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, AlcoholType } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import { ProductAnalytics } from '@/components/ProductAnalytics';
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
  TrendingUp,
  DollarSign,
  CheckCircle2,
  PlusCircle,
  Camera,
  Calendar,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const Inventory = () => {
  const { products, receiveStock, adjustStock, updateProduct, addProduct, requestStockChange, auditLogs, sales } = useStore();

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
  const [globalBarcodeBuffer, setGlobalBarcodeBuffer] = useState('');
  const lastKeyTime = useRef<number>(0);
  const [selectedProductForAnalytics, setSelectedProductForAnalytics] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<'name' | 'type' | 'stock' | 'unitsSold' | 'value'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Global barcode scanner listener - scan anytime without clicking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const now = Date.now();
      // If more than 100ms between keys, start fresh (barcode scanners are fast)
      if (now - lastKeyTime.current > 100) {
        setGlobalBarcodeBuffer('');
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter' && globalBarcodeBuffer.length > 0) {
        // Process the scanned barcode
        const product = products.find(p => p.barcode === globalBarcodeBuffer || p.sku === globalBarcodeBuffer);
        if (product) {
          setSelectedProductId(product.id);
          showSuccess(`✓ Found: ${product.name}`);
        } else {
          alert('Product not found for barcode: ' + globalBarcodeBuffer);
        }
        setGlobalBarcodeBuffer('');
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setGlobalBarcodeBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalBarcodeBuffer, products]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm));
    
    if (!matchesSearch) return false;
    
    // Date filtering - filter products that had activity in the date range
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date | null = null;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (customStartDate) startDate = new Date(customStartDate);
          break;
      }
      
      if (startDate) {
        const endDate = dateFilter === 'custom' && customEndDate ? new Date(customEndDate) : now;
        endDate.setHours(23, 59, 59, 999);
        
        // Check if product had any sales in this date range
        const hadActivity = sales.some(sale => {
          const saleDate = new Date(sale.timestamp);
          return !sale.isVoided && 
                 sale.items.some(item => item.productId === p.id) &&
                 saleDate >= startDate! && saleDate <= endDate;
        });
        
        if (!hadActivity) return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'stock':
        comparison = a.stock - b.stock;
        break;
      case 'unitsSold':
        comparison = (a.unitsSold || 0) - (b.unitsSold || 0);
        break;
      case 'value':
        comparison = (a.costPrice * a.stock) - (b.costPrice * b.stock);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const productOptions = sortedProducts.map(p => ({
    value: p.id,
    label: `${p.name} - ${p.size} (Stock: ${p.stock})`
  }));

  const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 5));
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0);

  // Debug: Log products to check unitsSold values
  useEffect(() => {
    if (products.length > 0) {
      console.log('📦 Products loaded:', products.length);
      console.log('📊 Sample product with unitsSold:', products.find(p => p.unitsSold && p.unitsSold > 0));
      console.log('📊 All products unitsSold:', products.map(p => ({ name: p.name, unitsSold: p.unitsSold })));
    }
  }, [products]);

  const handleBarcodeScanned = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (product) {
      setSelectedProductId(product.id);
      setBarcodeInput('');
      setShowBarcodeScanner(false);
      showSuccess(`✓ Found: ${product.name} (Stock: ${product.stock})`);
    } else {
      alert('Product not found for barcode: ' + barcode);
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
      requestStockChange(selectedProductId, 'RECEIVE', qty, 'Stock receipt', cost);
      showSuccess(`✓ Stock change request submitted for ${product?.name} - Awaiting approval`);
    } else if (activeTab === 'ADJUST') {
      if (!reason) return;
      requestStockChange(selectedProductId, 'ADJUST', qty, reason);
      showSuccess(`✓ Stock adjustment request submitted for ${product?.name} - Awaiting approval`);
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
            <div className="p-3 lg:p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2 justify-between">
                <input
                  type="text"
                  placeholder="Filter by name, SKU, or barcode..."
                  className="w-full lg:max-w-md px-3 lg:px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                 {/* Date Range Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <Calendar size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Period:</span>
                {(['all', 'today', 'week', 'month', 'year', 'custom'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateFilter(range)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      dateFilter === range ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : range === 'year' ? 'Year' : 'Custom'}
                  </button>
                ))}
                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                  </div>
                )}
              </div>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
                >
                  <PlusCircle size={16} /> Add Product
                </button>
              </div>
              
             
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  className="p-3 hover:bg-slate-50 cursor-pointer active:bg-slate-100"
                  onClick={() => setSelectedProductForAnalytics(p)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate">{p.name}</h4>
                      <p className="text-xs text-slate-500">{p.type} • {p.size}</p>
                    </div>
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${p.stock <= (p.lowStockThreshold || 5) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {p.stock} in stock
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-mono text-xs">#{filteredProducts.indexOf(p) + 1}</span>
                    <span className="font-bold text-slate-700">{CURRENCY_FORMATTER.format(p.costPrice * p.stock)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block max-h-[600px] overflow-y-auto overflow-x-auto border-t border-slate-200">
              <Table className="border-collapse">
                <TableHeader className="bg-blue-600 sticky top-0 z-10">
                  <TableRow className="border-b-2 border-black hover:bg-blue-600">
                    <TableHead className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase border-r border-black">#</TableHead>
                    <TableHead className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase border-r border-black">Barcode</TableHead>
                    <TableHead className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase border-r border-black cursor-pointer hover:bg-blue-700" onClick={() => handleSort('name')}>
                      Product {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase border-r border-black cursor-pointer hover:bg-blue-700" onClick={() => handleSort('type')}>
                      Type {sortField === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase border-r border-black">Size</TableHead>
                    <TableHead className="px-3 py-2 text-center text-[10px] font-bold text-white uppercase border-r border-black cursor-pointer hover:bg-blue-700" onClick={() => handleSort('stock')}>
                      Stock {sortField === 'stock' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="px-3 py-2 text-center text-[10px] font-bold text-white uppercase border-r border-black cursor-pointer hover:bg-blue-700" onClick={() => handleSort('unitsSold')}>
                      Units Sold {sortField === 'unitsSold' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="px-3 py-2 text-right text-[10px] font-bold text-white uppercase cursor-pointer hover:bg-blue-700" onClick={() => handleSort('value')}>
                      Value {sortField === 'value' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((p, index) => (
                      <TableRow 
                        key={p.id} 
                        className="hover:bg-blue-50 cursor-pointer border-b border-black"
                        onClick={() => setSelectedProductForAnalytics(p)}
                      >
                        <TableCell className="px-3 py-1.5 font-mono text-slate-500 text-xs border-r border-black">#{index + 1}</TableCell>
                        <TableCell className="px-3 py-1.5 font-mono text-xs text-slate-600 border-r border-black">{p.barcode || '-'}</TableCell>
                        <TableCell className="px-3 py-1.5 font-semibold text-slate-900 text-xs border-r border-black">{p.name}</TableCell>
                        <TableCell className="px-3 py-1.5 text-slate-700 text-xs border-r border-black">{p.type}</TableCell>
                        <TableCell className="px-3 py-1.5 text-slate-700 text-xs border-r border-black">{p.size}</TableCell>
                        <TableCell className="px-3 py-1.5 text-center border-r border-black">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${p.stock <= (p.lowStockThreshold || 5) ? 'bg-red-100 text-red-800 border border-red-800' : 'bg-green-100 text-green-800 border border-green-800'}`}>
                            {p.stock}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-center font-bold text-blue-700 text-xs border-r border-black">
                          {p.unitsSold !== undefined && p.unitsSold !== null ? p.unitsSold : 0}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-right font-bold text-slate-900 text-xs">{CURRENCY_FORMATTER.format(p.costPrice * p.stock)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {activeTab === 'ALERTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 lg:p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Filter by name..."
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
                  <div key={p.id} className="p-4 hover:bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-3">
                        <h4 className="font-bold text-slate-900 text-base">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{p.type} • {p.size}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${p.stock <= threshold ? 'text-red-600' : 'text-green-600'}`}>{p.stock}</span>
                        <p className="text-[10px] text-slate-400">in stock</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      {editingAlertId === p.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-16 border-2 border-amber-400 rounded-lg px-3 py-1.5 text-sm font-mono text-center" value={editAlertValue} onChange={e => setEditAlertValue(e.target.value)} autoFocus />
                          <button onClick={() => handleUpdateAlert(p)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"><Save size={18} /></button>
                          <button type="button" onClick={() => setEditingAlertId(null)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"><X size={18} /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEditAlert(p)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 hover:bg-slate-200 transition-colors">
                          Alert: {threshold} <Edit2 size={14} />
                        </button>
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
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Low Stock Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map((p, index) => {
                    const threshold = p.lowStockThreshold || 5;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono text-slate-500">#{index + 1}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                        <td className="px-6 py-4 text-slate-600">{p.type}</td>
                        <td className="px-6 py-4 text-slate-600">{p.size}</td>
                        <td className="px-6 py-4">{p.stock}</td>
                        <td className="px-6 py-4">
                          {editingAlertId === p.id ? (
                            <div className="flex items-center gap-2">
                              <input type="number" className="w-16 border rounded px-2 py-1" value={editAlertValue} onChange={e => setEditAlertValue(e.target.value)} autoFocus />
                              <button onClick={() => handleUpdateAlert(p)} className="text-green-600 hover:text-green-800"><Save size={18} /></button>
                              <button type="button" onClick={() => setEditingAlertId(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
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
                    <SearchableSelect
                      options={products.map(p => ({ value: p.id, label: `${p.name} (${p.size}) - Stock: ${p.stock}` }))}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                      placeholder="Search and select a product..."
                    />
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

                  {/* Barcode - Scan to find OR assign */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                      <Barcode size={12} /> Scan Barcode (Find or Assign)
                    </label>
                    <input
                      type="text"
                      placeholder="Scan barcode to find product or assign new..."
                      className="w-full p-2 border-2 border-green-400 rounded-lg bg-green-50 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none"
                      value={barcodeInput}
                      onChange={e => {
                        setBarcodeInput(e.target.value);
                        // Auto-find product as user types/scans
                        const scanned = e.target.value.trim();
                        if (scanned) {
                          const found = products.find(p => p.barcode === scanned);
                          if (found) {
                            setSelectedProductId(found.id);
                          }
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const scanned = barcodeInput.trim();
                          if (scanned) {
                            // First try to find product by barcode
                            const found = products.find(p => p.barcode === scanned);
                            if (found) {
                              setSelectedProductId(found.id);
                              showSuccess(`Found: ${found.name}`);
                              setBarcodeInput('');
                            } else if (selectedProductId) {
                              // If no match and product selected, offer to assign
                              const product = products.find(p => p.id === selectedProductId);
                              if (product) {
                                updateProduct({ ...product, barcode: scanned });
                                showSuccess(`Barcode assigned to ${product.name}`);
                                setBarcodeInput('');
                              }
                            } else {
                              alert('No product found with this barcode. Select a product first to assign.');
                            }
                          }
                        }
                      }}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Scan to auto-select product, or select product first then scan to assign barcode</p>
                  </div>

                  {/* Buttons */}
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
                    <SearchableSelect
                      options={products.map(p => ({ value: p.id, label: `${p.name} (${p.size}) - Stock: ${p.stock}` }))}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                      placeholder="Search and select a product..."
                    />
                  </div>

                  {/* Quantity Change with +/- buttons */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Change (+/-) *</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuantity(prev => String((parseInt(prev) || 0) - 1))}
                        className="w-12 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center text-2xl font-bold hover:bg-red-600 transition-colors shadow-sm"
                      >
                        −
                      </button>
                      <input type="number" className="flex-1 h-12 p-2 border-2 border-slate-300 rounded-xl text-lg font-mono text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} required />
                      <button
                        type="button"
                        onClick={() => setQuantity(prev => String((parseInt(prev) || 0) + 1))}
                        className="w-12 h-12 bg-green-500 text-white rounded-xl flex items-center justify-center text-2xl font-bold hover:bg-green-600 transition-colors shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Barcode Scanner - Hidden on mobile */}
                  <div className="hidden lg:block">
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
                  type="button"
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
                productData.brand = productData.name;
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
                  <label className="block text-sm font-medium mb-1">SKU</label>
                  <input
                    type="text"
                    placeholder="Optional"
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Scan or enter barcode"
                      className="flex-1 border p-2.5 rounded-lg text-sm font-mono"
                      value={newProduct.barcode || ''}
                      autoFocus
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          barcode: e.target.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.className = 'sr-only';
                        document.body.appendChild(input);
                        input.focus();
                        input.addEventListener('keydown', (e) => {
                          if (e.key === 'Enter') {
                            setNewProduct({ ...newProduct, barcode: input.value });
                            input.remove();
                          }
                        });
                        input.addEventListener('blur', () => {
                          if (input.value) {
                            setNewProduct({ ...newProduct, barcode: input.value });
                          }
                          input.remove();
                        });
                      }}
                      className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center gap-1 text-sm font-medium"
                    >
                      <Barcode size={16} /> Scan
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Just scan - no need to click</p>
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

      {/* Product Analytics Modal */}
      {selectedProductForAnalytics && (
        <ProductAnalytics
          product={selectedProductForAnalytics}
          auditLogs={auditLogs}
          sales={sales}
          onClose={() => setSelectedProductForAnalytics(null)}
        />
      )}
    </div>
  );
};

export default Inventory;