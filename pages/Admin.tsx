import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { AlcoholType, Product, Role, User } from '../types';
import { CURRENCY_FORMATTER } from '../constants';
import { PlusCircle, UserCog, Shield, UserPlus, Trash2 } from 'lucide-react';

const Admin = () => {
  const { products, auditLogs, users, currentUser, addProduct, updateProduct, updateUser, addUser, deleteUser } = useStore();
  const [activeSection, setActiveSection] = useState<'PRODUCTS' | 'LOGS' | 'USERS'>('PRODUCTS');
  
  // Product Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productFormData, setProductFormData] = useState<Partial<Product>>({
      name: '', type: AlcoholType.WHISKEY, size: '', brand: '', sku: '', costPrice: 0, sellingPrice: 0, stock: 0, lowStockThreshold: 5
  });

  // User Form State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<Partial<User>>({
      name: '', pin: '', role: Role.CASHIER, permissions: []
  });

  // --- Product Handlers ---
  const handleEditProduct = (product: Product) => {
      setEditingProduct(product);
      setProductFormData(product);
      setIsProductFormOpen(true);
  };

  const handleCreateProduct = () => {
      setEditingProduct(null);
      setProductFormData({ name: '', type: AlcoholType.WHISKEY, size: '', brand: '', sku: '', costPrice: 0, sellingPrice: 0, stock: 0, lowStockThreshold: 5 });
      setIsProductFormOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const payload = productFormData as Product;
      
      if (editingProduct) {
          updateProduct(payload);
      } else {
          const { id, ...rest } = payload;
          addProduct(rest);
      }
      setIsProductFormOpen(false);
  };

  // --- User Handlers ---
  const handleEditUser = (user: User) => {
      setEditingUser(user);
      setUserFormData({ ...user });
      setIsUserFormOpen(true);
  };

  const handleCreateUser = () => {
      setEditingUser(null);
      setUserFormData({
          name: '',
          pin: '',
          role: Role.CASHIER,
          permissions: ['POS']
      });
      setIsUserFormOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Basic validation
      if (!userFormData.name || !userFormData.pin) {
          alert('Name and PIN are required');
          return;
      }

      if (editingUser) {
          const updatedUser = { ...editingUser, ...userFormData } as User;
          updateUser(updatedUser);
      } else {
          addUser(userFormData as Omit<User, 'id'>);
      }
      setIsUserFormOpen(false);
  };

  const handleDeleteUser = (id: string) => {
      if (confirm('Are you sure you want to delete this user?')) {
          deleteUser(id);
      }
  };

  const handleRoleChange = (newRole: Role) => {
      let perms: string[] = [];
      if (newRole === Role.ADMIN) perms = ['POS', 'INVENTORY', 'REPORTS', 'ADMIN'];
      else if (newRole === Role.MANAGER) perms = ['POS', 'INVENTORY', 'REPORTS'];
      else perms = ['POS'];
      
      setUserFormData({ ...userFormData, role: newRole, permissions: perms });
  };

  const togglePermission = (perm: string) => {
      const currentPerms = userFormData.permissions || [];
      if (currentPerms.includes(perm)) {
          setUserFormData({ ...userFormData, permissions: currentPerms.filter(p => p !== perm) });
      } else {
          setUserFormData({ ...userFormData, permissions: [...currentPerms, perm] });
      }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-slate-800">Admin Control Panel</h1>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200">
            <button 
                onClick={() => setActiveSection('PRODUCTS')} 
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === 'PRODUCTS' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
            >
                Products
            </button>
            <button 
                onClick={() => setActiveSection('USERS')} 
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === 'USERS' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
            >
                Users & Access
            </button>
            <button 
                onClick={() => setActiveSection('LOGS')} 
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === 'LOGS' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
            >
                Audit Logs
            </button>
        </div>
      </div>

      {/* --- PRODUCTS SECTION --- */}
      {activeSection === 'PRODUCTS' && (
          <>
            <div className="mb-4 flex justify-end">
                <button onClick={handleCreateProduct} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium">
                    <PlusCircle size={18} /> Add New Product
                </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Size</th>
                            <th className="px-6 py-4">SKU</th>
                            <th className="px-6 py-4">Alert Level</th>
                            <th className="px-6 py-4">Price</th>
                            <th className="px-6 py-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium">{p.name}</td>
                                <td className="px-6 py-4">{p.size}</td>
                                <td className="px-6 py-4 font-mono text-slate-500">{p.sku}</td>
                                <td className="px-6 py-4 font-bold">{p.lowStockThreshold || 5}</td>
                                <td className="px-6 py-4">{CURRENCY_FORMATTER.format(p.sellingPrice)}</td>
                                <td className="px-6 py-4">
                                    <button onClick={() => handleEditProduct(p)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </>
      )}

      {/* --- USERS SECTION --- */}
      {activeSection === 'USERS' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                   <div>
                       <h2 className="text-lg font-bold flex items-center gap-2"><UserCog size={20}/> User Management</h2>
                       <p className="text-sm text-slate-500">Manage PINs and access privileges for staff.</p>
                   </div>
                   <button onClick={handleCreateUser} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm">
                        <UserPlus size={18} /> Add New User
                   </button>
               </div>
               <table className="w-full text-left">
                   <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                       <tr>
                           <th className="px-6 py-4">Name</th>
                           <th className="px-6 py-4">Role</th>
                           <th className="px-6 py-4">PIN</th>
                           <th className="px-6 py-4">Access Rights</th>
                           <th className="px-6 py-4">Action</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-sm">
                       {users.map(u => (
                           <tr key={u.id} className="hover:bg-slate-50">
                               <td className="px-6 py-4 font-bold text-slate-800">{u.name}</td>
                               <td className="px-6 py-4">
                                   <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600">{u.role}</span>
                               </td>
                               <td className="px-6 py-4 font-mono">****</td>
                               <td className="px-6 py-4">
                                   <div className="flex flex-wrap gap-1">
                                       {u.permissions?.map(p => (
                                           <span key={p} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{p}</span>
                                       ))}
                                   </div>
                               </td>
                               <td className="px-6 py-4 flex gap-2">
                                   <button onClick={() => handleEditUser(u)} className="text-amber-600 hover:text-amber-800 font-bold text-sm">Edit</button>
                                   {u.id !== currentUser?.id && (
                                       <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600 ml-2" title="Delete User">
                                           <Trash2 size={16} />
                                       </button>
                                   )}
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
      )}

      {/* --- LOGS SECTION --- */}
      {activeSection === 'LOGS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                      <tr>
                          <th className="px-6 py-4">Time</th>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Action</th>
                          <th className="px-6 py-4">Details</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                      {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="px-6 py-4 font-medium">{log.userName}</td>
                              <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">{log.action}</span>
                              </td>
                              <td className="px-6 py-4 text-slate-600">{log.details}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* Product Form Modal */}
      {isProductFormOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-6">{editingProduct ? 'Edit Product' : 'Create Product'}</h2>
                  <form onSubmit={handleProductSubmit} className="grid grid-cols-2 gap-4">
                      {/* ... existing fields ... */}
                      <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Product Name</label>
                          <input required type="text" className="w-full border p-2 rounded" value={productFormData.name} onChange={e => setProductFormData({...productFormData, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Type</label>
                          <select className="w-full border p-2 rounded" value={productFormData.type} onChange={e => setProductFormData({...productFormData, type: e.target.value as AlcoholType})}>
                              {Object.values(AlcoholType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Size (e.g. 750ml)</label>
                          <input required type="text" className="w-full border p-2 rounded" value={productFormData.size} onChange={e => setProductFormData({...productFormData, size: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">SKU / Barcode</label>
                          <input required type="text" className="w-full border p-2 rounded" value={productFormData.sku} onChange={e => setProductFormData({...productFormData, sku: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Brand</label>
                          <input required type="text" className="w-full border p-2 rounded" value={productFormData.brand} onChange={e => setProductFormData({...productFormData, brand: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1 text-red-600">Low Stock Alert Level</label>
                          <input required type="number" className="w-full border p-2 rounded focus:ring-red-500" value={productFormData.lowStockThreshold} onChange={e => setProductFormData({...productFormData, lowStockThreshold: parseInt(e.target.value) || 0})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Cost Price</label>
                          <input required type="number" step="0.01" className="w-full border p-2 rounded" value={productFormData.costPrice} onChange={e => setProductFormData({...productFormData, costPrice: parseFloat(e.target.value)})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Selling Price</label>
                          <input required type="number" step="0.01" className="w-full border p-2 rounded" value={productFormData.sellingPrice} onChange={e => setProductFormData({...productFormData, sellingPrice: parseFloat(e.target.value)})} />
                      </div>
                      
                      <div className="col-span-2 flex gap-4 mt-6">
                          <button type="submit" className="flex-1 bg-slate-900 text-white py-3 rounded-lg font-bold">Save Product</button>
                          <button type="button" onClick={() => setIsProductFormOpen(false)} className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500">Cancel</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* User Edit Modal */}
      {isUserFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full">
                <h2 className="text-xl font-bold mb-4">{editingUser ? `Edit User: ${editingUser.name}` : 'Create New User'}</h2>

                <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:border-amber-500" 
                            value={userFormData.name} 
                            onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Role</label>
                        <select 
                            className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:border-amber-500"
                            value={userFormData.role}
                            onChange={(e) => handleRoleChange(e.target.value as Role)}
                        >
                            {Object.values(Role).map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Login PIN</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 p-3 rounded-lg font-mono tracking-widest outline-none focus:border-amber-500" 
                            value={userFormData.pin} 
                            onChange={e => setUserFormData({...userFormData, pin: e.target.value})}
                            maxLength={4}
                            placeholder="****"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Access Privileges</label>
                        <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            {['POS', 'INVENTORY', 'REPORTS', 'ADMIN'].map(perm => (
                                <label key={perm} className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-2 rounded">
                                    <input 
                                        type="checkbox" 
                                        checked={userFormData.permissions?.includes(perm)} 
                                        onChange={() => togglePermission(perm)}
                                        className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                                    />
                                    <span className="font-medium text-slate-700">{perm} Access</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold">Save User</button>
                        <button type="button" onClick={() => setIsUserFormOpen(false)} className="flex-1 border border-slate-300 py-3 rounded-lg font-bold text-slate-500">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Admin;