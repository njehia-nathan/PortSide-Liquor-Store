'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Shift } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import { Clock, Calendar, DollarSign, Users, MessageSquare, X, Eye, Filter, Printer, FileText, Download } from 'lucide-react';

const AdminShiftReports = () => {
  const { shifts, sales, users, businessSettings } = useStore();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [showZReport, setShowZReport] = useState(false);

  const allShifts = useMemo(() => {
    let filtered = [...shifts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    if (filterUser !== 'all') {
      filtered = filtered.filter(s => s.cashierId === filterUser);
    }
    return filtered;
  }, [shifts, filterUser]);

  const getShiftSales = (cashierId: string, shiftStart: string, shiftEnd?: string) => {
    return sales.filter(s => {
      const saleTime = new Date(s.timestamp);
      const startTime = new Date(shiftStart);
      const endTime = shiftEnd ? new Date(shiftEnd) : new Date();
      return s.cashierId === cashierId && saleTime >= startTime && saleTime <= endTime;
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const calculateShiftDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const totalRevenue = allShifts.reduce((acc, shift) => {
    const shiftSales = getShiftSales(shift.cashierId, shift.startTime, shift.endTime);
    return acc + shiftSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }, 0);

  const shiftsWithComments = allShifts.filter(s => s.comments);

  // Get sales for selected shift
  const selectedShiftSales = selectedShift ? getShiftSales(selectedShift.cashierId, selectedShift.startTime, selectedShift.endTime) : [];
  const selectedShiftRevenue = selectedShiftSales.reduce((acc, s) => acc + s.totalAmount, 0);
  // Payment method breakdown for Z-Report
  const selectedShiftCashSales = selectedShiftSales.filter(s => s.paymentMethod === 'CASH' && !s.isVoided);
  const selectedShiftCardSales = selectedShiftSales.filter(s => s.paymentMethod === 'CARD' && !s.isVoided);
  const selectedShiftMobileSales = selectedShiftSales.filter(s => s.paymentMethod === 'MOBILE' && !s.isVoided);
  const selectedShiftVoidedSales = selectedShiftSales.filter(s => s.isVoided);
  
  const cashTotal = selectedShiftCashSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const cardTotal = selectedShiftCardSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const mobileTotal = selectedShiftMobileSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const voidedTotal = selectedShiftVoidedSales.reduce((acc, s) => acc + s.totalAmount, 0);

  const handlePrintZReport = () => {
    const printContent = document.getElementById('z-report-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Z-Report</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 10px; }
            .header h1 { font-size: 16px; margin: 0; }
            .header p { margin: 2px 0; font-size: 11px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .row.total { font-weight: bold; font-size: 14px; }
            .section-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; text-transform: uppercase; font-size: 11px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintShiftDetails = () => {
    if (!selectedShift) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const salesRows = selectedShiftSales.map((sale, idx) => `
      <tr style="${sale.isVoided ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDateTime(sale.timestamp).time}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${sale.paymentMethod}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${CURRENCY_FORMATTER.format(sale.totalAmount)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Shift Report - ${formatDateTime(selectedShift.startTime).date}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #1e293b; margin-bottom: 5px; }
            .subtitle { color: #64748b; margin-bottom: 20px; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
            .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .stat-label { font-size: 12px; color: #64748b; }
            .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
            .stat-value.green { color: #16a34a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
            .total-row { background: #f1f5f9; font-weight: bold; }
            .total-row td { padding: 12px 8px; }
          </style>
        </head>
        <body>
          <h1>Shift Report</h1>
          <p class="subtitle">${selectedShift.cashierName} • ${formatDateTime(selectedShift.startTime).date} • ${formatDateTime(selectedShift.startTime).time} - ${selectedShift.endTime ? formatDateTime(selectedShift.endTime).time : 'Active'}</p>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Total Sales</div>
              <div class="stat-value">${selectedShiftSales.filter(s => !s.isVoided).length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Revenue</div>
              <div class="stat-value green">${CURRENCY_FORMATTER.format(selectedShiftRevenue - voidedTotal)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Duration</div>
              <div class="stat-value">${calculateShiftDuration(selectedShift.startTime, selectedShift.endTime)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Items</th>
                <th>Payment</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">TOTAL:</td>
                <td style="text-align: right; color: #16a34a;">${CURRENCY_FORMATTER.format(selectedShiftRevenue)}</td>
              </tr>
            </tfoot>
          </table>

          <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            Generated: ${new Date().toLocaleString()}
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportExcel = () => {
    if (!selectedShift) return;
    
    // Create CSV content
    const headers = ['#', 'Time', 'Items', 'Payment Method', 'Amount', 'Status'];
    const rows = selectedShiftSales.map((sale, idx) => [
      idx + 1,
      formatDateTime(sale.timestamp).time,
      sale.items.map(i => `${i.quantity}x ${i.productName}`).join('; '),
      sale.paymentMethod,
      sale.totalAmount,
      sale.isVoided ? 'VOIDED' : 'VALID'
    ]);
    
    // Add summary rows
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Total Sales', selectedShiftSales.filter(s => !s.isVoided).length]);
    rows.push(['Gross Revenue', selectedShiftRevenue]);
    rows.push(['Voided Amount', voidedTotal]);
    rows.push(['Net Revenue', selectedShiftRevenue - voidedTotal]);
    rows.push([]);
    rows.push(['Cash Sales', cashTotal]);
    rows.push(['Card Sales', cardTotal]);
    rows.push(['M-Pesa Sales', mobileTotal]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift-report-${selectedShift.cashierName}-${formatDateTime(selectedShift.startTime).date.replace(/\s/g, '-')}.csv`;
    link.click();
  };

  return (
    <div className="p-3 lg:p-6 max-w-6xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Clock size={24} className="text-amber-500" />
            All Shift Reports
          </h1>
          <p className="text-sm text-slate-500">View shift history for all users</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Users</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards - 6 columns */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
          <p className="text-[10px] text-slate-500 font-medium">Total</p>
          <p className="text-lg font-bold text-slate-800">{allShifts.length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-green-200 text-center">
          <p className="text-[10px] text-green-600 font-medium">Active</p>
          <p className="text-lg font-bold text-green-600">{shifts.filter(s => s.status === 'OPEN').length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
          <p className="text-[10px] text-slate-500 font-medium">Closed</p>
          <p className="text-lg font-bold text-slate-600">{shifts.filter(s => s.status === 'CLOSED').length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
          <p className="text-[10px] text-slate-500 font-medium">Revenue</p>
          <p className="text-sm font-bold text-green-600">{CURRENCY_FORMATTER.format(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
          <p className="text-[10px] text-amber-600 font-medium">Comments</p>
          <p className="text-lg font-bold text-amber-600">{shiftsWithComments.length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
          <p className="text-[10px] text-slate-500 font-medium">Users</p>
          <p className="text-lg font-bold text-slate-800">{new Set(shifts.map(s => s.cashierId)).size}</p>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800">Shift History</h2>
        </div>
        
        {allShifts.length === 0 ? (
          <div className="p-8 text-center">
            <Clock size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No shifts recorded yet</p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {allShifts.map((shift, index) => {
                const shiftSales = getShiftSales(shift.cashierId, shift.startTime, shift.endTime);
                const shiftRevenue = shiftSales.reduce((acc, s) => acc + s.totalAmount, 0);
                const startDT = formatDateTime(shift.startTime);
                const endDT = shift.endTime ? formatDateTime(shift.endTime) : null;
                
                return (
                  <div key={shift.id} className="p-3 hover:bg-slate-50" onClick={() => setSelectedShift(shift)}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-xs">#{index + 1}</span>
                        <span className="font-bold text-amber-600">{shift.cashierName}</span>
                        {shift.status === 'OPEN' && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVE</span>
                        )}
                      </div>
                      <Eye size={16} className="text-amber-500" />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">{startDT.date} • {startDT.time}</span>
                      <span className="font-bold text-green-600">{CURRENCY_FORMATTER.format(shiftRevenue)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{shiftSales.length} sales • {calculateShiftDuration(shift.startTime, shift.endTime)}</div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Sales</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {allShifts.map((shift, index) => {
                    const shiftSales = getShiftSales(shift.cashierId, shift.startTime, shift.endTime);
                    const shiftRevenue = shiftSales.reduce((acc, s) => acc + s.totalAmount, 0);
                    const startDT = formatDateTime(shift.startTime);
                    const endDT = shift.endTime ? formatDateTime(shift.endTime) : null;
                    
                    return (
                      <tr key={shift.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-400">#{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-amber-600">{shift.cashierName}</td>
                        <td className="px-4 py-3 text-slate-800">{startDT.date}</td>
                        <td className="px-4 py-3 text-slate-600">{startDT.time} - {endDT ? endDT.time : 'Now'}</td>
                        <td className="px-4 py-3 text-slate-600">{calculateShiftDuration(shift.startTime, shift.endTime)}</td>
                        <td className="px-4 py-3 font-bold">{shiftSales.length}</td>
                        <td className="px-4 py-3 font-bold text-green-600">{CURRENCY_FORMATTER.format(shiftRevenue)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${shift.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedShift(shift)}
                            className="flex items-center gap-1 text-amber-600 hover:text-amber-800 font-medium"
                          >
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Shift Detail Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 lg:p-6 border-b border-slate-200 flex justify-between items-start bg-gradient-to-r from-amber-500 to-amber-600">
              <div>
                <h2 className="text-xl font-bold text-white">Shift Details</h2>
                <p className="text-sm text-white/80">
                  {selectedShift.cashierName} • {formatDateTime(selectedShift.startTime).date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintShiftDetails}
                  className="p-2 hover:bg-white/20 rounded-lg text-white"
                  title="Print Report"
                >
                  <Printer size={20} />
                </button>
                <button
                  onClick={handleExportExcel}
                  className="p-2 hover:bg-white/20 rounded-lg text-white"
                  title="Export to Excel"
                >
                  <Download size={20} />
                </button>
                <button type="button" onClick={() => setSelectedShift(null)} className="p-2 hover:bg-white/20 rounded-lg">
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Total Sales</p>
                <p className="text-xl font-bold text-slate-800">{selectedShiftSales.filter(s => !s.isVoided).length}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Revenue</p>
                <p className="text-xl font-bold text-green-600">{CURRENCY_FORMATTER.format(selectedShiftRevenue - voidedTotal)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Duration</p>
                <p className="text-xl font-bold text-slate-800">{calculateShiftDuration(selectedShift.startTime, selectedShift.endTime)}</p>
              </div>
            </div>

            {/* Cash Info */}
            <div className="p-4 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Opening Cash</span>
                <p className="font-bold">{CURRENCY_FORMATTER.format(selectedShift.openingCash)}</p>
              </div>
              {selectedShift.status === 'CLOSED' && (
                <>
                  <div>
                    <span className="text-slate-500">Closing Cash</span>
                    <p className="font-bold">{CURRENCY_FORMATTER.format(selectedShift.closingCash || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Expected</span>
                    <p className="font-bold">{CURRENCY_FORMATTER.format(selectedShift.expectedCash || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Difference</span>
                    <p className={`font-bold ${(selectedShift.closingCash || 0) - (selectedShift.expectedCash || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {CURRENCY_FORMATTER.format((selectedShift.closingCash || 0) - (selectedShift.expectedCash || 0))}
                    </p>
                  </div>
                </>
              )}
            </div>

            {selectedShift.comments && (
              <div className="p-4 bg-amber-50 border-b border-amber-100">
                <p className="text-sm font-medium text-amber-800">Comments:</p>
                <p className="text-sm text-amber-700">{selectedShift.comments}</p>
              </div>
            )}

            {/* Sales Table */}
            <div className="flex-1 overflow-auto p-4">
              <h3 className="font-bold text-slate-800 mb-3">Sales ({selectedShiftSales.length})</h3>
              {selectedShiftSales.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No sales during this shift</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">Items</th>
                      <th className="px-3 py-3">Payment</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedShiftSales.map((sale, idx) => (
                      <tr key={sale.id} className={`hover:bg-slate-50 ${sale.isVoided ? 'opacity-50 line-through' : ''}`}>
                        <td className="px-3 py-3 font-mono text-slate-500">#{idx + 1}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDateTime(sale.timestamp).time}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-xs">
                            {sale.items.map((item, i) => (
                              <span key={i} className="text-slate-700">
                                {item.quantity}x {item.productName}{i < sale.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                            sale.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-green-600">{CURRENCY_FORMATTER.format(sale.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold">
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-right">TOTAL:</td>
                      <td className="px-3 py-3 text-right text-green-600 text-lg">{CURRENCY_FORMATTER.format(selectedShiftRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowZReport(true)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <FileText size={18} /> Z-Report
              </button>
              <button
                onClick={() => setSelectedShift(null)}
                className="flex-1 bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Z-Report Preview Modal */}
      {showZReport && selectedShift && (
        <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={20} /> Z-Report Preview
              </h2>
              <button type="button" onClick={() => setShowZReport(false)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Z-Report Content - Receipt Style */}
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div id="z-report-content" className="bg-white p-4 rounded-lg shadow-sm font-mono text-xs max-w-[300px] mx-auto">
                {/* Header */}
                <div className="header text-center mb-3">
                  <h1 className="text-base font-bold">{businessSettings?.businessName || 'Grab Bottle'}</h1>
                  <p className="text-[10px]">{businessSettings?.location || 'Nairobi, Kenya'}</p>
                  <p className="text-[10px]">{businessSettings?.phone || '+254 700 000000'}</p>
                </div>

                <div className="divider border-t border-dashed border-black my-2"></div>

                <div className="text-center font-bold text-sm mb-2">Z-REPORT</div>
                <div className="text-center text-[10px] mb-3">End of Day Summary</div>

                <div className="divider border-t border-dashed border-black my-2"></div>

                {/* Shift Info */}
                <div className="section-title font-bold text-[10px] uppercase mb-1">Shift Information</div>
                <div className="row flex justify-between my-1">
                  <span>Cashier:</span>
                  <span className="font-bold">{selectedShift.cashierName}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>Date:</span>
                  <span>{formatDateTime(selectedShift.startTime).date}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>Start Time:</span>
                  <span>{formatDateTime(selectedShift.startTime).time}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>End Time:</span>
                  <span>{selectedShift.endTime ? formatDateTime(selectedShift.endTime).time : 'Active'}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>Duration:</span>
                  <span>{calculateShiftDuration(selectedShift.startTime, selectedShift.endTime)}</span>
                </div>

                <div className="divider border-t border-dashed border-black my-2"></div>

                {/* Sales Summary */}
                <div className="section-title font-bold text-[10px] uppercase mb-1">Sales Summary</div>
                <div className="row flex justify-between my-1">
                  <span>Total Transactions:</span>
                  <span className="font-bold">{selectedShiftSales.filter(s => !s.isVoided).length}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>Voided Sales:</span>
                  <span className="text-red-600">{selectedShiftVoidedSales.length}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>Items Sold:</span>
                  <span>{selectedShiftSales.filter(s => !s.isVoided).reduce((acc, s) => acc + s.items.reduce((a, i) => a + i.quantity, 0), 0)}</span>
                </div>

                <div className="divider border-t border-dashed border-black my-2"></div>

                {/* Payment Breakdown */}
                <div className="section-title font-bold text-[10px] uppercase mb-1">Payment Breakdown</div>
                <div className="row flex justify-between my-1">
                  <span>💵 Cash ({selectedShiftCashSales.length}):</span>
                  <span>{CURRENCY_FORMATTER.format(cashTotal)}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>💳 Card ({selectedShiftCardSales.length}):</span>
                  <span>{CURRENCY_FORMATTER.format(cardTotal)}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>📱 M-Pesa ({selectedShiftMobileSales.length}):</span>
                  <span>{CURRENCY_FORMATTER.format(mobileTotal)}</span>
                </div>
                {voidedTotal > 0 && (
                  <div className="row flex justify-between my-1 text-red-600">
                    <span>❌ Voided ({selectedShiftVoidedSales.length}):</span>
                    <span>-{CURRENCY_FORMATTER.format(voidedTotal)}</span>
                  </div>
                )}

                <div className="divider border-t border-black my-2"></div>

                {/* Gross Sales */}
                <div className="row total flex justify-between my-1 text-sm font-bold">
                  <span>GROSS SALES:</span>
                  <span>{CURRENCY_FORMATTER.format(selectedShiftRevenue)}</span>
                </div>
                {voidedTotal > 0 && (
                  <div className="row flex justify-between my-1 text-red-600">
                    <span>Less Voids:</span>
                    <span>-{CURRENCY_FORMATTER.format(voidedTotal)}</span>
                  </div>
                )}
                <div className="row total flex justify-between my-1 text-sm font-bold bg-slate-100 p-1 rounded">
                  <span>NET SALES:</span>
                  <span>{CURRENCY_FORMATTER.format(selectedShiftRevenue - voidedTotal)}</span>
                </div>

                <div className="divider border-t border-dashed border-black my-2"></div>

                {/* Cash Drawer */}
                <div className="section-title font-bold text-[10px] uppercase mb-1">Cash Drawer</div>
                <div className="row flex justify-between my-1">
                  <span>Opening Cash:</span>
                  <span>{CURRENCY_FORMATTER.format(selectedShift.openingCash)}</span>
                </div>
                <div className="row flex justify-between my-1">
                  <span>+ Cash Sales:</span>
                  <span className="text-green-600">+{CURRENCY_FORMATTER.format(cashTotal)}</span>
                </div>
                <div className="row flex justify-between my-1 font-bold">
                  <span>Expected Cash:</span>
                  <span>{CURRENCY_FORMATTER.format(selectedShift.expectedCash || (selectedShift.openingCash + cashTotal))}</span>
                </div>
                {selectedShift.status === 'CLOSED' && (
                  <>
                    <div className="row flex justify-between my-1">
                      <span>Closing Cash:</span>
                      <span>{CURRENCY_FORMATTER.format(selectedShift.closingCash || 0)}</span>
                    </div>
                    <div className="row flex justify-between my-1 font-bold">
                      <span>Difference:</span>
                      <span className={(selectedShift.closingCash || 0) - (selectedShift.expectedCash || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(selectedShift.closingCash || 0) - (selectedShift.expectedCash || 0) >= 0 ? '+' : ''}
                        {CURRENCY_FORMATTER.format((selectedShift.closingCash || 0) - (selectedShift.expectedCash || 0))}
                      </span>
                    </div>
                  </>
                )}

                <div className="divider border-t border-dashed border-black my-2"></div>

                {/* Footer */}
                <div className="text-center text-[10px] mt-3">
                  <p>Report Generated: {new Date().toLocaleString()}</p>
                  <p className="mt-1">*** END OF Z-REPORT ***</p>
                </div>
              </div>
            </div>

            {/* Print Button */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <button
                onClick={handlePrintZReport}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Print Z-Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminShiftReports;
