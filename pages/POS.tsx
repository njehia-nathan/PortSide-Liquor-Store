import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { AlcoholType, Product, CartItem, SaleItem, Sale } from '../types';
import { CURRENCY_FORMATTER } from '../constants';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, LogOut, Receipt, Printer, X, Clock } from 'lucide-react';

const POS = () => {
  const { products, sales, processSale, currentShift, openShift, closeShift, logout } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AlcoholType | 'ALL'>('ALL');
  
  // Modal states
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftCashAmount, setShiftCashAmount] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  
  // Receipt State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search);
      const matchesType = filter === 'ALL' || p.type === filter;
      return matchesSearch && matchesType;
    });
  }, [products, search, filter]);

  // Cart Logic
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const adjustQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);

  const handlePayment = async (method: 'CASH' | 'CARD' | 'MOBILE') => {
    const saleItems: SaleItem[] = cart.map(c => ({
      productId: c.id,
      productName: c.name,
      size: c.size,
      quantity: c.quantity,
      priceAtSale: c.sellingPrice,
      costAtSale: c.costPrice
    }));
    
    // Fix: processSale is async, we must await it to get the Sale object
    // otherwise we get a Promise, which causes errors when accessing properties like .id
    const newSale = await processSale(saleItems, method);
    
    if (newSale) {
        setReceiptSale(newSale);
        setShowReceiptModal(true);
        setCart([]);
        setPaymentModalOpen(false);
    }
  };

  const viewLastTransaction = () => {
      if (sales.length > 0) {
          setReceiptSale(sales[0]);
          setShowReceiptModal(true);
      }
  };

  const handlePrint = () => {
      window.print();
  };

  // Shift Logic Handlers
  const handleOpenShift = () => {
    // Open shift with 0 float since there is no cash register
    openShift(0);
    setShowShiftModal(false);
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(shiftCashAmount);
    if (isNaN(amount)) return;

    await closeShift(amount);
    logout(); // Enforce logout on shift close
    setShiftCashAmount('');
  };

  // Force shift modal if closed
  useEffect(() => {
    if (!currentShift) {
        setShowShiftModal(true);
    }
  }, [currentShift]);


  if (showShiftModal && !currentShift) {
      return (
          <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock size={32} /> 
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Ready to Start?</h2>
                  <p className="text-slate-500 mb-6">Start your shift to begin processing sales.</p>
                  
                  <button 
                    onClick={handleOpenShift}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-lg transition-transform active:scale-95"
                  >
                      Start Shift
                  </button>
              </div>
          </div>
      )
  }

  return (
    <div className="flex h-full">
      {/* Left: Product Catalog */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 print:hidden">
        {/* Header/Filter */}
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Scan barcode or search product..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['ALL', ...Object.values(AlcoholType)].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === type 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => {
              const threshold = product.lowStockThreshold || 5;
              const isLowStock = product.stock <= threshold;
              const isOutOfStock = product.stock <= 0;

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className={`flex flex-col items-start p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md active:scale-95 text-left ${
                      isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="w-full flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{product.type}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {product.stock} left
                      </span>
                  </div>
                  <h3 className="font-bold text-slate-900 leading-tight mb-1">{product.name}</h3>
                  <p className="text-sm text-slate-500 mb-3">{product.size}</p>
                  <div className="mt-auto w-full flex justify-between items-end">
                      <span className="text-lg font-bold text-slate-900">{CURRENCY_FORMATTER.format(product.sellingPrice)}</span>
                      <div className="bg-slate-100 p-1.5 rounded-lg">
                          <Plus size={16} className="text-slate-600" />
                      </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart (Sidebar on Desktop) */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-20 print:hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-lg text-slate-800">Current Order</h2>
            {sales.length > 0 && (
                <button onClick={viewLastTransaction} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-bold">
                    <Receipt size={16} /> Last Sale
                </button>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ShoppingCartIcon size={48} className="mb-4 opacity-20" />
                <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">{item.name}</h4>
                  <p className="text-xs text-slate-500">{item.size} • {CURRENCY_FORMATTER.format(item.sellingPrice)}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center border rounded-lg">
                        <button onClick={() => adjustQty(item.id, -1)} className="p-2 hover:bg-slate-100 text-slate-600"><Minus size={14} /></button>
                        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                        <button onClick={() => adjustQty(item.id, 1)} className="p-2 hover:bg-slate-100 text-slate-600"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={18} />
                    </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Action */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Items</span>
            <span>{cart.reduce((acc, i) => acc + i.quantity, 0)}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold text-slate-900 mb-2">
            <span>Total</span>
            <span>{CURRENCY_FORMATTER.format(cartTotal)}</span>
          </div>
          
          <button 
            disabled={cart.length === 0}
            onClick={() => setPaymentModalOpen(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-xl shadow-lg shadow-amber-500/30 transition-all active:scale-95"
          >
            Pay {CURRENCY_FORMATTER.format(cartTotal)}
          </button>
          
          <div className="flex gap-2">
             <button 
                onClick={() => setCart([])} 
                className="flex-1 border border-slate-300 text-slate-600 py-3 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                disabled={cart.length === 0}
             >
                Clear
            </button>
            <button 
                onClick={() => setShowShiftModal(true)}
                className="flex-1 border border-red-200 text-red-600 py-3 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
                <LogOut size={16} />
                Close Shift
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center print:hidden">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-xl font-bold text-center">Confirm Payment</h2>
                    <p className="text-center text-3xl font-bold text-amber-600 mt-2">{CURRENCY_FORMATTER.format(cartTotal)}</p>
                </div>
                <div className="p-6 grid grid-cols-1 gap-4">
                    <button onClick={() => handlePayment('CASH')} className="flex items-center justify-center gap-4 p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group">
                        <Banknote size={32} className="text-slate-400 group-hover:text-green-600" />
                        <span className="text-xl font-bold text-slate-700 group-hover:text-green-700">Cash</span>
                    </button>
                    <button onClick={() => handlePayment('CARD')} className="flex items-center justify-center gap-4 p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
                        <CreditCard size={32} className="text-slate-400 group-hover:text-blue-600" />
                        <span className="text-xl font-bold text-slate-700 group-hover:text-blue-700">Card</span>
                    </button>
                    <button onClick={() => handlePayment('MOBILE')} className="flex items-center justify-center gap-4 p-6 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group">
                        <Smartphone size={32} className="text-slate-400 group-hover:text-purple-600" />
                        <span className="text-xl font-bold text-slate-700 group-hover:text-purple-700">Mobile Money</span>
                    </button>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button onClick={() => setPaymentModalOpen(false)} className="w-full py-3 text-slate-500 font-bold hover:text-slate-800">Cancel</button>
                </div>
            </div>
        </div>
      )}

      {/* Close Shift Modal (Still requires count) */}
      {showShiftModal && currentShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
                <h2 className="text-2xl font-bold mb-2 text-slate-800">Close Shift</h2>
                <p className="text-slate-500 mb-6">Count cash collected and enter amount to finalize. <br/> <strong className="text-red-600">This will log you out.</strong></p>
                <form onSubmit={handleCloseShift}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Closing Cash Count (KES)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full text-2xl p-3 border rounded-lg mb-6 border-slate-300" 
                      value={shiftCashAmount}
                      onChange={e => setShiftCashAmount(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      required
                    />
                    <button className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold text-lg">
                        Confirm & Logout
                    </button>
                    <button 
                        type="button" 
                        onClick={() => { setShowShiftModal(false); setShiftCashAmount(''); }}
                        className="w-full mt-4 text-slate-500 font-medium py-2"
                    >
                        Cancel
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* RECEIPT MODAL & PRINTING */}
      {showReceiptModal && receiptSale && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:fixed print:inset-0 print:z-[9999] print:bg-white print:p-0 print:flex print:items-start print:justify-center">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden print:shadow-none print:w-full print:max-w-none">
                  
                  {/* Print Content Container */}
                  <div className="p-8 pb-4 text-center print:p-8">
                      <h2 className="text-2xl font-bold mb-1">Port Side Liquor</h2>
                      <p className="text-xs text-slate-500 mb-4">Westlands, Nairobi • +254 700 000000</p>
                      
                      <div className="border-t border-b border-dashed border-slate-300 py-4 my-4 space-y-1 text-sm text-left">
                          <div className="flex justify-between">
                              <span className="text-slate-500">Receipt #:</span>
                              <span className="font-mono font-bold">{receiptSale.id.slice(-6)}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Date:</span>
                              <span>{new Date(receiptSale.timestamp).toLocaleDateString()} {new Date(receiptSale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Cashier:</span>
                              <span>{receiptSale.cashierName}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Payment:</span>
                              <span className="font-bold">{receiptSale.paymentMethod}</span>
                          </div>
                      </div>

                      <div className="space-y-2 mb-6 text-left">
                          {receiptSale.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                  <div>
                                      <p className="font-bold text-slate-800">{item.productName}</p>
                                      <p className="text-xs text-slate-500">{item.quantity} x {CURRENCY_FORMATTER.format(item.priceAtSale)}</p>
                                  </div>
                                  <div className="font-bold">
                                      {CURRENCY_FORMATTER.format(item.quantity * item.priceAtSale)}
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="border-t-2 border-slate-800 pt-4 flex justify-between items-end mb-6">
                          <span className="text-xl font-bold">Total</span>
                          <span className="text-2xl font-bold">{CURRENCY_FORMATTER.format(receiptSale.totalAmount)}</span>
                      </div>

                      <p className="text-xs text-slate-500 italic text-center">Thank you for your business!</p>
                  </div>

                  {/* Action Buttons (Hidden when printing) */}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-4 print:hidden">
                      <button onClick={handlePrint} className="flex-1 bg-slate-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800">
                          <Printer size={18} /> Print
                      </button>
                      <button onClick={() => setShowReceiptModal(false)} className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-600 hover:bg-white">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const ShoppingCartIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
);

export default POS;