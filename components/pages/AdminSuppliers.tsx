'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Truck, Calendar, Download, FileText, Search } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../constants';

const AdminSuppliers = () => {
  const { stockChangeRequests, products, businessSettings } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Unique suppliers
  const suppliers = useMemo(() => {
    const names = new Set<string>();
    if (stockChangeRequests) {
      stockChangeRequests.forEach(r => {
        if (r.supplierName) names.add(r.supplierName);
      });
    }
    products.forEach(p => {
      if (p.supplier) names.add(p.supplier);
    });
    return Array.from(names).sort();
  }, [stockChangeRequests, products]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [suppliers, searchTerm]);

  // Invoice Data for selected supplier
  const invoiceData = useMemo(() => {
    if (!selectedSupplier) return [];

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return (stockChangeRequests || [])
      .filter(r => 
        r.supplierName === selectedSupplier && 
        r.changeType === 'RECEIVE' &&
        new Date(r.requestedAt) >= start &&
        new Date(r.requestedAt) <= end
      )
      .map(r => {
        const product = products.find(p => p.id === r.productId);
        const costPrice = r.newCost !== undefined ? r.newCost : (product?.costPrice || 0);
        const total = costPrice * r.quantityChange;
        return {
          ...r,
          costPrice,
          total
        };
      })
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  }, [selectedSupplier, startDate, endDate, stockChangeRequests, products]);

  const invoiceTotal = useMemo(() => invoiceData.reduce((sum, item) => sum + item.total, 0), [invoiceData]);

  const exportInvoiceCSV = () => {
    if (!selectedSupplier || invoiceData.length === 0) return;

    const headers = ['Date', 'Receipt ID', 'Product', 'Quantity', 'Unit Cost', 'Total'];
    const rows = invoiceData.map(item => [
      new Date(item.requestedAt).toLocaleDateString(),
      item.id.slice(-8),
      `"${item.productName}"`,
      item.quantityChange,
      item.costPrice,
      item.total
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${selectedSupplier.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printInvoice = () => {
    if (!selectedSupplier || invoiceData.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Invoice - ${selectedSupplier}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .bus-info h1 { margin: 0 0 5px 0; color: #0f172a; }
            .bus-info p { margin: 0; color: #64748b; }
            .inv-details { text-align: right; }
            .inv-details h2 { margin: 0 0 5px 0; color: #3b82f6; }
            table { w-full; width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; font-size: 1.2em; }
            .footer { margin-top: 60px; text-align: center; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="bus-info">
              <h1>${businessSettings?.businessName || 'Point of Sale'}</h1>
              <p>Generated: ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="inv-details">
              <h2>INVOICE</h2>
              <p>Supplier: <strong>${selectedSupplier}</strong></p>
              <p>Period: ${startDate} to ${endDate}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt ID</th>
                <th>Product</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Unit Cost</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceData.map(item => `
                <tr>
                  <td>${new Date(item.requestedAt).toLocaleString()}</td>
                  <td>#${item.id.slice(-8)}</td>
                  <td>${item.productName}</td>
                  <td class="text-right">${item.quantityChange}</td>
                  <td class="text-right">${CURRENCY_FORMATTER.format(item.costPrice)}</td>
                  <td class="text-right">${CURRENCY_FORMATTER.format(item.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" class="text-right">Total Due:</td>
                <td class="text-right">${CURRENCY_FORMATTER.format(invoiceTotal)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>Thank you for supplying ${businessSettings?.businessName || 'us'}.</p>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-64px)] lg:h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Truck size={20} className="text-white" />
            </div>
            Suppliers & Invoices
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage suppliers and generate payables invoices</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left Column: Suppliers List */}
        <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[300px]">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search suppliers..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Truck size={32} className="mx-auto mb-3 opacity-20" />
                <p>No suppliers found.</p>
                <p className="text-xs mt-1">Suppliers are created automatically when receiving stock.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredSuppliers.map(supplier => (
                  <button
                    key={supplier}
                    onClick={() => setSelectedSupplier(supplier)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between ${selectedSupplier === supplier ? 'bg-indigo-50/50 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                  >
                    <span className="font-semibold text-slate-700">{supplier}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Invoice Details */}
        <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden min-h-[400px]">
          {selectedSupplier ? (
            <>
              {/* Invoice Header Options */}
              <div className="p-4 lg:p-6 border-b border-slate-200 bg-slate-50/50 shrink-0">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedSupplier}</h2>
                    <p className="text-sm text-slate-500">Invoice Generation</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <Calendar size={16} className="text-slate-400" />
                      <input 
                        type="date" 
                        className="text-sm border-none outline-none bg-transparent"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                      />
                      <span className="text-slate-400 text-sm">to</span>
                      <input 
                        type="date" 
                        className="text-sm border-none outline-none bg-transparent"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                    </div>
                    
                    <button 
                      onClick={printInvoice}
                      disabled={invoiceData.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors"
                    >
                      <FileText size={16} /> Print
                    </button>
                    <button 
                      onClick={exportInvoiceCSV}
                      disabled={invoiceData.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Download size={16} /> CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Invoice Table */}
              <div className="flex-1 overflow-auto p-0">
                {invoiceData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 space-y-3">
                    <FileText size={48} className="opacity-20" />
                    <p className="text-lg font-medium">No stock receipts found</p>
                    <p className="text-sm text-center">Try selecting a different date range or supplier.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">Date/Time</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">Receipt ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">Product</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 text-right">Qty</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 text-right">Unit Cost</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceData.map((item, idx) => (
                        <tr key={item.id + idx} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(item.requestedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500">
                            #{item.id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {item.productName}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 text-right">
                            {item.quantityChange}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 text-right">
                            {CURRENCY_FORMATTER.format(item.costPrice)}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                            {CURRENCY_FORMATTER.format(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 sticky bottom-0 border-t border-slate-200">
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-sm font-bold text-slate-600 text-right uppercase">
                          Total Due:
                        </td>
                        <td className="px-6 py-4 text-lg font-bold text-blue-600 text-right w-48">
                          {CURRENCY_FORMATTER.format(invoiceTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
              <Truck size={48} className="mb-4 opacity-20" />
              <p className="text-lg">Select a supplier</p>
              <p className="text-sm mt-1">Choose a supplier from the list to view and generate invoices.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSuppliers;
