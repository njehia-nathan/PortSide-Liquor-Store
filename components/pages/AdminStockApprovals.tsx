'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { StockChangeRequest } from '../../types';
import { AlertCircle, Check, X, Filter, Eye, Package, TrendingUp, TrendingDown } from 'lucide-react';

const AdminStockApprovals = () => {
  const { stockChangeRequests, approveStockChange, rejectStockChange } = useStore();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<StockChangeRequest | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredRequests = useMemo(() => {
    if (filter === 'ALL') return stockChangeRequests;
    return stockChangeRequests.filter(r => r.status === filter);
  }, [stockChangeRequests, filter]);

  const pendingCount = stockChangeRequests.filter(r => r.status === 'PENDING').length;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const handleApprove = async (requestId: string) => {
    setIsProcessing(true);
    await approveStockChange(requestId, actionNotes || undefined);
    setSelectedRequest(null);
    setActionNotes('');
    setIsProcessing(false);
  };

  const handleReject = async (requestId: string) => {
    setIsProcessing(true);
    await rejectStockChange(requestId, actionNotes || undefined);
    setSelectedRequest(null);
    setActionNotes('');
    setIsProcessing(false);
  };

  return (
    <div className="p-3 lg:p-6 max-w-6xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package size={24} className="text-blue-500" />
            Stock Change Approvals
            {pendingCount > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-sm rounded-full animate-pulse">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">Review and approve inventory stock change requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All Requests</option>
          </select>
        </div>
      </div>

      {/* Summary Cards - Enhanced 6 column layout like Void Approvals */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
        <div className="bg-white rounded-lg p-3 lg:p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow text-center">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Total</p>
          <p className="text-xl lg:text-2xl font-bold text-slate-800 mt-1">{stockChangeRequests.length}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 lg:p-4 border border-amber-200 shadow-sm hover:shadow-md transition-shadow text-center">
          <p className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">Pending</p>
          <p className="text-xl lg:text-2xl font-bold text-amber-600 mt-1">{stockChangeRequests.filter(r => r.status === 'PENDING').length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 lg:p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow text-center">
          <p className="text-[10px] text-green-700 font-medium uppercase tracking-wide">Approved</p>
          <p className="text-xl lg:text-2xl font-bold text-green-600 mt-1">{stockChangeRequests.filter(r => r.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 lg:p-4 border border-red-200 shadow-sm hover:shadow-md transition-shadow text-center">
          <p className="text-[10px] text-red-700 font-medium uppercase tracking-wide">Rejected</p>
          <p className="text-xl lg:text-2xl font-bold text-red-600 mt-1">{stockChangeRequests.filter(r => r.status === 'REJECTED').length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 lg:p-4 border border-blue-200 shadow-sm hover:shadow-md transition-shadow text-center col-span-2 lg:col-span-2">
          <p className="text-[10px] text-blue-700 font-medium uppercase tracking-wide">Total Stock Changes</p>
          <p className="text-xl lg:text-2xl font-bold text-blue-600 mt-1">
            {stockChangeRequests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + Math.abs(r.quantityChange), 0)} units
          </p>
        </div>
      </div>

      {/* Requests Table/Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No {filter.toLowerCase()} stock change requests</p>
          </div>
        ) : (
          <>
            {/* Mobile Grid View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredRequests.map((request, index) => {
                const reqDT = formatDateTime(request.requestedAt);
                return (
                  <div 
                    key={request.id} 
                    className="p-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-xs">#{index + 1}</span>
                        <span className="font-bold text-slate-800">{request.productName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        request.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>{request.status}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">{request.changeType}</span>
                      <span className={`font-bold ${request.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {request.quantityChange > 0 ? '+' : ''}{request.quantityChange}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{reqDT.date} • {reqDT.time}</p>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">Current Stock</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRequests.map((request, index) => {
                    const reqDT = formatDateTime(request.requestedAt);
                    return (
                      <tr key={request.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-400">#{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{request.productName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            request.changeType === 'RECEIVE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {request.changeType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold flex items-center gap-1 ${request.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {request.quantityChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {request.quantityChange > 0 ? '+' : ''}{request.quantityChange}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{request.currentStock}</td>
                        <td className="px-4 py-3 text-slate-600">{request.requestedByName}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{reqDT.date} {reqDT.time}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            request.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                            request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>{request.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedRequest(request)}
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

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`p-4 border-b flex justify-between items-center ${
              selectedRequest.status === 'PENDING' ? 'bg-amber-500' :
              selectedRequest.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package size={20} /> Stock Change Request
              </h2>
              <button onClick={() => { setSelectedRequest(null); setActionNotes(''); }} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Status Badge */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Request #{selectedRequest.id.slice(-8)}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  selectedRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                  selectedRequest.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>{selectedRequest.status}</span>
              </div>

              {/* Request Info */}
              <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Product</p>
                  <p className="font-bold">{selectedRequest.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Change Type</p>
                  <p className="font-bold">
                    <span className={`px-2 py-1 rounded text-xs ${
                      selectedRequest.changeType === 'RECEIVE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {selectedRequest.changeType}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Current Stock</p>
                  <p className="font-bold">{selectedRequest.currentStock}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Change Amount</p>
                  <p className={`font-bold text-lg ${selectedRequest.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRequest.quantityChange > 0 ? '+' : ''}{selectedRequest.quantityChange}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Requested By</p>
                  <p className="font-bold">{selectedRequest.requestedByName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Request Date</p>
                  <p className="font-bold">{formatDateTime(selectedRequest.requestedAt).date}</p>
                </div>
                {selectedRequest.newCost && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">New Cost Price</p>
                    <p className="font-bold text-green-600">${selectedRequest.newCost.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {/* Reason */}
              {selectedRequest.reason && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 mb-1 font-medium">Reason:</p>
                  <p className="text-sm text-blue-800">{selectedRequest.reason}</p>
                </div>
              )}

              {/* Review Info (if reviewed) */}
              {selectedRequest.reviewedAt && (
                <div className={`rounded-lg p-3 border ${selectedRequest.status === 'APPROVED' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-xs text-slate-500 mb-1">
                    {selectedRequest.status === 'APPROVED' ? 'Approved' : 'Rejected'} by <span className="font-bold">{selectedRequest.reviewedByName}</span>
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(selectedRequest.reviewedAt).date} at {formatDateTime(selectedRequest.reviewedAt).time}</p>
                  {selectedRequest.reviewNotes && (
                    <p className="text-sm text-slate-700 mt-2 bg-white/50 rounded p-2">Notes: {selectedRequest.reviewNotes}</p>
                  )}
                </div>
              )}

              {/* Action Section (for pending requests) */}
              {selectedRequest.status === 'PENDING' && (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Add notes (optional)..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(selectedRequest.id)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <X size={18} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => { setSelectedRequest(null); setActionNotes(''); }}
                className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStockApprovals;
