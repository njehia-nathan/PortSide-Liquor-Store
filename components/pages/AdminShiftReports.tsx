'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { CURRENCY_FORMATTER } from '../../constants';
import { Clock, Calendar, DollarSign, Users, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

const AdminShiftReports = () => {
  const { shifts, sales, users } = useStore();
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');

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

  return (
    <div className="p-3 lg:p-6 max-w-5xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">All Shift Reports</h1>
          <p className="text-sm text-slate-500">View shift history for all users</p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Clock size={16} />
            <span className="text-xs font-medium">Total Shifts</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{allShifts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Users size={16} />
            <span className="text-xs font-medium">Active Now</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{shifts.filter(s => s.status === 'OPEN').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <DollarSign size={16} />
            <span className="text-xs font-medium">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-green-600">{CURRENCY_FORMATTER.format(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <MessageSquare size={16} />
            <span className="text-xs font-medium">With Comments</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{shiftsWithComments.length}</p>
        </div>
      </div>

      {/* Shifts List */}
      <div className="space-y-3">
        <h2 className="font-bold text-slate-800">Shift History</h2>
        
        {allShifts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
            <Clock size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No shifts recorded yet</p>
          </div>
        ) : (
          allShifts.map(shift => {
            const shiftSales = getShiftSales(shift.cashierId, shift.startTime, shift.endTime);
            const shiftRevenue = shiftSales.reduce((acc, s) => acc + s.totalAmount, 0);
            const isExpanded = expandedShift === shift.id;
            const startDT = formatDateTime(shift.startTime);
            const endDT = shift.endTime ? formatDateTime(shift.endTime) : null;

            return (
              <div key={shift.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${shift.status === 'OPEN' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                    <div className="text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-amber-600">{shift.cashierName}</span>
                        <span className="text-slate-400">•</span>
                        <Calendar size={14} className="text-slate-400" />
                        <span className="font-medium text-slate-800">{startDT.date}</span>
                        {shift.status === 'OPEN' && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVE</span>
                        )}
                        {shift.comments && (
                          <MessageSquare size={14} className="text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {startDT.time} - {endDT ? endDT.time : 'Now'}
                        </span>
                        <span>({calculateShiftDuration(shift.startTime, shift.endTime)})</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-green-600">{CURRENCY_FORMATTER.format(shiftRevenue)}</p>
                      <p className="text-xs text-slate-500">{shiftSales.length} sales</p>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <div className="p-4 bg-slate-50 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Opening Cash</span>
                        <p className="font-bold">{CURRENCY_FORMATTER.format(shift.openingCash)}</p>
                      </div>
                      {shift.status === 'CLOSED' && (
                        <>
                          <div>
                            <span className="text-slate-500">Closing Cash</span>
                            <p className="font-bold">{CURRENCY_FORMATTER.format(shift.closingCash || 0)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Expected Cash</span>
                            <p className="font-bold">{CURRENCY_FORMATTER.format(shift.expectedCash || 0)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Difference</span>
                            <p className={`font-bold ${(shift.closingCash || 0) - (shift.expectedCash || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {CURRENCY_FORMATTER.format((shift.closingCash || 0) - (shift.expectedCash || 0))}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {shift.comments && (
                      <div className="p-4 bg-amber-50 border-t border-amber-100">
                        <p className="text-sm font-medium text-amber-800">Shift Comments:</p>
                        <p className="text-sm text-amber-700">{shift.comments}</p>
                      </div>
                    )}

                    <div className="p-4">
                      <h4 className="font-medium text-slate-700 mb-3">Sales During This Shift</h4>
                      {shiftSales.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No sales during this shift</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {shiftSales.map(sale => (
                            <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                              <div>
                                <span className="font-mono text-xs text-slate-500">#{sale.id.slice(-8)}</span>
                                <p className="text-sm font-medium">
                                  {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                </p>
                                <span className="text-xs text-slate-400">
                                  {formatDateTime(sale.timestamp).time} • {sale.paymentMethod}
                                </span>
                              </div>
                              <span className="font-bold text-green-600">{CURRENCY_FORMATTER.format(sale.totalAmount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminShiftReports;
