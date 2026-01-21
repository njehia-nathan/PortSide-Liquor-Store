'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { AlcoholType, Product, Role, User } from '../../types';
import { CURRENCY_FORMATTER } from '../../constants';
import { PlusCircle, UserCog, UserPlus, Trash2, Barcode, Camera, Search, Filter, ArrowUpDown, Clock, User as UserIcon, Activity, AlertTriangle } from 'lucide-react';
import { validatePrice, validateStock, sanitizePriceInput, sanitizeStockInput, debounce } from '../../utils/validation';

const Admin = () => {
  const { products, auditLogs, users, currentUser, addProduct, updateProduct, deleteProduct, updateUser, addUser, deleteUser, fixCorruptedSales } = useStore();
  const [activeSection, setActiveSection] = useState<'PRODUCTS' | 'LOGS' | 'USERS'>('PRODUCTS');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productFormData, setProductFormData] = useState<Partial<Product>>({ name: '', type: AlcoholType.WHISKEY, size: '', brand: '', sku: '', barcode: '', costPrice: 0, sellingPrice: 0, stock: 0, lowStockThreshold: 5 });
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<Partial<User>>({ name: '', pin: '', role: Role.CASHIER, permissions: [] });
  const [productSearch, setProductSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logFilterAction, setLogFilterAction] = useState<string>('ALL');
  const [logFilterUser, setLogFilterUser] = useState<string>('ALL');
  const [logSortOrder, setLogSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'product' | 'user'; id: string; name: string } | null>(null);
  const [isFixingSales, setIsFixingSales] = useState(false);
  const [fixResult, setFixResult] = useState<{ fixed: number; total: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [conflictError, setConflictError] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search) ||
      (p.barcode && p.barcode.toLowerCase().includes(search)) ||
      p.type.toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(auditLogs.map(l => l.action));
    return Array.from(actions).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    let logs = [...auditLogs];
    if (logSearch) {
      const search = logSearch.toLowerCase();
      logs = logs.filter(l => l.details.toLowerCase().includes(search) || l.userName.toLowerCase().includes(search) || l.action.toLowerCase().includes(search));
    }
    if (logFilterAction !== 'ALL') {
      logs = logs.filter(l => l.action === logFilterAction);
    }
    if (logFilterUser !== 'ALL') {
      logs = logs.filter(l => l.userId === logFilterUser);
    }
    logs.sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return logSortOrder === 'newest' ? diff : -diff;
    });
    return logs;
  }, [auditLogs, logSearch, logFilterAction, logFilterUser, logSortOrder]);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductFormData(product);
    setValidationErrors({});
    setConflictError(null);
    setIsProductFormOpen(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setProductFormData({ name: '', type: AlcoholType.WHISKEY, size: '', brand: '', sku: '', barcode: '', costPrice: 0, sellingPrice: 0, stock: 0, lowStockThreshold: 5 });
    setValidationErrors({});
    setConflictError(null);
    setIsProductFormOpen(true);
  };

  const validateProductForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!productFormData.name?.trim()) {
      errors.name = 'Product name is required';
    }

    if (!productFormData.size?.trim()) {
      errors.size = 'Size is required';
    }

    const costValidation = validatePrice(productFormData.costPrice || 0, 'Cost price');
    if (!costValidation.isValid) {
      errors.costPrice = costValidation.error!;
    }

    const sellingValidation = validatePrice(productFormData.sellingPrice || 0, 'Selling price');
    if (!sellingValidation.isValid) {
      errors.sellingPrice = sellingValidation.error!;
    }

    const stockValidation = validateStock(productFormData.stock || 0);
    if (!stockValidation.isValid) {
      errors.stock = stockValidation.error!;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProductForm()) {
      return;
    }

    setIsSaving(true);
    setConflictError(null);

    try {
      const payload = productFormData as Product;
      
      if (editingProduct) {
        // Refresh product data from store to detect conflicts
        const currentProduct = products.find(p => p.id === editingProduct.id);
        if (currentProduct && currentProduct.version !== undefined && payload.version !== undefined) {
          if (currentProduct.version > payload.version) {
            setConflictError(
              `This product was modified by ${currentProduct.lastModifiedByName || 'another user'}. ` +
              `Please close and reopen the form to see the latest changes.`
            );
            setIsSaving(false);
            return;
          }
        }
        
        await updateProduct(payload);
      } else {
        const { id, ...rest } = payload;
        rest.brand = rest.name;
        await addProduct(rest);
      }
      
      setIsProductFormOpen(false);
      setValidationErrors({});
      setConflictError(null);
    } catch (error: any) {
      if (error.message?.includes('CONFLICT')) {
        setConflictError(error.message);
      } else {
        alert(`Failed to save product: ${error.message || error}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriceChange = useCallback(
    debounce((field: 'costPrice' | 'sellingPrice', value: string) => {
      const sanitized = sanitizePriceInput(value);
      setProductFormData(prev => ({ ...prev, [field]: sanitized }));
    }, 300),
    []
  );

  const handleStockChange = useCallback(
    debounce((value: string) => {
      const sanitized = sanitizeStockInput(value);
      setProductFormData(prev => ({ ...prev, stock: sanitized }));
    }, 300),
    []
  );
  const handleEditUser = (user: User) => { setEditingUser(user); setUserFormData({ ...user }); setIsUserFormOpen(true); };
  const handleCreateUser = () => { setEditingUser(null); setUserFormData({ name: '', pin: '', role: Role.CASHIER, permissions: ['POS'] }); setIsUserFormOpen(true); };
  const handleUserSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!userFormData.name || !userFormData.pin) { alert('Name and PIN are required'); return; } if (editingUser) { updateUser({ ...editingUser, ...userFormData } as User); } else { addUser(userFormData as Omit<User, 'id'>); } setIsUserFormOpen(false); };
  const handleDeleteUser = (id: string) => { const user = users.find(u => u.id === id); if (user) setDeleteConfirm({ type: 'user', id, name: user.name }); };
  const handleDeleteProduct = (id: string) => { const product = products.find(p => p.id === id); if (product) setDeleteConfirm({ type: 'product', id, name: product.name }); };
  const confirmDelete = () => { if (!deleteConfirm) return; if (deleteConfirm.type === 'product') deleteProduct(deleteConfirm.id); else deleteUser(deleteConfirm.id); setDeleteConfirm(null); };
  const handleRoleChange = (newRole: Role) => { let perms: string[] = []; if (newRole === Role.ADMIN) perms = ['POS', 'INVENTORY', 'REPORTS', 'ADMIN']; else if (newRole === Role.MANAGER) perms = ['POS', 'INVENTORY', 'REPORTS']; else perms = ['POS']; setUserFormData({ ...userFormData, role: newRole, permissions: perms }); };
  const togglePermission = (perm: string) => { const currentPerms = userFormData.permissions || []; if (currentPerms.includes(perm)) { setUserFormData({ ...userFormData, permissions: currentPerms.filter(p => p !== perm) }); } else { setUserFormData({ ...userFormData, permissions: [...currentPerms, perm] }); } };
  
  const handleFixCorruptedSales = async () => {
    if (!confirm('This will fix sales records with missing cost/price data. Continue?')) return;
    setIsFixingSales(true);
    setFixResult(null);
    try {
      const result = await fixCorruptedSales();
      setFixResult(result);
      if (result.fixed > 0) {
        alert(`Successfully fixed ${result.fixed} corrupted sales records!`);
      } else {
        alert('No corrupted sales found. All records are valid.');
      }
    } catch (error) {
      console.error('Error fixing sales:', error);
      alert('Failed to fix corrupted sales. Check console for details.');
    } finally {
      setIsFixingSales(false);
    }
  };

  return (
    <div className="p-3 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Admin Panel</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 overflow-x-auto">
            <button onClick={() => setActiveSection('PRODUCTS')} className={`flex-1 sm:flex-none px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${activeSection === 'PRODUCTS' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Products</button>
            <button onClick={() => setActiveSection('USERS')} className={`flex-1 sm:flex-none px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${activeSection === 'USERS' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Users</button>
            <button onClick={() => setActiveSection('LOGS')} className={`flex-1 sm:flex-none px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${activeSection === 'LOGS' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Logs</button>
          </div>
          <button 
            onClick={handleFixCorruptedSales} 
            disabled={isFixingSales}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 lg:px-4 py-2 rounded-lg font-medium text-xs lg:text-sm whitespace-nowrap transition-colors"
          >
            <Activity size={16} className={isFixingSales ? 'animate-spin' : ''} />
            {isFixingSales ? 'Fixing...' : 'Fix Data'}
          </button>
        </div>
      </div>

      {activeSection === 'PRODUCTS' && (
        <>
          <div className="mb-3 lg:mb-4 flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name, SKU, barcode, or type..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
            <button onClick={handleCreateProduct} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 lg:px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"><PlusCircle size={16} /> <span className="hidden sm:inline">Add New</span> Product</button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <div key={p.id} className="p-4 hover:bg-slate-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="font-bold text-slate-900 text-base">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{p.type} • {p.size}</p>
                      {p.barcode && <p className="text-xs text-slate-400 font-mono mt-0.5">{p.barcode}</p>}
                    </div>
                    <span className="font-bold text-amber-600 text-lg">{CURRENCY_FORMATTER.format(p.sellingPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs px-2 py-1 bg-slate-100 rounded-lg text-slate-600">Alert: {p.lowStockThreshold || 5}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleEditProduct(p)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm">Edit</button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shadow-sm flex items-center gap-1.5"><Trash2 size={16} /> Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold"><tr><th className="px-4 py-4">#</th><th className="px-6 py-4">Name</th><th className="px-6 py-4">Size</th><th className="px-6 py-4">SKU</th><th className="px-6 py-4">Barcode</th><th className="px-6 py-4">Alert Level</th><th className="px-6 py-4">Price</th><th className="px-6 py-4">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map((p, index) => (<tr key={p.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-mono text-slate-400">#{index + 1}</td><td className="px-6 py-4 font-medium">{p.name}</td><td className="px-6 py-4">{p.size}</td><td className="px-6 py-4 font-mono text-slate-500">{p.sku}</td><td className="px-6 py-4 font-mono text-xs text-slate-400">{p.barcode || '-'}</td><td className="px-6 py-4 font-bold">{p.lowStockThreshold || 5}</td><td className="px-6 py-4">{CURRENCY_FORMATTER.format(p.sellingPrice)}</td><td className="px-6 py-4"><div className="flex items-center gap-3"><button onClick={() => handleEditProduct(p)} className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors">Edit</button><button onClick={() => handleDeleteProduct(p.id)} className="px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-1" title="Delete Product"><Trash2 size={14} /> Delete</button></div></td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSection === 'USERS' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div><h2 className="text-base lg:text-lg font-bold flex items-center gap-2"><UserCog size={18}/> User Management</h2><p className="text-xs lg:text-sm text-slate-500">Manage PINs and access for staff.</p></div>
            <button onClick={handleCreateUser} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 lg:px-4 py-2 rounded-lg font-medium text-sm w-full sm:w-auto justify-center"><UserPlus size={16} /> Add User</button>
          </div>
          <div className="lg:hidden divide-y divide-slate-100">
            {users.map(u => (
              <div key={u.id} className="p-4 hover:bg-slate-50">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base">{u.name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-bold text-slate-600 mt-1 inline-block">{u.role}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleEditUser(u)} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors">Edit</button>
                    {u.id !== currentUser?.id && (
                      <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">{u.permissions?.map(p => (<span key={p} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 font-medium">{p}</span>))}</div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">PIN</th><th className="px-6 py-4">Access Rights</th><th className="px-6 py-4">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map(u => (<tr key={u.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-bold text-slate-800">{u.name}</td><td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600">{u.role}</span></td><td className="px-6 py-4 font-mono">****</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{u.permissions?.map(p => (<span key={p} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{p}</span>))}</div></td><td className="px-6 py-4 flex gap-2"><button onClick={() => handleEditUser(u)} className="text-amber-600 hover:text-amber-800 font-bold text-sm">Edit</button>{u.id !== currentUser?.id && (<button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600 ml-2" title="Delete User"><Trash2 size={16} /></button>)}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'LOGS' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Activity size={16} />
                <span className="text-xs font-medium">Total Logs</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{auditLogs.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Clock size={16} />
                <span className="text-xs font-medium">Today</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{auditLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <UserIcon size={16} />
                <span className="text-xs font-medium">Users Active</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{new Set(auditLogs.map(l => l.userId)).size}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Filter size={16} />
                <span className="text-xs font-medium">Filtered</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{filteredLogs.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                />
              </div>
              <select
                value={logFilterAction}
                onChange={e => setLogFilterAction(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="ALL">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <select
                value={logFilterUser}
                onChange={e => setLogFilterUser(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="ALL">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <button
                onClick={() => setLogSortOrder(logSortOrder === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <ArrowUpDown size={16} />
                {logSortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Activity size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No logs found</p>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="lg:hidden divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                  {filteredLogs.map((log, index) => (
                    <div key={log.id} className="p-3 hover:bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-xs">#{index + 1}</span>
                          <span className="font-medium text-slate-900">{log.userName}</span>
                        </div>
                        <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                          log.action.includes('SALE') ? 'bg-green-100 text-green-700' :
                          log.action.includes('VOID') ? 'bg-red-100 text-red-700' :
                          log.action.includes('SHIFT') ? 'bg-blue-100 text-blue-700' :
                          log.action.includes('USER') ? 'bg-purple-100 text-purple-700' :
                          log.action.includes('PRODUCT') || log.action.includes('STOCK') || log.action.includes('INVENTORY') ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>{log.action}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{log.details}</p>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="px-4 py-4">#</th>
                        <th className="px-4 py-4">Time</th>
                        <th className="px-4 py-4">User</th>
                        <th className="px-4 py-4">Action</th>
                        <th className="px-4 py-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredLogs.map((log, index) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 font-mono text-slate-400">#{index + 1}</td>
                          <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-4 font-medium text-slate-800">{log.userName}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              log.action.includes('SALE') ? 'bg-green-100 text-green-700' :
                              log.action.includes('VOID') ? 'bg-red-100 text-red-700' :
                              log.action.includes('SHIFT') ? 'bg-blue-100 text-blue-700' :
                              log.action.includes('USER') ? 'bg-purple-100 text-purple-700' :
                              log.action.includes('PRODUCT') || log.action.includes('STOCK') || log.action.includes('INVENTORY') ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>{log.action}</span>
                          </td>
                          <td className="px-4 py-4 text-slate-600 max-w-md truncate">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isProductFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div className="bg-white rounded-t-2xl lg:rounded-xl shadow-2xl p-4 lg:p-6 w-full lg:max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg lg:text-xl font-bold mb-4 lg:mb-6">{editingProduct ? 'Edit Product' : 'Create Product'}</h2>
            
            {/* Conflict Warning */}
            {conflictError && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 mb-1">Conflict Detected</h3>
                    <p className="text-sm text-red-700">{conflictError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setConflictError(null);
                        setIsProductFormOpen(false);
                      }}
                      className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline"
                    >
                      Close and Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleProductSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input 
                  required 
                  type="text" 
                  className={`w-full border p-2.5 rounded-lg text-sm ${
                    validationErrors.name ? 'border-red-500 bg-red-50' : ''
                  }`}
                  value={productFormData.name} 
                  onChange={e => setProductFormData({...productFormData, name: e.target.value})} 
                />
                {validationErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{validationErrors.name}</p>
                )}
              </div>
              <div><label className="block text-sm font-medium mb-1">Type</label><select className="w-full border p-2.5 rounded-lg text-sm" value={productFormData.type} onChange={e => setProductFormData({...productFormData, type: e.target.value as AlcoholType})}>{Object.values(AlcoholType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div>
                <label className="block text-sm font-medium mb-1">Size</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. 750ml" 
                  className={`w-full border p-2.5 rounded-lg text-sm ${
                    validationErrors.size ? 'border-red-500 bg-red-50' : ''
                  }`}
                  value={productFormData.size} 
                  onChange={e => setProductFormData({...productFormData, size: e.target.value})} 
                />
                {validationErrors.size && (
                  <p className="text-xs text-red-600 mt-1">{validationErrors.size}</p>
                )}
              </div>
              <div><label className="block text-sm font-medium mb-1">SKU</label><input type="text" placeholder="Optional" className="w-full border p-2.5 rounded-lg text-sm" value={productFormData.sku} onChange={e => setProductFormData({...productFormData, sku: e.target.value})} /></div>
              <div><label className="block text-sm font-medium mb-1 flex items-center gap-1"><Barcode size={14} /> Barcode</label><div className="flex gap-2"><input type="text" placeholder="Scan or enter barcode" className="flex-1 border p-2.5 rounded-lg text-sm font-mono" value={productFormData.barcode || ''} onChange={e => setProductFormData({...productFormData, barcode: e.target.value})} /><button type="button" onClick={() => setIsScanningBarcode(true)} className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center gap-1 text-sm"><Camera size={16} /> Scan</button></div></div>
              <div><label className="block text-sm font-medium mb-1 text-red-600">Low Stock Alert</label><input required type="number" className="w-full border p-2.5 rounded-lg text-sm" value={productFormData.lowStockThreshold} onChange={e => setProductFormData({...productFormData, lowStockThreshold: parseInt(e.target.value) || 0})} /></div>
              <div>
                <label className="block text-sm font-medium mb-1">Cost Price</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  className={`w-full border p-2.5 rounded-lg text-sm ${
                    validationErrors.costPrice ? 'border-red-500 bg-red-50' : ''
                  }`}
                  value={productFormData.costPrice} 
                  onChange={e => handlePriceChange('costPrice', e.target.value)} 
                />
                {validationErrors.costPrice && (
                  <p className="text-xs text-red-600 mt-1">{validationErrors.costPrice}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Selling Price</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  className={`w-full border p-2.5 rounded-lg text-sm ${
                    validationErrors.sellingPrice ? 'border-red-500 bg-red-50' : ''
                  }`}
                  value={productFormData.sellingPrice} 
                  onChange={e => handlePriceChange('sellingPrice', e.target.value)} 
                />
                {validationErrors.sellingPrice && (
                  <p className="text-xs text-red-600 mt-1">{validationErrors.sellingPrice}</p>
                )}
              </div>
              <div className="sm:col-span-2 flex gap-3 mt-4 lg:mt-6">
                <button 
                  type="submit" 
                  disabled={isSaving || !!conflictError}
                  className="flex-1 bg-slate-900 text-white py-3 rounded-lg font-bold text-sm disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Product'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsProductFormOpen(false);
                    setValidationErrors({});
                    setConflictError(null);
                  }} 
                  className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500 text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isScanningBarcode && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Barcode size={20} /> Scan Barcode</h3>
            <p className="text-sm text-slate-500 mb-4">Use a barcode scanner or manually enter the barcode number below.</p>
            <input
              type="text"
              autoFocus
              placeholder="Scan barcode here..."
              className="w-full border-2 border-amber-400 p-4 rounded-lg text-lg font-mono text-center focus:ring-2 focus:ring-amber-500 outline-none"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && barcodeInput.trim()) {
                  setProductFormData({...productFormData, barcode: barcodeInput.trim()});
                  setBarcodeInput('');
                  setIsScanningBarcode(false);
                }
              }}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (barcodeInput.trim()) {
                    setProductFormData({...productFormData, barcode: barcodeInput.trim()});
                  }
                  setBarcodeInput('');
                  setIsScanningBarcode(false);
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold"
              >
                {barcodeInput.trim() ? 'Use Barcode' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => { setBarcodeInput(''); setIsScanningBarcode(false); }}
                className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isUserFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div className="bg-white rounded-t-2xl lg:rounded-xl shadow-2xl p-4 lg:p-6 w-full lg:max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg lg:text-xl font-bold mb-4">{editingUser ? `Edit: ${editingUser.name}` : 'Create User'}</h2>
            <form onSubmit={handleUserSubmit} className="space-y-3 lg:space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label><input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-amber-500 text-sm" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} required /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Role</label><select className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-amber-500 text-sm" value={userFormData.role} onChange={(e) => handleRoleChange(e.target.value as Role)}>{Object.values(Role).map(r => (<option key={r} value={r}>{r}</option>))}</select></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Login PIN</label><input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg font-mono tracking-widest outline-none focus:border-amber-500 text-sm" value={userFormData.pin} onChange={e => setUserFormData({...userFormData, pin: e.target.value})} maxLength={4} placeholder="****" required /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Access Privileges</label><div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">{['POS', 'INVENTORY', 'REPORTS', 'ADMIN'].map(perm => (<label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded"><input type="checkbox" checked={userFormData.permissions?.includes(perm)} onChange={() => togglePermission(perm)} className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" /><span className="text-sm font-medium text-slate-700">{perm}</span></label>))}</div></div>
              <div className="flex gap-3 pt-3"><button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold text-sm">Save User</button><button type="button" onClick={() => setIsUserFormOpen(false)} className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500 text-sm">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mx-auto mb-4">
              <Trash2 size={28} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Delete {deleteConfirm.type === 'product' ? 'Product' : 'User'}?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Are you sure you want to delete <span className="font-bold text-slate-700">{deleteConfirm.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
