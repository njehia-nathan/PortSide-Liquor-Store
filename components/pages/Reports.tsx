'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { CURRENCY_FORMATTER } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Banknote, CreditCard, Smartphone, Download, Calendar, FilterX, X, Edit2, Save, AlertCircle, CheckCircle, XCircle, Trash2, Ban } from 'lucide-react';
import { Sale, SaleItem } from '../../types';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const Reports = () => {
  const { sales, products, updateSale, deleteSale, currentUser, requestVoid, voidRequests, users } = useStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [editingItems, setEditingItems] = useState<SaleItem[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [selectingForItemIndex, setSelectingForItemIndex] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [showDeletePasswordDialog, setShowDeletePasswordDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmAction(() => onConfirm);
    setShowConfirmDialog(true);
  };

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Date range filter
      const saleDate = new Date(sale.timestamp);
      let startCondition = true;
      let endCondition = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        startCondition = saleDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        endCondition = saleDate <= end;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = sale.id.toLowerCase().includes(query);
        const matchesCashier = sale.cashierName.toLowerCase().includes(query);
        const matchesItems = sale.items.some(item =>
          item.productName.toLowerCase().includes(query)
        );
        if (!matchesId && !matchesCashier && !matchesItems) return false;
      }

      // User filter
      if (filterUser !== 'all' && sale.cashierId !== filterUser) return false;

      // Payment method filter
      if (filterPayment !== 'all' && sale.paymentMethod !== filterPayment) return false;

      // Status filter
      if (filterStatus === 'valid' && sale.isVoided) return false;
      if (filterStatus === 'voided' && !sale.isVoided) return false;

      return startCondition && endCondition;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, startDate, endDate, searchQuery, filterUser, filterPayment, filterStatus]);

  const totalRevenue = filteredSales.filter(s => !s.isVoided).reduce((acc, sale) => acc + sale.totalAmount, 0);
  const totalCost = filteredSales.filter(s => !s.isVoided).reduce((acc, sale) => acc + sale.totalCost, 0);
  const grossProfit = totalRevenue - totalCost;

  const productTypeMap = new Map<string, string>();
  products.forEach(p => productTypeMap.set(p.id, p.type));

  const categoryRevenueMap = new Map<string, number>();
  filteredSales.filter(s => !s.isVoided).forEach(sale => {
    sale.items.forEach(item => {
      const type = productTypeMap.get(item.productId) || 'Unknown';
      const itemRevenue = item.priceAtSale * item.quantity;
      const current = categoryRevenueMap.get(type) || 0;
      categoryRevenueMap.set(type, current + itemRevenue);
    });
  });

  const categoryData = Array.from(categoryRevenueMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const productPerformance = new Map<string, number>();
  filteredSales.filter(s => !s.isVoided).forEach(sale => {
    sale.items.forEach(item => {
      const key = item.productName;
      const current = productPerformance.get(key) || 0;
      productPerformance.set(key, current + item.quantity);
    });
  });

  const topProductsData = Array.from(productPerformance.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, sales: 0 }));
  filteredSales.filter(s => !s.isVoided).forEach(sale => {
    const hour = new Date(sale.timestamp).getHours();
    hourlyData[hour].sales += sale.totalAmount;
  });

  const paymentTotals = filteredSales.filter(s => !s.isVoided).reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.totalAmount;
    return acc;
  }, { CASH: 0, CARD: 0, MOBILE: 0 } as Record<string, number>);

  const downloadExcel = () => {
    if (filteredSales.length === 0) { alert("No data to export."); return; }
    const headers = ['Transaction ID', 'Date', 'Time', 'Cashier', 'Payment Method', 'Items', 'Total Amount (KES)', 'Total Cost (KES)', 'Gross Profit (KES)', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredSales.map(sale => {
        const date = new Date(sale.timestamp);
        const itemsStr = sale.items.map(i => `${i.quantity}x ${i.productName} (${i.size})`).join('; ');
        const profit = sale.totalAmount - sale.totalCost;
        const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
        return [escape(sale.id), escape(date.toLocaleDateString()), escape(date.toLocaleTimeString()), escape(sale.cashierName), escape(sale.paymentMethod), escape(itemsStr), sale.totalAmount, sale.totalCost, profit, escape(sale.isVoided ? 'VOIDED' : 'VALID')].join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Sales_Report_${startDate || 'ALL'}_to_${endDate || 'ALL'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewSaleDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setEditingItems(JSON.parse(JSON.stringify(sale.items)));
    setIsEditMode(false);
    setShowSaleDetailsModal(true);
  };

  const handleEnterEditMode = () => {
    if (!selectedSale) return;

    // Auto-load current product prices for items with 0 prices
    const itemsWithPrices = selectedSale.items.map(item => {
      const hasZeroPrice = item.priceAtSale === 0 || item.costAtSale === 0;

      if (hasZeroPrice) {
        // Try to find by ID first
        let currentProduct = products.find(p => p.id === item.productId);

        // If not found by ID, try to find by name (case-insensitive, partial match)
        if (!currentProduct) {
          const searchName = item.productName.toLowerCase();
          currentProduct = products.find(p =>
            p.name.toLowerCase().includes(searchName) ||
            searchName.includes(p.name.toLowerCase())
          );
        }

        // If still not found, try by size match
        if (!currentProduct) {
          currentProduct = products.find(p => p.size === item.size);
        }

        if (currentProduct) {
          return {
            ...item,
            priceAtSale: item.priceAtSale === 0 ? currentProduct.sellingPrice : item.priceAtSale,
            costAtSale: item.costAtSale === 0 ? currentProduct.costPrice : item.costAtSale
          };
        }
      }

      return item;
    });

    setEditingItems(itemsWithPrices);
    setIsEditMode(true);
  };

  const handleSelectProduct = (itemIndex: number) => {
    setSelectingForItemIndex(itemIndex);
    setProductSearchQuery('');
    setShowProductSelector(true);
  };

  const handleProductSelected = (product: any) => {
    if (selectingForItemIndex === null) return;

    setEditingItems(prev => prev.map((item, i) =>
      i === selectingForItemIndex ? {
        ...item,
        productId: product.id,
        productName: product.name,
        size: product.size,
        priceAtSale: product.sellingPrice,
        costAtSale: product.costPrice
      } : item
    ));

    setShowProductSelector(false);
    setSelectingForItemIndex(null);
  };

  const filteredProductsForSelector = useMemo(() => {
    if (!productSearchQuery) return products;
    const query = productSearchQuery.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query)
    );
  }, [products, productSearchQuery]);

  const handleUpdateItemPrice = (index: number, field: 'priceAtSale' | 'costAtSale', value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: numValue } : item
    ));
  };

  const handleSaveSaleUpdates = async () => {
    if (!selectedSale) return;

    // Validate all items have valid prices
    const hasInvalidPrices = editingItems.some(item =>
      item.priceAtSale < 0 || item.costAtSale < 0 ||
      isNaN(item.priceAtSale) || isNaN(item.costAtSale)
    );

    if (hasInvalidPrices) {
      showToast('Error: All prices must be valid positive numbers.', 'error');
      return;
    }

    // Check if any items still have 0 prices
    const stillHasZeros = editingItems.some(item =>
      item.priceAtSale === 0 || item.costAtSale === 0
    );

    if (stillHasZeros) {
      showConfirm(
        'Some items still have 0 prices. Are you sure you want to save?',
        () => performSaveUpdates()
      );
      return;
    }

    await performSaveUpdates();
  };

  const performSaveUpdates = async () => {
    if (!selectedSale) return;

    // Calculate totals with proper rounding
    const updatedTotalAmount = editingItems.reduce((sum, item) => {
      return sum + (Math.round(item.priceAtSale * item.quantity * 100) / 100);
    }, 0);

    const updatedTotalCost = editingItems.reduce((sum, item) => {
      return sum + (Math.round(item.costAtSale * item.quantity * 100) / 100);
    }, 0);

    const updatedSale: Sale = {
      ...selectedSale,
      items: editingItems,
      totalAmount: Math.round(updatedTotalAmount * 100) / 100,
      totalCost: Math.round(updatedTotalCost * 100) / 100
    };

    try {
      // Use the updateSale function from StoreContext
      // This will update React state, IndexedDB, and queue for Supabase sync
      await updateSale(updatedSale);

      // Also update product sale logs if they exist
      const { dbPromise, addToSyncQueue } = await import('../../db');
      const db = await dbPromise();
      const tx = db.transaction(['productSaleLogs'], 'readwrite');
      const allLogs = await tx.objectStore('productSaleLogs').getAll();

      for (const item of editingItems) {
        const existingLog = allLogs.find(log =>
          log.saleId === selectedSale.id && log.productId === item.productId
        );

        if (existingLog) {
          const updatedLog = {
            ...existingLog,
            priceAtSale: item.priceAtSale,
            costAtSale: item.costAtSale
          };
          await db.put('productSaleLogs', updatedLog);
          await addToSyncQueue('UPDATE_PRODUCT_SALE_LOG', updatedLog);
        }
      }

      showToast('Sale updated successfully!', 'success');

      // Close modal and exit edit mode after successful update
      setTimeout(() => {
        setShowSaleDetailsModal(false);
        setSelectedSale(null);
        setIsEditMode(false);
      }, 1500);
    } catch (error) {
      showToast('Failed to update sale: ' + error, 'error');
    }
  };

  const hasZeroPrices = (sale: Sale) => {
    return sale.items.some(item => item.priceAtSale === 0 || item.costAtSale === 0);
  };

  const handleDeleteSale = () => {
    if (!selectedSale) return;
    setSaleToDelete(selectedSale.id);
    setShowDeletePasswordDialog(true);
  };

  const confirmDeleteSale = async () => {
    if (!saleToDelete || !currentUser) return;

    // Verify password
    if (deletePassword !== currentUser.pin) {
      showToast('Incorrect password. Access denied.', 'error');
      setDeletePassword('');
      return;
    }

    try {
      await deleteSale(saleToDelete);
      showToast('Sale deleted successfully! Stock has been restored.', 'success');

      // Close all modals
      setShowDeletePasswordDialog(false);
      setShowSaleDetailsModal(false);
      setSelectedSale(null);
      setSaleToDelete(null);
      setDeletePassword('');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete sale', 'error');
      setDeletePassword('');
    }
  };

  return (
    <div className="p-3 lg:p-6 max-w-7xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Sales Reports</h1>
          <p className="text-slate-500 text-sm lg:text-base">Analyze your sales performance and trends</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-2 flex-1">
            <Calendar size={16} className="text-slate-400 shrink-0" />
            <input type="date" className="text-sm border-none outline-none text-slate-600 bg-transparent min-w-0 flex-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="text-slate-400">-</span>
            <input type="date" className="text-sm border-none outline-none text-slate-600 bg-transparent min-w-0 flex-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {(startDate || endDate) && (<button onClick={() => { setStartDate(''); setEndDate(''); }} className="p-1 text-slate-400 hover:text-red-500 shrink-0"><FilterX size={16} /></button>)}
          </div>
          <button onClick={downloadExcel} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
            <Download size={16} /><span className="hidden sm:inline">Download</span> Excel
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search by ID, cashier, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Cashiers</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="MOBILE">M-Pesa</option>
            <option value="SPLIT">Split</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="valid">Valid Only</option>
            <option value="voided">Voided Only</option>
          </select>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterUser('all');
              setFilterPayment('all');
              setFilterStatus('all');
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <FilterX size={16} /> Clear Filters
          </button>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p>No sales data available for the selected date range.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 lg:gap-6">
            {/* Revenue, Profit, Sales cards */}
            <div className="bg-white p-3 lg:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase">Revenue</h3>
              <p className="text-lg lg:text-3xl font-bold text-slate-900 mt-1 lg:mt-2">{CURRENCY_FORMATTER.format(totalRevenue)}</p>
            </div>
            <div className="bg-white p-3 lg:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase">Profit</h3>
              <p className="text-lg lg:text-3xl font-bold text-green-600 mt-1 lg:mt-2">{CURRENCY_FORMATTER.format(grossProfit)}</p>
            </div>
            <div className="bg-white p-3 lg:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase">Sales</h3>
              <p className="text-lg lg:text-3xl font-bold text-slate-900 mt-1 lg:mt-2">{filteredSales.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:gap-6">
            <div className="bg-white p-3 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
              <div className="p-2 lg:p-3 bg-green-100 text-green-600 rounded-full"><Banknote size={18} className="lg:w-6 lg:h-6" /></div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] lg:text-sm text-slate-500 font-medium">Cash</p>
                <p className="text-sm lg:text-xl font-bold text-slate-800">{CURRENCY_FORMATTER.format(paymentTotals.CASH)}</p>
              </div>
            </div>
            <div className="bg-white p-3 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
              <div className="p-2 lg:p-3 bg-blue-100 text-blue-600 rounded-full"><CreditCard size={18} className="lg:w-6 lg:h-6" /></div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] lg:text-sm text-slate-500 font-medium">Card</p>
                <p className="text-sm lg:text-xl font-bold text-slate-800">{CURRENCY_FORMATTER.format(paymentTotals.CARD)}</p>
              </div>
            </div>
            <div className="bg-white p-3 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
              <div className="p-2 lg:p-3 bg-purple-100 text-purple-600 rounded-full"><Smartphone size={18} className="lg:w-6 lg:h-6" /></div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] lg:text-sm text-slate-500 font-medium">Mobile</p>
                <p className="text-sm lg:text-xl font-bold text-slate-800">{CURRENCY_FORMATTER.format(paymentTotals.MOBILE)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm h-64 lg:h-80">
              <h3 className="font-bold text-slate-700 mb-2 lg:mb-4 text-sm lg:text-base">Revenue by Category</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => CURRENCY_FORMATTER.format(value)} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm h-64 lg:h-80">
              <h3 className="font-bold text-slate-700 mb-2 lg:mb-4 text-sm lg:text-base">Top Products</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} interval={0} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {topProductsData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm h-64 lg:h-80 lg:col-span-2">
              <h3 className="font-bold text-slate-700 mb-2 lg:mb-4 text-sm lg:text-base">Sales by Hour</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `K${val}`} />
                  <Tooltip formatter={(value: number) => CURRENCY_FORMATTER.format(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm lg:text-base">Recent Transactions ({filteredSales.length})</h3>
              <button
                onClick={downloadExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr className="border-b-2 border-black">
                    <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase sticky left-0 bg-gray-100 border-r border-black z-20">#</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Transaction ID</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Date</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Time</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Cashier</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Items</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase border-r border-black">Qty</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Total Cost</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Total Sale</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Profit</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Margin %</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase border-r border-black">Payment</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale, idx) => {
                    const totalQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);
                    const profit = sale.totalAmount - sale.totalCost;
                    const margin = sale.totalAmount > 0 ? (profit / sale.totalAmount) * 100 : 0;
                    const saleDate = new Date(sale.timestamp);
                    const itemsDisplay = sale.items.map(i => `${i.quantity}x ${i.productName} (${i.size})`).join(', ');

                    return (
                      <tr key={sale.id} className={`hover:bg-gray-100 border-b border-black ${sale.isVoided ? 'bg-red-50/30 line-through decoration-red-500 decoration-2' : ''}`}>
                        <td className="px-2 py-1.5 text-gray-500 font-mono text-xs sticky left-0 bg-white border-r border-black">{idx + 1}</td>
                        <td className="px-2 py-1.5 text-gray-700 font-mono text-[10px] border-r border-black">#{sale.id.slice(-8)}</td>
                        <td className="px-2 py-1.5 text-gray-800 text-xs whitespace-nowrap border-r border-black">
                          {saleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-2 py-1.5 text-gray-800 text-xs whitespace-nowrap border-r border-black">
                          {saleDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-2 py-1.5 text-gray-800 text-xs font-medium border-r border-black">{sale.cashierName}</td>
                        <td
                          className="px-2 py-1.5 text-gray-700 text-xs border-r border-black max-w-xs truncate cursor-pointer hover:bg-blue-50 hover:text-blue-700 relative"
                          title={itemsDisplay}
                          onClick={() => handleViewSaleDetails(sale)}
                        >
                          {itemsDisplay}
                          {hasZeroPrices(sale) && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-300">
                              <AlertCircle size={10} className="mr-0.5" /> FIX
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold text-gray-900 border-r border-black">{totalQty}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700 text-xs border-r border-black">{CURRENCY_FORMATTER.format(sale.totalCost)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-gray-900 border-r border-black">{CURRENCY_FORMATTER.format(sale.totalAmount)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-green-700 border-r border-black">{CURRENCY_FORMATTER.format(profit)}</td>
                        <td className="px-2 py-1.5 text-right text-xs border-r border-black">
                          <span className={`font-bold ${margin >= 30 ? 'text-green-700' : margin >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className={`px-2 py-1.5 text-center border-r border-black ${sale.isVoided ? 'bg-red-50/30' : ''}`}>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800 border-green-800' :
                            sale.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-800 border-blue-800' :
                              'bg-purple-100 text-purple-800 border-purple-800'
                            }`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className={`px-2 py-1.5 text-center ${sale.isVoided ? 'bg-red-50/30' : ''}`}>
                          {sale.isVoided ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-700">
                              VOIDED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-700">
                              VALID
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-200 border-t-2 border-black">
                  <tr className="font-bold">
                    <td colSpan={6} className="px-2 py-2 text-right text-gray-900 text-xs uppercase border-r border-black">TOTALS:</td>
                    <td className="px-2 py-2 text-center text-gray-900 border-r border-black">
                      {filteredSales.reduce((sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0), 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900 border-r border-black">{CURRENCY_FORMATTER.format(totalCost)}</td>
                    <td className="px-2 py-2 text-right text-gray-900 border-r border-black">{CURRENCY_FORMATTER.format(totalRevenue)}</td>
                    <td className="px-2 py-2 text-right text-green-800 border-r border-black">{CURRENCY_FORMATTER.format(grossProfit)}</td>
                    <td className="px-2 py-2 text-right text-xs border-r border-black">
                      <span className="font-bold text-gray-900">{totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%</span>
                    </td>
                    <td className="px-2 py-2 border-r border-black"></td>
                    <td className="px-2 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sale Details Modal */}
      {showSaleDetailsModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`p-6 border-b border-slate-200 bg-gradient-to-r ${selectedSale.isVoided ? 'from-red-500 to-red-600' : 'from-blue-500 to-blue-600'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">Sale Details</h2>
                    {selectedSale.isVoided && (
                      <span className="px-3 py-1 bg-white/20 border-2 border-white rounded-lg text-white text-sm font-bold">
                        VOIDED
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${selectedSale.isVoided ? 'text-red-100' : 'text-blue-100'}`}>Transaction #{selectedSale.id.slice(-8).toUpperCase()}</p>
                </div>
                <button
                  onClick={() => {
                    setShowSaleDetailsModal(false);
                    setSelectedSale(null);
                    setIsEditMode(false);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={24} className="text-white" />
                </button>
              </div>
            </div>

            {/* Sale Info */}
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Date</p>
                  <p className="text-sm font-bold text-slate-800">
                    {new Date(selectedSale.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Time</p>
                  <p className="text-sm font-bold text-slate-800">
                    {new Date(selectedSale.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Cashier</p>
                  <p className="text-sm font-bold text-slate-800">{selectedSale.cashierName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Payment</p>
                  <p className="text-sm font-bold text-slate-800">{selectedSale.paymentMethod}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedSale.isVoided && (
                <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-900">This Sale Has Been Voided</p>
                    <p className="text-xs text-red-700 mt-1">
                      This transaction was voided on {selectedSale.voidedAt ? new Date(selectedSale.voidedAt).toLocaleString('en-GB') : 'N/A'}. Stock has been restored to inventory.
                    </p>
                  </div>
                </div>
              )}
              {hasZeroPrices(selectedSale) && !isEditMode && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900">Missing Price Information</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Some items have 0 prices/costs. This may be because they were sold before prices were recorded. Click Edit to update.
                    </p>
                  </div>
                </div>
              )}

              {isEditMode && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-900">Edit Mode Active</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Prices have been auto-loaded from current product inventory. You can adjust them manually if needed.
                    </p>
                  </div>
                </div>
              )}

              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-700 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-700 uppercase">Product</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-700 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-700 uppercase">Cost Price</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-700 uppercase">Sale Price</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-700 uppercase">Total Cost</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-700 uppercase">Total Sale</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-700 uppercase">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditMode ? editingItems : selectedSale.items).map((item, idx) => {
                    const totalCost = item.costAtSale * item.quantity;
                    const totalSale = item.priceAtSale * item.quantity;
                    const profit = totalSale - totalCost;
                    const hasIssue = item.priceAtSale === 0 || item.costAtSale === 0;

                    return (
                      <tr key={idx} className={`border-b border-slate-200 ${selectedSale.isVoided ? 'bg-red-50/30 line-through decoration-red-500 decoration-2' : hasIssue ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-2 text-slate-600">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-800">{item.productName}</p>
                              <p className="text-xs text-slate-500">{item.size}</p>
                            </div>
                            {isEditMode && hasIssue && (
                              <button
                                onClick={() => handleSelectProduct(idx)}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded border border-blue-300 font-medium"
                              >
                                Select Product
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {isEditMode ? (
                            <input
                              type="number"
                              step="0.01"
                              value={item.costAtSale}
                              onChange={(e) => handleUpdateItemPrice(idx, 'costAtSale', e.target.value)}
                              className={`w-24 px-2 py-1 text-right border rounded ${hasIssue ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                            />
                          ) : (
                            <span className={hasIssue ? 'text-red-600 font-bold' : 'text-slate-700'}>
                              {CURRENCY_FORMATTER.format(item.costAtSale)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditMode ? (
                            <input
                              type="number"
                              step="0.01"
                              value={item.priceAtSale}
                              onChange={(e) => handleUpdateItemPrice(idx, 'priceAtSale', e.target.value)}
                              className={`w-24 px-2 py-1 text-right border rounded ${hasIssue ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                            />
                          ) : (
                            <span className={hasIssue ? 'text-red-600 font-bold' : 'text-slate-700'}>
                              {CURRENCY_FORMATTER.format(item.priceAtSale)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{CURRENCY_FORMATTER.format(totalCost)}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{CURRENCY_FORMATTER.format(totalSale)}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{CURRENCY_FORMATTER.format(profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                  <tr className="font-bold">
                    <td colSpan={5} className="px-3 py-3 text-right text-slate-900 uppercase text-xs">Totals:</td>
                    <td className="px-3 py-3 text-right text-slate-900">
                      {CURRENCY_FORMATTER.format(
                        selectedSale.isVoided ? 0 : (isEditMode ? editingItems : selectedSale.items).reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-900">
                      {CURRENCY_FORMATTER.format(
                        selectedSale.isVoided ? 0 : (isEditMode ? editingItems : selectedSale.items).reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-green-700">
                      {CURRENCY_FORMATTER.format(
                        selectedSale.isVoided ? 0 : (isEditMode ? editingItems : selectedSale.items).reduce((sum, item) => {
                          const totalSale = item.priceAtSale * item.quantity;
                          const totalCost = item.costAtSale * item.quantity;
                          return sum + (totalSale - totalCost);
                        }, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSaleDetailsModal(false);
                    setSelectedSale(null);
                    setIsEditMode(false);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  Close
                </button>
                {!isEditMode && !selectedSale.isVoided && !voidRequests.find(r => r.saleId === selectedSale.id && r.status === 'PENDING') && (
                  <button
                    onClick={() => setShowVoidModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Ban size={16} />
                    Request Void
                  </button>
                )}
                {!isEditMode && !selectedSale.isVoided && (
                  <button
                    onClick={handleDeleteSale}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Trash2 size={16} />
                    Delete Sale
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {!isEditMode ? (
                  <button
                    onClick={handleEnterEditMode}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Edit2 size={16} />
                    Edit Prices
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingItems(JSON.parse(JSON.stringify(selectedSale.items)));
                        setIsEditMode(false);
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSaleUpdates}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Save size={16} />
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Selector Modal */}
      {showProductSelector && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-500 to-purple-600">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Select Product</h2>
                  <p className="text-purple-100 text-sm mt-1">Choose a product to replace the missing item</p>
                </div>
                <button
                  onClick={() => {
                    setShowProductSelector(false);
                    setSelectingForItemIndex(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={24} className="text-white" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-200">
              <input
                type="text"
                placeholder="Search products by name, SKU, or brand..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredProductsForSelector.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No products found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProductsForSelector.map(product => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelected(product)}
                      className="w-full p-4 border border-slate-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-left"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800">{product.name}</p>
                          <p className="text-sm text-slate-500">{product.size} • {product.brand}</p>
                          <p className="text-xs text-slate-400 mt-1">SKU: {product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-600">Cost: {CURRENCY_FORMATTER.format(product.costPrice)}</p>
                          <p className="text-sm font-bold text-green-600">Sale: {CURRENCY_FORMATTER.format(product.sellingPrice)}</p>
                          <p className="text-xs text-slate-500 mt-1">Stock: {product.stock}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] animate-slide-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-2 ${toast.type === 'success' ? 'bg-green-50 border-green-500 text-green-900' :
            toast.type === 'error' ? 'bg-red-50 border-red-500 text-red-900' :
              'bg-amber-50 border-amber-500 text-amber-900'
            }`}>
            {toast.type === 'success' && <CheckCircle size={24} className="text-green-600" />}
            {toast.type === 'error' && <XCircle size={24} className="text-red-600" />}
            {toast.type === 'warning' && <AlertCircle size={24} className="text-amber-600" />}
            <p className="font-medium">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-70 transition-opacity"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Password Protection Dialog for Delete */}
      {showDeletePasswordDialog && (
        <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-red-500 to-red-600">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Trash2 size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Delete Sale</h2>
                  <p className="text-red-100 text-sm">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Deleting this sale will permanently remove it from the database and restore all stock quantities.
                Enter your PIN to confirm.
              </p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Enter your PIN"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmDeleteSale();
                  }
                }}
                className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-center text-xl font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setShowDeletePasswordDialog(false);
                  setSaleToDelete(null);
                  setDeletePassword('');
                }}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSale}
                disabled={!deletePassword}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-amber-500 to-amber-600">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertCircle size={24} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Confirm Action</h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700">Some items still have 0 prices. Are you sure you want to save?</p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                }}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  if (confirmAction) {
                    confirmAction();
                  }
                  setConfirmAction(null);
                }}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors"
              >
                Yes, Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Void Request Modal */}
      {showVoidModal && selectedSale && (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-red-600">
              <Ban size={20} /> Request Void Sale
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Sale #{selectedSale.id.slice(-8)} • {CURRENCY_FORMATTER.format(selectedSale.totalAmount)}
            </p>
            <p className="text-sm text-slate-600 mb-4">
              Please provide a reason for voiding this sale. This request will be sent to an admin for approval. Once approved, all products will be returned to inventory.
            </p>
            <textarea
              autoFocus
              placeholder="Enter reason for void (required)..."
              className="w-full border-2 border-red-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
              rows={3}
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  if (voidReason.trim() && selectedSale) {
                    await requestVoid(selectedSale.id, voidReason.trim());
                    setVoidReason('');
                    setShowVoidModal(false);
                    showToast('Void request submitted successfully', 'success');
                  }
                }}
                disabled={!voidReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Ban size={18} /> Submit Request
              </button>
              <button
                onClick={() => {
                  setVoidReason('');
                  setShowVoidModal(false);
                }}
                className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
