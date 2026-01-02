'use client';

import React, { useMemo, useState } from 'react';
import { Product, AuditLog, Sale } from '../types';
import { X, TrendingUp, DollarSign, Package, BarChart3, List, Activity, Calendar, Download, ShoppingCart, Clock, Hash, Percent, Box, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProductAnalyticsProps {
  product: Product;
  auditLogs: AuditLog[];
  sales: Sale[];
  onClose: () => void;
}

type DateRange = 'today' | 'week' | 'month' | 'custom' | 'all';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

export const ProductAnalytics: React.FC<ProductAnalyticsProps> = ({ product, auditLogs, sales, onClose }) => {
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get date filter bounds
  const getDateBounds = () => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) {
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        startDate = null;
    }
    return { startDate, endDate };
  };

  // Filter sales for this specific product
  const filteredProductSales = useMemo(() => {
    if (!sales || !Array.isArray(sales)) return [];
    
    const { startDate, endDate } = getDateBounds();
    
    return sales.filter(sale => {
      if (sale.isVoided) return false;
      if (!sale.items.some(item => item.productId === product.id)) return false;
      
      const saleDate = new Date(sale.timestamp);
      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;
      
      return true;
    }).map(sale => ({
      ...sale,
      productItems: sale.items.filter(item => item.productId === product.id)
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, product.id, dateRange, customStartDate, customEndDate]);

  // Filter audit logs related to this product AND create sale activity logs from actual sales
  const filteredLogs = useMemo(() => {
    if (!auditLogs || !Array.isArray(auditLogs)) return [];
    
    const { startDate, endDate } = getDateBounds();
    
    // Get audit logs that mention this product
    const productAuditLogs = auditLogs.filter(log => {
      const details = log.details.toLowerCase();
      const productName = product.name.toLowerCase();
      const productId = product.id;
      
      const mentionsProduct = details.includes(productName) || details.includes(productId);
      
      const relevantActions = ['PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'STOCK_ADJUST', 'STOCK_RECEIVE'];
      if (!mentionsProduct || !relevantActions.includes(log.action)) return false;
      
      const logDate = new Date(log.timestamp);
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;
      
      return true;
    });

    // Create activity logs from actual sales of this product
    const saleActivityLogs = filteredProductSales.map(sale => {
      const qty = sale.productItems.reduce((sum, item) => sum + item.quantity, 0);
      const total = sale.productItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      
      return {
        id: `sale-${sale.id}`,
        timestamp: sale.timestamp,
        userId: sale.cashierId,
        userName: sale.cashierName,
        action: 'SALE',
        details: `Sold ${qty} unit${qty > 1 ? 's' : ''} of ${product.name} for ${CURRENCY_FORMATTER.format(total)} via ${sale.paymentMethod}`
      };
    });

    // Combine and sort by timestamp
    return [...productAuditLogs, ...saleActivityLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, product, filteredProductSales, dateRange, customStartDate, customEndDate]);

  // Calculate comprehensive analytics
  const analytics = useMemo(() => {
    // Units sold in the selected period (from filtered sales)
    const periodUnitsSold = filteredProductSales.reduce((sum, sale) => 
      sum + sale.productItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    
    const totalRevenue = filteredProductSales.reduce((sum, sale) => 
      sum + sale.productItems.reduce((itemSum, item) => itemSum + (item.priceAtSale * item.quantity), 0), 0);
    
    const totalCost = filteredProductSales.reduce((sum, sale) => 
      sum + sale.productItems.reduce((itemSum, item) => itemSum + (item.costAtSale * item.quantity), 0), 0);
    
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgPricePerUnit = periodUnitsSold > 0 ? totalRevenue / periodUnitsSold : product.sellingPrice;
    
    // Activity counts
    const salesCount = filteredLogs.filter(log => log.action === 'SALE').length;
    const adjustCount = filteredLogs.filter(log => log.action === 'STOCK_ADJUST').length;
    const receiveCount = filteredLogs.filter(log => log.action === 'STOCK_RECEIVE').length;
    const editCount = filteredLogs.filter(log => log.action === 'PRODUCT_EDIT').length;
    
    // Calculate total units received from STOCK_RECEIVE logs
    const totalUnitsReceived = filteredLogs
      .filter(log => log.action === 'STOCK_RECEIVE')
      .reduce((sum, log) => {
        // Extract quantity from details string (e.g., "Received 10 units")
        const match = log.details.match(/(\d+)\s+unit/);
        return sum + (match ? parseInt(match[1]) : 0);
      }, 0);

    return {
      periodUnitsSold,  // Units sold in selected date range
      lifetimeUnitsSold: product.unitsSold || 0,  // Lifetime total from product record
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      avgPricePerUnit,
      salesCount,
      adjustCount,
      receiveCount,
      editCount,
      totalUnitsReceived,
      totalTransactions: filteredProductSales.length,
      totalActivities: filteredLogs.length,
    };
  }, [filteredProductSales, filteredLogs, product.sellingPrice, product.unitsSold]);

  // Sales by day for chart
  const salesByDay = useMemo(() => {
    const dayMap = new Map<string, { date: string, units: number, revenue: number, profit: number }>();
    
    filteredProductSales.forEach(sale => {
      const date = new Date(sale.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const existing = dayMap.get(date) || { date, units: 0, revenue: 0, profit: 0 };
      
      sale.productItems.forEach(item => {
        existing.units += item.quantity;
        existing.revenue += item.priceAtSale * item.quantity;
        existing.profit += (item.priceAtSale - item.costAtSale) * item.quantity;
      });
      
      dayMap.set(date, existing);
    });
    
    return Array.from(dayMap.values()).reverse().slice(-14); // Last 14 days
  }, [filteredProductSales]);

  // Sales by hour for peak hours chart
  const salesByHour = useMemo(() => {
    const hourData = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, sales: 0, units: 0 }));
    
    filteredProductSales.forEach(sale => {
      const hour = new Date(sale.timestamp).getHours();
      sale.productItems.forEach(item => {
        hourData[hour].sales += item.priceAtSale * item.quantity;
        hourData[hour].units += item.quantity;
      });
    });
    
    return hourData;
  }, [filteredProductSales]);

  // Activity breakdown for pie chart
  const activityBreakdown = useMemo(() => {
    const breakdown = [
      { name: 'Sales', value: analytics.salesCount, color: '#10b981' },
      { name: 'Stock Received', value: analytics.receiveCount, color: '#3b82f6' },
      { name: 'Adjustments', value: analytics.adjustCount, color: '#8b5cf6' },
      { name: 'Edits', value: analytics.editCount, color: '#f59e0b' },
    ].filter(item => item.value > 0);
    
    return breakdown;
  }, [analytics]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'SALE': return 'text-green-600 bg-green-50 border-green-200';
      case 'PRODUCT_ADD': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'PRODUCT_EDIT': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'PRODUCT_DELETE': return 'text-red-600 bg-red-50 border-red-200';
      case 'STOCK_ADJUST': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'STOCK_RECEIVE': return 'text-teal-600 bg-teal-50 border-teal-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'SALE': return 'Sale';
      case 'PRODUCT_ADD': return 'Added';
      case 'PRODUCT_EDIT': return 'Edited';
      case 'PRODUCT_DELETE': return 'Deleted';
      case 'STOCK_ADJUST': return 'Adjusted';
      case 'STOCK_RECEIVE': return 'Received';
      default: return action;
    }
  };

  const handleExportCSV = () => {
    const headers = [
      '#', 'Transaction ID', 'Date', 'Time', 'Cashier',
      'Quantity', 'Unit Cost', 'Unit Price', 'Total Cost', 'Total Sale', 
      'Profit', 'Margin %', 'Payment Method'
    ];
    
    const rows = filteredProductSales.map((sale, idx) => {
      const qty = sale.productItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalSale = sale.productItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      const totalCost = sale.productItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);
      const profit = totalSale - totalCost;
      const margin = totalSale > 0 ? (profit / totalSale) * 100 : 0;
      const unitPrice = sale.productItems[0]?.priceAtSale || 0;
      const unitCost = sale.productItems[0]?.costAtSale || 0;
      const date = new Date(sale.timestamp);
      
      return [
        idx + 1,
        sale.id,
        date.toLocaleDateString('en-GB'),
        date.toLocaleTimeString('en-GB'),
        sale.cashierName,
        qty,
        unitCost,
        unitPrice,
        totalCost,
        totalSale,
        profit,
        margin.toFixed(2),
        sale.paymentMethod
      ].join(',');
    });
    
    // Add summary row
    rows.push('');
    rows.push(['SUMMARY', '', '', '', '', 
      analytics.periodUnitsSold, '', '', 
      analytics.totalCost, analytics.totalRevenue, 
      analytics.totalProfit, analytics.profitMargin.toFixed(2), ''
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${product.name.replace(/\s+/g, '_')}_detailed_sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 lg:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Package className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{product.name}</h2>
              <p className="text-amber-100 text-xs">{product.brand} • {product.size} • SKU: {product.sku}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 transition" title="Export CSV">
              <Download size={18} />
            </button>
            <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2 transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-2">
          <Calendar size={14} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Period:</span>
          {(['today', 'week', 'month', 'all', 'custom'] as DateRange[]).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                dateRange === range ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : range === 'all' ? 'All Time' : 'Custom'}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded"
              />
            </div>
          )}
        </div>

        {/* Tabs Content */}
        <Tabs defaultValue="statistics" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-white px-4 h-10">
            <TabsTrigger value="statistics" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 gap-1.5">
              <BarChart3 size={14} /> Statistics
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 gap-1.5">
              <ShoppingCart size={14} /> Sales ({filteredProductSales.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 gap-1.5">
              <Activity size={14} /> Activity Log ({filteredLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
            {/* KPI Cards - 2 rows */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart size={14} className="text-blue-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase">Period Sold</span>
                </div>
                <p className="text-xl font-bold text-blue-600">{analytics.periodUnitsSold}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{analytics.totalTransactions} sales</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Hash size={14} className="text-purple-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase">Lifetime Sold</span>
                </div>
                <p className="text-xl font-bold text-purple-600">{analytics.lifetimeUnitsSold}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">All time total</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-cyan-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight size={14} className="text-cyan-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase">Units Received</span>
                </div>
                <p className="text-xl font-bold text-cyan-600">{analytics.totalUnitsReceived}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{analytics.receiveCount} receipts</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-green-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase">Revenue</span>
                </div>
                <p className="text-lg font-bold text-green-600">{CURRENCY_FORMATTER.format(analytics.totalRevenue)}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{CURRENCY_FORMATTER.format(analytics.totalProfit)} profit</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Percent size={14} className="text-amber-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase">Margin</span>
                </div>
                <p className="text-xl font-bold text-amber-600">{analytics.profitMargin.toFixed(1)}%</p>
                <p className="text-[9px] text-gray-500 mt-0.5">Profit margin</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Box size={14} className="text-gray-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase">Current Stock</span>
                </div>
                <p className={`text-xl font-bold ${product.stock <= (product.lowStockThreshold || 5) ? 'text-red-600' : 'text-gray-900'}`}>{product.stock}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Sales Trend Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-amber-500" /> Sales Trend
                </h3>
                {salesByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={salesByDay}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? CURRENCY_FORMATTER.format(value) : value,
                          name === 'revenue' ? 'Revenue' : 'Units'
                        ]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No sales data for this period</div>
                )}
              </div>

              {/* Peak Hours Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" /> Peak Sales Hours
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salesByHour.filter(h => h.units > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="units" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Units Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity Breakdown & Product Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Activity Pie Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-purple-500" /> Activity Breakdown
                </h3>
                {activityBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={activityBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {activityBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">No activity data</div>
                )}
              </div>

              {/* Product Details */}
              <div className="lg:col-span-2 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Package size={16} className="text-amber-500" /> Product Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Cost Price</p>
                    <p className="font-semibold text-gray-900">{CURRENCY_FORMATTER.format(product.costPrice)}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Selling Price</p>
                    <p className="font-semibold text-gray-900">{CURRENCY_FORMATTER.format(product.sellingPrice)}</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded">
                    <p className="text-[10px] text-green-600 uppercase">Profit/Unit</p>
                    <p className="font-semibold text-green-700">{CURRENCY_FORMATTER.format(product.sellingPrice - product.costPrice)}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Avg Sale Price</p>
                    <p className="font-semibold text-gray-900">{CURRENCY_FORMATTER.format(analytics.avgPricePerUnit)}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Total Units Sold</p>
                    <p className="font-semibold text-gray-900">{product.unitsSold || 0}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Low Stock Alert</p>
                    <p className="font-semibold text-gray-900">{product.lowStockThreshold || 5}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Type</p>
                    <p className="font-semibold text-gray-900">{product.type}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Barcode</p>
                    <p className="font-mono text-xs text-gray-900">{product.barcode || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="flex-1 overflow-y-auto m-0">
            <div className="p-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800">
                    Detailed Sales Transactions ({filteredProductSales.length})
                  </h3>
                  <span className="text-xs text-gray-500">
                    Total Revenue: {CURRENCY_FORMATTER.format(analytics.totalRevenue)} | Profit: {CURRENCY_FORMATTER.format(analytics.totalProfit)}
                  </span>
                </div>
                {filteredProductSales.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No sales found for this period</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr className="border-b-2 border-black">
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase sticky left-0 bg-gray-100 border-r border-black z-20">#</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Transaction ID</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Date</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Time</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Cashier</th>
                          <th className="px-2 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase border-r border-black">Qty</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Unit Cost</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Unit Price</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Total Cost</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Total Sale</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Profit</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-gray-700 uppercase border-r border-black">Margin %</th>
                          <th className="px-2 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProductSales.map((sale, idx) => {
                          const qty = sale.productItems.reduce((sum, item) => sum + item.quantity, 0);
                          const totalSale = sale.productItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
                          const totalCost = sale.productItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);
                          const profit = totalSale - totalCost;
                          const margin = totalSale > 0 ? (profit / totalSale) * 100 : 0;
                          const unitPrice = sale.productItems[0]?.priceAtSale || 0;
                          const unitCost = sale.productItems[0]?.costAtSale || 0;
                          const saleDate = new Date(sale.timestamp);
                          
                          return (
                            <tr key={sale.id} className="hover:bg-gray-100 border-b border-black">
                              <td className="px-2 py-1.5 text-gray-500 font-mono text-xs sticky left-0 bg-white border-r border-black">{idx + 1}</td>
                              <td className="px-2 py-1.5 text-gray-700 font-mono text-[10px] border-r border-black">#{sale.id.slice(-8)}</td>
                              <td className="px-2 py-1.5 text-gray-800 text-xs whitespace-nowrap border-r border-black">
                                {saleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-2 py-1.5 text-gray-800 text-xs whitespace-nowrap border-r border-black">
                                {saleDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-2 py-1.5 text-gray-800 text-xs font-medium border-r border-black">{sale.cashierName}</td>
                              <td className="px-2 py-1.5 text-center font-bold text-gray-900 border-r border-black">{qty}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700 text-xs border-r border-black">{CURRENCY_FORMATTER.format(unitCost)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-800 text-xs font-semibold border-r border-black">{CURRENCY_FORMATTER.format(unitPrice)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700 text-xs border-r border-black">{CURRENCY_FORMATTER.format(totalCost)}</td>
                              <td className="px-2 py-1.5 text-right font-bold text-gray-900 border-r border-black">{CURRENCY_FORMATTER.format(totalSale)}</td>
                              <td className="px-2 py-1.5 text-right font-bold text-green-700 border-r border-black">{CURRENCY_FORMATTER.format(profit)}</td>
                              <td className="px-2 py-1.5 text-right text-xs border-r border-black">
                                <span className={`font-bold ${margin >= 30 ? 'text-green-700' : margin >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                                  {margin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800 border-green-800' :
                                  sale.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-800 border-blue-800' : 
                                  'bg-purple-100 text-purple-800 border-purple-800'
                                }`}>
                                  {sale.paymentMethod}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-200 border-t-2 border-black">
                        <tr className="font-bold">
                          <td colSpan={5} className="px-2 py-2 text-right text-gray-900 text-xs uppercase border-r border-black">TOTALS:</td>
                          <td className="px-2 py-2 text-center text-gray-900 border-r border-black">{analytics.periodUnitsSold}</td>
                          <td className="px-2 py-2 border-r border-black"></td>
                          <td className="px-2 py-2 border-r border-black"></td>
                          <td className="px-2 py-2 text-right text-gray-900 border-r border-black">{CURRENCY_FORMATTER.format(analytics.totalCost)}</td>
                          <td className="px-2 py-2 text-right text-gray-900 border-r border-black">{CURRENCY_FORMATTER.format(analytics.totalRevenue)}</td>
                          <td className="px-2 py-2 text-right text-green-800 border-r border-black">{CURRENCY_FORMATTER.format(analytics.totalProfit)}</td>
                          <td className="px-2 py-2 text-right text-xs border-r border-black">
                            <span className="font-bold text-gray-900">{analytics.profitMargin.toFixed(1)}%</span>
                          </td>
                          <td className="px-2 py-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="flex-1 overflow-y-auto m-0">
            <div className="p-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800">Activity History ({filteredLogs.length} records)</h3>
                  <span className="text-xs text-gray-500">
                    Sales: {filteredLogs.filter(log => log.action === 'SALE').length} | 
                    Adjustments: {filteredLogs.filter(log => log.action === 'STOCK_ADJUST').length} | 
                    Received: {filteredLogs.filter(log => log.action === 'STOCK_RECEIVE').length}
                  </span>
                </div>
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Activity size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No activity found for this period</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr className="border-b-2 border-black">
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase sticky left-0 bg-gray-100 border-r border-black z-20">#</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Action</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Date</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">Time</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase border-r border-black">User</th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map((log, idx) => {
                          const logDate = new Date(log.timestamp);
                          return (
                            <tr key={log.id} className="hover:bg-gray-100 border-b border-black">
                              <td className="px-2 py-1.5 text-gray-500 font-mono text-xs sticky left-0 bg-white border-r border-black">{idx + 1}</td>
                              <td className="px-2 py-1.5 border-r border-black">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${getActionColor(log.action)}`}>
                                  {getActionLabel(log.action)}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-gray-800 text-xs whitespace-nowrap border-r border-black">
                                {logDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-2 py-1.5 text-gray-800 text-xs whitespace-nowrap border-r border-black">
                                {logDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-2 py-1.5 text-gray-800 text-xs font-semibold border-r border-black">{log.userName}</td>
                              <td className="px-2 py-1.5 text-gray-700 text-xs">{log.details}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProductAnalytics;
