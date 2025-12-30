'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { AlcoholType, Product, CartItem, SaleItem, Sale } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, LogOut, Receipt, Printer, X, Clock, Barcode, MessageCircle, Send, Ban } from 'lucide-react';

const POS = () => {
  const { products, sales, processSale, currentShift, openShift, closeShift, logout, businessSettings, requestVoid, voidRequests } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AlcoholType | 'ALL'>('ALL');

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftCashAmount, setShiftCashAmount] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const [showCashModal, setShowCashModal] = useState(false);
  const [globalBarcodeBuffer, setGlobalBarcodeBuffer] = useState('');
  const lastKeyTime = useRef<number>(0);

  // Global barcode scanner listener - scan anytime without clicking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field or modal is open
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const now = Date.now();
      // If more than 100ms between keys, start fresh (barcode scanners are fast)
      if (now - lastKeyTime.current > 100) {
        setGlobalBarcodeBuffer('');
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter' && globalBarcodeBuffer.length > 0) {
        // Process the scanned barcode - add to cart
        handleBarcodeScanned(globalBarcodeBuffer);
        setGlobalBarcodeBuffer('');
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setGlobalBarcodeBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalBarcodeBuffer, products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search) || (p.barcode && p.barcode.includes(search));
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

  const handlePayment = async (method: 'CASH' | 'CARD' | 'MOBILE', cashAmount?: number) => {
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
      // Store cash tendered and change for receipt
      if (method === 'CASH' && cashAmount) {
        (newSale as any).cashTendered = cashAmount;
        (newSale as any).changeGiven = cashAmount - newSale.totalAmount;
      }
      setReceiptSale(newSale);
      setCart([]);
      setPaymentModalOpen(false);
      setShowCashModal(false);
      setCashTendered('');
      setMobileCartOpen(false);
      // Auto-print receipt
      setTimeout(() => {
        setShowReceiptModal(true);
        setTimeout(() => window.print(), 500);
      }, 100);
    }
  };

  const handleCashPayment = () => {
    setPaymentModalOpen(false);
    setShowCashModal(true);
  };

  const confirmCashPayment = () => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered < cartTotal) {
      alert('Cash tendered must be at least ' + CURRENCY_FORMATTER.format(cartTotal));
      return;
    }
    handlePayment('CASH', tendered);
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

  const handleBarcodeScanned = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (product) {
      if (product.stock > 0) {
        addToCart(product);
        setBarcodeInput('');
        setShowBarcodeScanner(false);
      } else {
        alert(`${product.name} is out of stock!`);
      }
    } else {
      alert('Product not found for this barcode');
    }
  };

  const generateReceiptText = (sale: Sale) => {
    const settings = businessSettings;
    let text = `*${settings?.businessName || 'Grab Bottle '}*\n`;
    if (settings?.tagline) text += `_${settings.tagline}_\n`;
    text += `📍 ${settings?.location || 'Nairobi, Kenya'}\n`;
    text += `📞 ${settings?.phone || '+254 700 000000'}\n`;
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Receipt #${sale.id.slice(-8).toUpperCase()}*\n`;
    text += `Date: ${new Date(sale.timestamp).toLocaleDateString('en-GB')}\n`;
    text += `Time: ${new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `Cashier: ${sale.cashierName}\n`;
    text += `Payment: ${sale.paymentMethod}\n`;
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Items Purchased:*\n`;
    sale.items.forEach(item => {
      text += `• ${item.productName} (${item.size})\n`;
      text += `  ${item.quantity} x ${CURRENCY_FORMATTER.format(item.priceAtSale)} = ${CURRENCY_FORMATTER.format(item.quantity * item.priceAtSale)}\n`;
    });
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*TOTAL: ${CURRENCY_FORMATTER.format(sale.totalAmount)}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `_${settings?.receiptFooter || 'Thank you for your business!'}_\n`;
    text += `Please drink responsibly • Must be 18+`;
    return text;
  };

  const sendWhatsAppReceipt = async () => {
    if (!receiptSale || !customerPhone) return;
    
    const settings = businessSettings;
    if (!settings?.evolutionApiUrl || !settings?.evolutionApiKey || !settings?.evolutionInstance) {
      alert('WhatsApp API not configured. Please configure Evolution API in Settings.');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const receiptText = generateReceiptText(receiptSale);
      const phone = customerPhone.replace(/[^0-9]/g, '');
      
      const response = await fetch(`${settings.evolutionApiUrl}/message/sendText/${settings.evolutionInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolutionApiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: receiptText,
        }),
      });

      if (response.ok) {
        alert('Receipt sent successfully via WhatsApp!');
        setShowWhatsAppModal(false);
        setCustomerPhone('');
      } else {
        const error = await response.text();
        alert(`Failed to send: ${error}`);
      }
    } catch (error) {
      alert(`Error sending WhatsApp: ${error}`);
    } finally {
      setSendingWhatsApp(false);
    }
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
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    handleBarcodeScanned(search.trim());
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 lg:py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm lg:text-base"
              />
            </div>
            <button
              onClick={() => setShowBarcodeScanner(true)}
              className="px-4 py-2.5 lg:py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 font-medium text-sm"
            >
              <Barcode size={20} />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 lg:mx-0 lg:px-0">
            {['ALL', ...Object.values(AlcoholType)].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type as AlcoholType | 'ALL')}
                className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium whitespace-nowrap transition-colors ${filter === type ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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
              className={`bg-white p-3 lg:p-4 rounded-xl shadow-sm border-2 text-left transition-all active:scale-95 ${product.stock <= 0
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
                <button onClick={handleCashPayment} className="flex flex-col items-center gap-2 p-4 lg:p-6 bg-green-50 rounded-xl hover:bg-green-100 border-2 border-green-200">
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

      {/* Cash Payment Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end lg:items-center justify-center print:hidden">
          <div className="bg-white w-full lg:rounded-xl lg:max-w-md lg:w-full rounded-t-2xl">
            <div className="p-4 lg:p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
                <Banknote className="text-green-600" /> Cash Payment
              </h2>
              <button onClick={() => { setShowCashModal(false); setCashTendered(''); }}>
                <X size={24} />
              </button>
            </div>
            <div className="p-4 lg:p-6">
              <div className="text-center mb-6">
                <div className="text-slate-500 text-sm">Amount Due</div>
                <div className="text-3xl lg:text-4xl font-bold text-amber-600">
                  {CURRENCY_FORMATTER.format(cartTotal)}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Cash Received</label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  placeholder="Enter amount..."
                  className="w-full border-2 border-green-400 p-4 rounded-lg text-2xl font-mono text-center focus:ring-2 focus:ring-green-500 outline-none"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmCashPayment();
                    }
                  }}
                />
              </div>

              {cashTendered && parseFloat(cashTendered) >= cartTotal && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                  <div className="text-center">
                    <div className="text-green-600 text-sm font-medium">Change to Give</div>
                    <div className="text-3xl font-bold text-green-700">
                      {CURRENCY_FORMATTER.format(parseFloat(cashTendered) - cartTotal)}
                    </div>
                  </div>
                </div>
              )}

              {cashTendered && parseFloat(cashTendered) < cartTotal && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
                  <div className="text-center">
                    <div className="text-red-600 text-sm font-medium">Insufficient Amount</div>
                    <div className="text-xl font-bold text-red-700">
                      Need {CURRENCY_FORMATTER.format(cartTotal - parseFloat(cashTendered))} more
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowCashModal(false); setCashTendered(''); }}
                  className="py-3 border-2 border-slate-300 rounded-xl font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCashPayment}
                  disabled={!cashTendered || parseFloat(cashTendered) < cartTotal}
                  className="py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Banknote size={18} /> Complete Sale
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

      {/* Receipt Modal - World Class Design */}
      {showReceiptModal && receiptSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md my-2 sm:my-0 max-h-[95vh] overflow-y-auto">
            {/* Receipt Content - This is what gets printed */}
            <div data-receipt-print className="p-4 sm:p-6 lg:p-8 pb-3 sm:pb-4 text-center">
              {businessSettings?.logoUrl ? (
                <div className="mb-4 print:mb-3">
                  <img
                    src={businessSettings.logoUrl}
                    alt="Business Logo"
                    className="w-24 h-24 mx-auto object-contain print:w-20 print:h-20"
                  />
                </div>
              ) : (
                <div className="mb-3 sm:mb-4 print:mb-3">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg print:w-20 print:h-20 print:shadow-none">
                    <span className="text-white text-2xl sm:text-3xl font-bold print:text-2xl">
                      {businessSettings?.businessName?.charAt(0) || 'P'}
                    </span>
                  </div>
                </div>
              )}

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 mb-1 print:text-xl print:mb-0.5">
                {businessSettings?.businessName || 'Grab Bottle '}
              </h2>

              {businessSettings?.tagline && (
                <p className="text-sm text-amber-600 font-medium italic mb-2 print:text-xs print:mb-1">
                  {businessSettings.tagline}
                </p>
              )}

              <div className="text-xs text-black space-y-0.5 mb-3 sm:mb-4 print:text-[10px] print:mb-3">
                <p className="flex items-center justify-center gap-1">
                  <span>📍</span> {businessSettings?.location || 'Nairobi, Kenya'}
                </p>
                <p className="flex items-center justify-center gap-1">
                  <span>📞</span> {businessSettings?.phone || '+254 700 000000'}
                </p>
                {businessSettings?.email && (
                  <p className="flex items-center justify-center gap-1">
                    <span>✉️</span> {businessSettings.email}
                  </p>
                )}
              </div>

              <div className="border-t-2 border-dashed border-black my-3 sm:my-4 print:my-3"></div>

              {/* Transaction Details */}
              <div className="bg-slate-50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 space-y-1 sm:space-y-1.5 text-xs sm:text-sm print:bg-transparent print:p-0 print:mb-3 print:text-xs">
                <div className="flex justify-between">
                  <span className="text-black font-medium">Receipt #</span>
                  <span className="font-mono font-bold text-slate-900">#{receiptSale.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black font-medium">Date & Time</span>
                  <span className="font-medium text-slate-900">
                    {new Date(receiptSale.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(receiptSale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black font-medium">Cashier</span>
                  <span className="font-medium text-slate-900">{receiptSale.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black font-medium">Payment Method</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-bold print:bg-transparent print:text-slate-900">
                    {receiptSale.paymentMethod === 'CASH' && '💵'}
                    {receiptSale.paymentMethod === 'CARD' && '💳'}
                    {receiptSale.paymentMethod === 'MOBILE' && '📱'}
                    {receiptSale.paymentMethod === 'MOBILE' ? 'M-PESA' : receiptSale.paymentMethod}
                  </span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-black my-3 sm:my-4 print:my-3"></div>

              {/* Items List */}
              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 text-left print:space-y-2 print:mb-3">
                <h3 className="text-xs font-bold text-black uppercase tracking-wide mb-2 print:text-[10px]">Items Purchased</h3>
                {receiptSale.items.map((item, idx) => (
                  <div key={idx} className="border-b border-slate-100 pb-2 last:border-0 print:pb-1.5">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 text-sm print:text-xs">{item.productName}</p>
                        <p className="text-xs text-black print:text-[10px]">
                          {item.size}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-slate-900 text-sm print:text-xs">
                          {CURRENCY_FORMATTER.format(item.quantity * item.priceAtSale)}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-black print:text-[10px]">
                      <span>{item.quantity} × {CURRENCY_FORMATTER.format(item.priceAtSale)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-black my-3 sm:my-4 print:my-3"></div>

              {/* Subtotal & Total */}
              <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4 print:space-y-1 print:mb-3">
                <div className="flex justify-between text-xs sm:text-sm text-black print:text-xs">
                  <span>Subtotal</span>
                  <span className="font-medium">{CURRENCY_FORMATTER.format(receiptSale.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-black print:text-xs">
                  <span>Tax (Included)</span>
                  <span className="font-medium">KES 0.00</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 print:bg-none print:bg-slate-900 print:rounded-none print:p-3 print:mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-white text-base sm:text-lg font-bold print:text-base">TOTAL</span>
                  <span className="text-white text-xl sm:text-2xl font-bold print:text-xl">
                    {CURRENCY_FORMATTER.format(receiptSale.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Cash Payment Details */}
              {receiptSale.paymentMethod === 'CASH' && (receiptSale as any).cashTendered && (
                <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-2 sm:p-3 mb-3 sm:mb-4 print:bg-transparent print:border-slate-300 print:p-2 print:mb-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-black">Cash Received</span>
                      <span className="font-bold text-black">{CURRENCY_FORMATTER.format((receiptSale as any).cashTendered)}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-green-700 font-medium">Balance</span>
                      <span className="font-bold text-green-700">{CURRENCY_FORMATTER.format((receiptSale as any).changeGiven)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t-2 border-dashed border-black my-3 sm:my-4 print:my-3"></div>

              {/* Footer Message */}
              <div className="text-center space-y-1 sm:space-y-2 print:space-y-1">
                <p className="text-xs sm:text-sm text-black font-medium italic print:text-xs">
                  {businessSettings?.receiptFooter || 'Thank you for your business!'}
                </p>
                <p className="text-[10px] sm:text-xs text-black print:text-[10px]">
                  Please drink responsibly • Must be 18+
                </p>
                <div className="pt-1 sm:pt-2 print:pt-1">
                  <p className="text-[10px] sm:text-xs text-black print:text-[10px]">
                    Powered by Grab Bottle POS
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons - Hidden on Print */}
            <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 space-y-2 sm:space-y-3 print:hidden">
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-gradient-to-r from-slate-800 to-slate-900 text-white py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-1 sm:gap-2 hover:from-slate-700 hover:to-slate-800 shadow-lg transition-all active:scale-95"
                >
                  <Printer size={18} /> Print
                </button>
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-1 sm:gap-2 hover:from-green-400 hover:to-green-500 shadow-lg transition-all active:scale-95"
                >
                  <MessageCircle size={18} /> WhatsApp
                </button>
              </div>
              {/* Void Sale Button - Only show if sale is not already voided and no pending void request */}
              {receiptSale && !receiptSale.isVoided && !voidRequests.find(r => r.saleId === receiptSale.id && r.status === 'PENDING') && (
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 hover:from-red-400 hover:to-red-500 shadow-lg transition-all active:scale-95"
                >
                  <Ban size={18} /> Request Void
                </button>
              )}
              {receiptSale?.isVoided && (
                <div className="w-full bg-red-100 text-red-700 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base text-center">
                  This sale has been voided
                </div>
              )}
              {receiptSale && voidRequests.find(r => r.saleId === receiptSale.id && r.status === 'PENDING') && (
                <div className="w-full bg-amber-100 text-amber-700 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base text-center">
                  Void request pending approval
                </div>
              )}
              <button
                onClick={() => setShowReceiptModal(false)}
                className="w-full border-2 border-slate-300 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Barcode size={20} /> Scan Barcode</h3>
            <p className="text-sm text-slate-500 mb-4">Use a barcode scanner or manually enter the barcode. Press Enter to add to cart.</p>
            <input
              type="text"
              autoFocus
              placeholder="Scan barcode here..."
              className="w-full border-2 border-amber-400 p-4 rounded-lg text-lg font-mono text-center focus:ring-2 focus:ring-amber-500 outline-none"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && barcodeInput.trim()) {
                  e.preventDefault();
                  e.stopPropagation();
                  const barcode = barcodeInput.trim();
                  setBarcodeInput('');
                  handleBarcodeScanned(barcode);
                }
              }}
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  if (barcodeInput.trim()) {
                    const barcode = barcodeInput.trim();
                    setBarcodeInput('');
                    handleBarcodeScanned(barcode);
                  }
                }}
                disabled={!barcodeInput.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold"
              >
                Add to Cart
              </button>
              <button
                onClick={() => { setBarcodeInput(''); setShowBarcodeScanner(false); }}
                className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Request Modal */}
      {showVoidModal && receiptSale && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-red-600">
              <Ban size={20} /> Request Void Sale
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Sale #{receiptSale.id.slice(-8)} • {CURRENCY_FORMATTER.format(receiptSale.totalAmount)}
            </p>
            <p className="text-sm text-slate-600 mb-4">
              Please provide a reason for voiding this sale. This request will be sent to an admin for approval.
            </p>
            <textarea
              autoFocus
              placeholder="Enter reason for void (required)..."
              className="w-full border-2 border-red-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
              rows={3}
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  if (voidReason.trim() && receiptSale) {
                    await requestVoid(receiptSale.id, voidReason.trim());
                    setVoidReason('');
                    setShowVoidModal(false);
                    setShowReceiptModal(false);
                  }
                }}
                disabled={!voidReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Ban size={18} /> Submit Request
              </button>
              <button
                onClick={() => { setVoidReason(''); setShowVoidModal(false); }}
                className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Send Modal */}
      {showWhatsAppModal && receiptSale && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MessageCircle size={20} className="text-green-600" /> Send Receipt via WhatsApp</h3>
            <p className="text-sm text-slate-500 mb-4">Enter customer's phone number to send the receipt.</p>
            <input
              type="tel"
              autoFocus
              placeholder="e.g. 254712345678"
              className="w-full border-2 border-green-400 p-4 rounded-lg text-lg font-mono text-center focus:ring-2 focus:ring-green-500 outline-none"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customerPhone.trim()) {
                  sendWhatsAppReceipt();
                }
              }}
            />
            <p className="text-xs text-slate-400 mt-2 text-center">Include country code without + (e.g. 254 for Kenya)</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={sendWhatsAppReceipt}
                disabled={!customerPhone.trim() || sendingWhatsApp}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                {sendingWhatsApp ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Send Receipt
                  </>
                )}
              </button>
              <button
                onClick={() => { setCustomerPhone(''); setShowWhatsAppModal(false); }}
                className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500"
              >
                Cancel
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
