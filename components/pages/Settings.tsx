'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Settings as SettingsIcon, Building2, Phone, Mail, MapPin, Save, Image, FileText, Upload, X } from 'lucide-react';

const Settings = () => {
  const { businessSettings, updateBusinessSettings, currentUser } = useStore();
  const [formData, setFormData] = useState({ businessName: '', tagline: '', phone: '', email: '', location: '', logoUrl: '', receiptFooter: '' });
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (businessSettings) {
      setFormData({ businessName: businessSettings.businessName || '', tagline: businessSettings.tagline || '', phone: businessSettings.phone || '', email: businessSettings.email || '', location: businessSettings.location || '', logoUrl: businessSettings.logoUrl || '', receiptFooter: businessSettings.receiptFooter || '' });
    }
  }, [businessSettings]);

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await updateBusinessSettings({ id: 'default', ...formData }); setSaved(true); setTimeout(() => setSaved(false), 3000); };
  const handleChange = (field: string, value: string) => { setFormData(prev => ({ ...prev, [field]: value })); };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Logo file must be less than 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, logoUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!currentUser?.permissions?.includes('ADMIN')) {
    return (<div className="p-6 flex items-center justify-center h-full"><div className="text-center"><div className="text-6xl mb-4">🔒</div><h2 className="text-xl font-bold text-slate-800">Access Denied</h2><p className="text-slate-500 mt-2">Only administrators can access settings.</p></div></div>);
  }

  return (
    <div className="p-3 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2"><SettingsIcon size={24} /> Business Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your business information for receipts and branding.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Building2 size={18} /> Business Identity</h2>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Business Name *</label><input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Port Side Liquor Store" value={formData.businessName} onChange={(e) => handleChange('businessName', e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Tagline (Optional)</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Your favorite neighborhood liquor store" value={formData.tagline} onChange={(e) => handleChange('tagline', e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Phone size={18} /> Contact Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1"><Phone size={14} /> Phone Number *</label><input type="tel" required className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="+254 700 000000" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1"><Mail size={14} /> Email Address</label><input type="email" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="hello@portside.co.ke" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1"><MapPin size={14} /> Location / Address *</label><input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Westlands, Nairobi, Kenya" value={formData.location} onChange={(e) => handleChange('location', e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText size={18} /> Receipt Customization</h2>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1"><Image size={14} /> Logo URL (Optional)</label><input type="url" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="https://example.com/logo.png or /icons/icon-192x192.png" value={formData.logoUrl} onChange={(e) => handleChange('logoUrl', e.target.value)} /><p className="text-xs text-slate-500 mt-1">Use /icons/icon-192x192.png for the app icon</p></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Receipt Footer Message</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Thank you for shopping with us!" rows={2} value={formData.receiptFooter} onChange={(e) => handleChange('receiptFooter', e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 lg:p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-3">Receipt Preview</h3>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100 max-w-xs mx-auto text-center">
            {formData.logoUrl ? (<img src={formData.logoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />) : (<div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-2 flex items-center justify-center text-slate-400"><Image size={24} /></div>)}
            <h4 className="font-bold text-slate-900">{formData.businessName || 'Business Name'}</h4>
            {formData.tagline && <p className="text-xs text-slate-500">{formData.tagline}</p>}
            <p className="text-xs text-slate-500 mt-2">{formData.location || 'Location'}</p>
            <p className="text-xs text-slate-500">{formData.phone || 'Phone'}</p>
            {formData.email && <p className="text-xs text-slate-500">{formData.email}</p>}
            <div className="border-t border-dashed border-slate-200 my-3"></div>
            <p className="text-xs text-slate-400 italic">{formData.receiptFooter || 'Thank you for your business!'}</p>
          </div>
        </div>

        <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 lg:py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"><Save size={20} /> Save Settings</button>
        {saved && (<div className="bg-green-100 text-green-800 px-4 py-3 rounded-lg text-center font-medium text-sm">✓ Settings saved successfully!</div>)}
      </form>
    </div>
  );
};

export default Settings;
