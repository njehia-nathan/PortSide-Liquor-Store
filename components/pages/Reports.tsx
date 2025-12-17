'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { CURRENCY_FORMATTER } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Banknote, CreditCard, Smartphone, Download, Calendar, FilterX } from 'lucide-react';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const Reports = () => {
  const { sales, products } = useStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
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
      return startCondition && endCondition;
    });
  }, [sales, startDate, endDate]);

  const totalRevenue = filteredSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
  const totalCost = filteredSales.reduce((acc, sale) => acc + sale.totalCost, 0);
  const grossProfit = totalRevenue - totalCost;

  const productTypeMap = new Map<string, string>();
  products.forEach(p => productTypeMap.set(p.id, p.type));

  const categoryRevenueMap = new Map<string, number>();
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      const type = productTypeMap.get(item.productId) || 'Unknown';
      const itemRevenue = item.priceAtSale * item.quantity;
      const current = categoryRevenueMap.get(type) || 0;
      categoryRevenueMap.set(type, current + itemRevenue);
    });
  });

  const categoryData = Array.from(categoryRevenueMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const productPerformance = new Map<string, number>();
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      const key = item.productName;
      const current = productPerformance.get(key) || 0;
      productPerformance.set(key, current + item.quantity);
    });
  });

  const topProductsData = Array.from(productPerformance.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, sales: 0 }));
  filteredSales.forEach(sale => {
    const hour = new Date(sale.timestamp).getHours();
    hourlyData[hour].sales += sale.totalAmount;
  });

  const paymentTotals = filteredSales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.totalAmount;
    return acc;
  }, { CASH: 0, CARD: 0, MOBILE: 0 } as Record<string, number>);

  const downloadExcel = () => {
    if (filteredSales.length === 0) { alert("No data to export."); return; }
    const headers = ['Transaction ID', 'Date', 'Time', 'Cashier', 'Payment Method', 'Items', 'Total Amount (KES)', 'Total Cost (KES)', 'Gross Profit (KES)'];
    const csvRows = [
      headers.join(','),
      ...filteredSales.map(sale => {
        const date = new Date(sale.timestamp);
        const itemsStr = sale.items.map(i => `${i.quantity}x ${i.productName} (${i.size})`).join('; ');
        const profit = sale.totalAmount - sale.totalCost;
        const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
        return [escape(sale.id), escape(date.toLocaleDateString()), escape(date.toLocaleTimeString()), escape(sale.cashierName), escape(sale.paymentMethod), escape(itemsStr), sale.totalAmount, sale.totalCost, profit].join(',');
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

  return (
    <div className="p-3 lg:p-6 max-w-7xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Reports</h1>
          <span className="text-xs lg:text-sm text-slate-500">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-2 flex-1">
            <Calendar size={16} className="text-slate-400 shrink-0"/>
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

      {filteredSales.length === 0 ? (
        <div className="bg-white p-8 lg:p-12 rounded-xl border border-slate-200 text-center shadow-sm">
          <div className="text-slate-400 text-4xl lg:text-6xl mb-3 lg:mb-4">📅</div>
          <h3 className="text-lg lg:text-xl font-medium text-slate-700">No Transactions Found</h3>
          <p className="text-sm lg:text-base text-slate-500 mt-2">No sales found for the selected date range.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 lg:gap-6">
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
              <div className="p-2 lg:p-3 bg-green-100 text-green-600 rounded-full"><Banknote size={18} className="lg:w-6 lg:h-6"/></div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] lg:text-sm text-slate-500 font-medium">Cash</p>
                <p className="text-sm lg:text-xl font-bold text-slate-800">{CURRENCY_FORMATTER.format(paymentTotals.CASH)}</p>
              </div>
            </div>
            <div className="bg-white p-3 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
              <div className="p-2 lg:p-3 bg-blue-100 text-blue-600 rounded-full"><CreditCard size={18} className="lg:w-6 lg:h-6"/></div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] lg:text-sm text-slate-500 font-medium">Card</p>
                <p className="text-sm lg:text-xl font-bold text-slate-800">{CURRENCY_FORMATTER.format(paymentTotals.CARD)}</p>
              </div>
            </div>
            <div className="bg-white p-3 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
              <div className="p-2 lg:p-3 bg-purple-100 text-purple-600 rounded-full"><Smartphone size={18} className="lg:w-6 lg:h-6"/></div>
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
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm h-64 lg:h-80">
              <h3 className="font-bold text-slate-700 mb-2 lg:mb-4 text-sm lg:text-base">Top Products</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} interval={0} />
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
            <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm lg:text-base">Recent Transactions</h3>
            </div>
            <div className="lg:hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="p-3 hover:bg-slate-50">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-slate-900 text-sm">{sale.cashierName}</span>
                    <span className="font-bold text-slate-900">{CURRENCY_FORMATTER.format(sale.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{new Date(sale.timestamp).toLocaleString()}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">{sale.paymentMethod}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden lg:block max-h-96 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Cashier</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-500">{new Date(sale.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-3 font-medium">{sale.cashierName}</td>
                      <td className="px-6 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">{sale.paymentMethod}</span></td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900">{CURRENCY_FORMATTER.format(sale.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
