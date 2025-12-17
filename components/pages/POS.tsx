'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { AlcoholType, Product, CartItem, SaleItem, Sale } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, LogOut, Receipt, Printer, X, Clock } from 'lucide-react';

const POS = () => {
  const { products, sales, processSale, currentShift, openShift, closeShift, logout, businessSettings } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AlcoholType | 'ALL'>('ALL');
  
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftCashAmount, setShiftCashAmount] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search);
      const matchesType = filter === 'ALL' || p.type === filter;
      return matchesSearch && matchesType;
    });
  }, [products, search, filter]);

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
    
    const newSale = await processSale(saleItems, method);
    
    if (newSale) {
      setReceiptSale(newSale);
      setShowReceiptModal(true);
      setCart([]);
      setPaymentModalOpen(false);
      setMobileCartOpen(false);
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

  const handleOpenShift = () => {
    openShift(0);
    setShowShiftModal(false);
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(shiftCashAmount);
    if (isNaN(amount)) return;
    await closeShift(amount);
    logout();
    setShiftCashAmount('');
  };

  useEffect(() => {
    if (!currentShift) {
      setShowShiftModal(true);
    }
  }, [currentShift]);

  if (!currentShift) {
    return (
      <div className="flex items-center justify-center h-full p-4 lg:p-8 print:hidden">
        <div className="bg-white p-6 lg:p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="text-amber-600" size={32} />
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-2">Start Your Shift</h2>
          <p className="text-slate-500 mb-6 text-sm lg:text-base">Tap below to open the register and begin.</p>
          <button 
            onClick={handleOpenShift}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 lg:py-4 rounded-lg font-bold text-base lg:text-lg"
          >
            Open Shift
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full relative">
      {/* Product Grid Section */}
      <div className="flex-1 p-3 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
        {/* Search & Filters */}
        <div className="mb-4 lg:mb-6 space-y-3 lg:space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search products or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 lg:py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 lg:mx-0 lg:px-0">
            {['ALL', ...Object.values(AlcoholType)].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type as AlcoholType | 'ALL')}
                className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === type ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-4">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={product.stock <= 0}
              className={`bg-white p-3 lg:p-4 rounded-xl shadow-sm border-2 text-left transition-all active:scale-95 ${
                product.stock <= 0 
                  ? 'opacity-50 cursor-not-allowed border-slate-200' 
                  : 'border-transparent hover:border-amber-400 hover:shadow-lg'
              }`}
            >
              <div className="text-xs lg:text-sm font-bold text-slate-800 truncate">{product.name}</div>
              <div className="text-[10px] lg:text-xs text-slate-400">{product.size}</div>
              <div className="text-sm lg:text-lg font-bold text-amber-600 mt-1 lg:mt-2">
                {CURRENCY_FORMATTER.format(product.sellingPrice)}
              </div>
              <div className={`text-[10px] lg:text-xs mt-1 ${product.stock <= 5 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                {product.stock} in stock
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Cart */}
      <div className="hidden lg:flex w-96 bg-white border-l border-slate-200 flex-col print:hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Current Sale</h2>
          <button onClick={viewLastTransaction} className="text-slate-400 hover:text-slate-600">
            <Receipt size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <ShoppingCartIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.size}</div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => adjustQty(item.id, -1)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300">
                      <Minus size={14} />
                    </button>
                    <span className="font-bold w-8 text-center">{item.quantity}</span>
                    <button onClick={() => adjustQty(item.id, 1)} className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="font-bold text-amber-600">
                    {CURRENCY_FORMATTER.format(item.sellingPrice * item.quantity)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-slate-200 space-y-4">
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Total</span>
            <span className="text-amber-600">{CURRENCY_FORMATTER.format(cartTotal)}</span>
          </div>
          
          <button
            onClick={() => setPaymentModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-lg transition-colors"
          >
            Checkout
          </button>
          
          <button
            onClick={() => setShowShiftModal(true)}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 py-2 font-medium"
          >
            <LogOut size={18} /> End Shift
          </button>
        </div>
      </div>

      {/* Mobile Cart Button */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 print:hidden">
        <button 
          onClick={() => setMobileCartOpen(true)}
          className="w-full bg-amber-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3"
        >
          <ShoppingCartIcon size={24} className="" />
          <span>View Cart ({cart.length})</span>
          <span className="ml-auto">{CURRENCY_FORMATTER.format(cartTotal)}</span>
        </button>
      </div>

      {/* Mobile Cart Drawer */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 print:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileCartOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold">Cart ({cart.length} items)</h2>
              <button onClick={() => setMobileCartOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.size}</div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => adjustQty(item.id, -1)} className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                        <Minus size={12} />
                      </button>
                      <span className="font-bold w-6 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => adjustQty(item.id, 1)} className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="font-bold text-amber-600 text-sm">
                      {CURRENCY_FORMATTER.format(item.sellingPrice * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total</span>
                <span className="text-amber-600">{CURRENCY_FORMATTER.format(cartTotal)}</span>
              </div>
              <button
                onClick={() => setPaymentModalOpen(true)}
                disabled={cart.length === 0}
                className="w-full bg-green-600 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold text-lg"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end lg:items-center justify-center print:hidden">
          <div className="bg-white w-full lg:rounded-xl lg:max-w-md lg:w-full rounded-t-2xl">
            <div className="p-4 lg:p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg lg:text-xl font-bold">Select Payment</h2>
              <button onClick={() => setPaymentModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="p-4 lg:p-6">
              <div className="text-center mb-6">
                <div className="text-slate-500 text-sm">Total Amount</div>
                <div className="text-3xl lg:text-4xl font-bold text-amber-600">
                  {CURRENCY_FORMATTER.format(cartTotal)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handlePayment('CASH')} className="flex flex-col items-center gap-2 p-4 lg:p-6 bg-green-50 rounded-xl hover:bg-green-100 border-2 border-green-200">
                  <Banknote size={28} className="text-green-600" />
                  <span className="font-bold text-green-800 text-sm lg:text-base">Cash</span>
                </button>
                <button onClick={() => handlePayment('CARD')} className="flex flex-col items-center gap-2 p-4 lg:p-6 bg-blue-50 rounded-xl hover:bg-blue-100 border-2 border-blue-200">
                  <CreditCard size={28} className="text-blue-600" />
                  <span className="font-bold text-blue-800 text-sm lg:text-base">Card</span>
                </button>
                <button onClick={() => handlePayment('MOBILE')} className="flex flex-col items-center gap-2 p-4 lg:p-6 bg-purple-50 rounded-xl hover:bg-purple-100 border-2 border-purple-200">
                  <Smartphone size={28} className="text-purple-600" />
                  <span className="font-bold text-purple-800 text-sm lg:text-base">M-Pesa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showShiftModal && currentShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-2 text-slate-800">Close Shift</h2>
            <p className="text-slate-500 mb-6">Count cash and enter amount. <strong className="text-red-600">This will log you out.</strong></p>
            <form onSubmit={handleCloseShift}>
              <label className="block text-sm font-bold text-slate-700 mb-2">Closing Cash (KES)</label>
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

      {/* Receipt Modal */}
      {showReceiptModal && receiptSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:fixed print:inset-0 print:z-[9999] print:bg-white print:p-0">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden print:shadow-none print:w-full print:max-w-none">
            <div className="p-6 lg:p-8 pb-4 text-center print:p-8">
              {businessSettings?.logoUrl && (
                <img src={businessSettings.logoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-3 object-contain" />
              )}
              <h2 className="text-xl lg:text-2xl font-bold mb-0.5">
                {businessSettings?.businessName || 'Port Side Liquor'}
              </h2>
              {businessSettings?.tagline && (
                <p className="text-xs text-slate-400 italic mb-1">{businessSettings.tagline}</p>
              )}
              <p className="text-xs text-slate-500 mb-1">{businessSettings?.location || 'Nairobi, Kenya'}</p>
              <p className="text-xs text-slate-500 mb-4">
                {businessSettings?.phone || '+254 700 000000'}
                {businessSettings?.email && ` • ${businessSettings.email}`}
              </p>
              
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

              <p className="text-xs text-slate-500 italic text-center">
                {businessSettings?.receiptFooter || 'Thank you for your business!'}
              </p>
            </div>

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
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

export default POS;
