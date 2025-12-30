'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { CURRENCY_FORMATTER } from '../../constants';
import { AlertCircle, Check, X, Clock, Filter } from 'lucide-react';

const AdminVoidApprovals = () => {
  const { voidRequests, approveVoid, rejectVoid } = useStore();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredRequests = useMemo(() => {
    if (filter === 'ALL') return voidRequests;
    return voidRequests.filter(r => r.status === filter);
  }, [voidRequests, filter]);

  const pendingCount = voidRequests.filter(r => r.status === 'PENDING').length;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const handleApprove = async (requestId: string) => {
    setIsProcessing(true);
    await approveVoid(requestId, actionNotes || undefined);
    setSelectedRequest(null);
    setActionNotes('');
    setIsProcessing(false);
  };

  const handleReject = async (requestId: string) => {
    setIsProcessing(true);
    await rejectVoid(requestId, actionNotes || undefined);
    setSelectedRequest(null);
    setActionNotes('');
    setIsProcessing(false);
  };

  return (
    <div className="p-3 lg:p-6 max-w-5xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            Void Approvals
            {pendingCount > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-sm rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">Review and approve void sale requests</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Clock size={16} />
            <span className="text-xs font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{voidRequests.filter(r => r.status === 'PENDING').length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Check size={16} />
            <span className="text-xs font-medium">Approved</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{voidRequests.filter(r => r.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <X size={16} />
            <span className="text-xs font-medium">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{voidRequests.filter(r => r.status === 'REJECTED').length}</p>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
            <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No {filter.toLowerCase()} void requests</p>
          </div>
        ) : (
          filteredRequests.map(request => {
            const reqDT = formatDateTime(request.requestedAt);
            const isSelected = selectedRequest === request.id;

            return (
              <div key={request.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Sale #{request.saleId.slice(-8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          request.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Requested by <span className="font-medium">{request.requestedByName}</span> • {reqDT.date} at {reqDT.time}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-slate-800">
                      {CURRENCY_FORMATTER.format(request.sale.totalAmount)}
                    </span>
                  </div>

                  {/* Sale Items */}
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-slate-500 mb-2">Sale Items:</p>
                    <div className="space-y-1">
                      {request.sale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.productName}</span>
                          <span className="text-slate-600">{CURRENCY_FORMATTER.format(item.priceAtSale * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Void Reason */}
                  <div className="bg-amber-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-amber-600 mb-1 font-medium">Reason for Void:</p>
                    <p className="text-sm text-amber-800">{request.reason}</p>
                  </div>

                  {/* Review Info (if reviewed) */}
                  {request.reviewedAt && (
                    <div className={`rounded-lg p-3 mb-3 ${request.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-slate-500 mb-1">
                        {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {request.reviewedByName} • {formatDateTime(request.reviewedAt).date}
                      </p>
                      {request.reviewNotes && (
                        <p className="text-sm text-slate-700">Notes: {request.reviewNotes}</p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons (for pending requests) */}
                  {request.status === 'PENDING' && (
                    <>
                      {isSelected ? (
                        <div className="space-y-3 border-t border-slate-200 pt-3">
                          <textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Add notes (optional)..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={isProcessing}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Check size={16} />
                              Approve Void
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              disabled={isProcessing}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <X size={16} />
                              Reject
                            </button>
                            <button
                              onClick={() => { setSelectedRequest(null); setActionNotes(''); }}
                              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedRequest(request.id)}
                          className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
                        >
                          Review Request
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminVoidApprovals;
