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
  
  // Mobile cart drawer state
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

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
    <div className="flex flex-col lg:flex-row h-full">
      {/* Left: Product Catalog */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 print:hidden pb-20 lg:pb-0">
        {/* Header/Filter */}
        <div className="p-3 lg:p-4 bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="relative mb-3 lg:mb-4">
            <Search className="absolute left-3 top-2.5 lg:top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search product..." 
              className="w-full pl-10 pr-4 py-2 lg:py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 lg:gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {['ALL', ...Object.values(AlcoholType)].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type as any)}
                className={`px-3 lg:px-4 py-1 lg:py-1.5 rounded-full text-xs lg:text-sm font-medium whitespace-nowrap transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-2 lg:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-4">
            {filteredProducts.map(product => {
              const threshold = product.lowStockThreshold || 5;
              const isLowStock = product.stock <= threshold;
              const isOutOfStock = product.stock <= 0;

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className={`flex flex-col items-start p-2.5 lg:p-4 rounded-lg lg:rounded-xl border bg-white shadow-sm transition-all hover:shadow-md active:scale-95 text-left ${
                      isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="w-full flex justify-between items-start mb-1 lg:mb-2">
                      <span className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{product.type}</span>
                      <span className={`text-[10px] lg:text-xs font-bold px-1.5 lg:px-2 py-0.5 rounded ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {product.stock}
                      </span>
                  </div>
                  <h3 className="font-bold text-slate-900 leading-tight mb-0.5 lg:mb-1 text-sm lg:text-base line-clamp-2">{product.name}</h3>
                  <p className="text-xs lg:text-sm text-slate-500 mb-2 lg:mb-3">{product.size}</p>
                  <div className="mt-auto w-full flex justify-between items-end">
                      <span className="text-sm lg:text-lg font-bold text-slate-900">{CURRENCY_FORMATTER.format(product.sellingPrice)}</span>
                      <div className="bg-slate-100 p-1 lg:p-1.5 rounded-lg">
                          <Plus size={14} className="text-slate-600 lg:hidden" />
                          <Plus size={16} className="text-slate-600 hidden lg:block" />
                      </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Cart Button - Fixed at bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 p-3 print:hidden">
        <button
          onClick={() => setMobileCartOpen(true)}
          className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg"
        >
          <div className="relative">
            <ShoppingCartIcon size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cart.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </div>
          <span>View Cart • {CURRENCY_FORMATTER.format(cartTotal)}</span>
        </button>
      </div>

      {/* Mobile Cart Overlay */}
      {mobileCartOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 print:hidden" 
          onClick={() => setMobileCartOpen(false)}
        />
      )}

      {/* Right: Cart (Sidebar on Desktop, Drawer on Mobile) */}
      <div className={`
        fixed lg:static inset-x-0 bottom-0 lg:inset-auto
        w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col 
        max-h-[85vh] lg:max-h-none lg:h-full shadow-xl z-50 print:hidden
        transform transition-transform duration-300 ease-in-out
        ${mobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        rounded-t-2xl lg:rounded-none
      `}>
        {/* Mobile drag handle */}
        <div className="lg:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
        </div>
        
        <div className="p-3 lg:p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-base lg:text-lg text-slate-800">Current Order</h2>
            <div className="flex items-center gap-2">
              {sales.length > 0 && (
                  <button onClick={viewLastTransaction} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs lg:text-sm font-bold">
                      <Receipt size={14} /> Last Sale
                  </button>
              )}
              <button 
                onClick={() => setMobileCartOpen(false)} 
                className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
          {cart.length === 0 ? (
            <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-slate-400">
                <ShoppingCartIcon size={40} className="mb-3 opacity-20" />
                <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-2 lg:gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm lg:text-base truncate">{item.name}</h4>
                  <p className="text-xs text-slate-500">{item.size} • {CURRENCY_FORMATTER.format(item.sellingPrice)}</p>
                </div>
                <div className="flex items-center gap-2 lg:gap-3">
                    <div className="flex items-center border rounded-lg">
                        <button onClick={() => adjustQty(item.id, -1)} className="p-1.5 lg:p-2 hover:bg-slate-100 text-slate-600"><Minus size={12} /></button>
                        <span className="w-6 lg:w-8 text-center font-bold text-xs lg:text-sm">{item.quantity}</span>
                        <button onClick={() => adjustQty(item.id, 1)} className="p-1.5 lg:p-2 hover:bg-slate-100 text-slate-600"><Plus size={12} /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Action */}
        <div className="p-3 lg:p-4 border-t border-slate-200 bg-slate-50 space-y-2 lg:space-y-3">
          <div className="flex justify-between text-xs lg:text-sm text-slate-500">
            <span>Items</span>
            <span>{cart.reduce((acc, i) => acc + i.quantity, 0)}</span>
          </div>
          <div className="flex justify-between text-xl lg:text-2xl font-bold text-slate-900 mb-1 lg:mb-2">
            <span>Total</span>
            <span>{CURRENCY_FORMATTER.format(cartTotal)}</span>
          </div>
          
          <button 
            disabled={cart.length === 0}
            onClick={() => { setPaymentModalOpen(true); setMobileCartOpen(false); }}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 lg:py-4 rounded-xl font-bold text-lg lg:text-xl shadow-lg shadow-amber-500/30 transition-all active:scale-95"
          >
            Pay {CURRENCY_FORMATTER.format(cartTotal)}
          </button>
          
          <div className="flex gap-2">
             <button 
                onClick={() => setCart([])} 
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 lg:py-3 rounded-lg text-xs lg:text-sm font-bold hover:bg-slate-50 transition-colors"
                disabled={cart.length === 0}
             >
                Clear
            </button>
            <button 
                onClick={() => setShowShiftModal(true)}
                className="flex-1 border border-red-200 text-red-600 py-2.5 lg:py-3 rounded-lg text-xs lg:text-sm font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1 lg:gap-2"
            >
                <LogOut size={14} />
                Close Shift
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end lg:items-center justify-center print:hidden p-0 lg:p-4">
            <div className="bg-white rounded-t-2xl lg:rounded-xl shadow-2xl w-full lg:max-w-lg overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-lg lg:text-xl font-bold text-center">Confirm Payment</h2>
                    <p className="text-center text-2xl lg:text-3xl font-bold text-amber-600 mt-2">{CURRENCY_FORMATTER.format(cartTotal)}</p>
                </div>
                <div className="p-4 lg:p-6 grid grid-cols-1 gap-3 lg:gap-4">
                    <button onClick={() => handlePayment('CASH')} className="flex items-center justify-center gap-3 lg:gap-4 p-4 lg:p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group active:scale-95">
                        <Banknote size={28} className="text-slate-400 group-hover:text-green-600" />
                        <span className="text-lg lg:text-xl font-bold text-slate-700 group-hover:text-green-700">Cash</span>
                    </button>
                    <button onClick={() => handlePayment('CARD')} className="flex items-center justify-center gap-3 lg:gap-4 p-4 lg:p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group active:scale-95">
                        <CreditCard size={28} className="text-slate-400 group-hover:text-blue-600" />
                        <span className="text-lg lg:text-xl font-bold text-slate-700 group-hover:text-blue-700">Card</span>
                    </button>
                    <button onClick={() => handlePayment('MOBILE')} className="flex items-center justify-center gap-3 lg:gap-4 p-4 lg:p-6 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group active:scale-95">
                        <Smartphone size={28} className="text-slate-400 group-hover:text-purple-600" />
                        <span className="text-lg lg:text-xl font-bold text-slate-700 group-hover:text-purple-700">Mobile Money</span>
                    </button>
                </div>
                <div className="p-3 lg:p-4 bg-slate-50 border-t border-slate-100">
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