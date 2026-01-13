'use client';

import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Lock, Loader2 } from 'lucide-react';

const Login = () => {
  const { login, businessSettings, isLoading } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(false);
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (!login(pin)) {
      setError(true);
      setPin('');
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 size={48} className="text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          {businessSettings?.logoUrl ? (
            <img src={businessSettings.logoUrl} alt="Logo" className="w-32 h-32 mx-auto mb-6 rounded-2xl object-contain" />
          ) : (
            <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="text-amber-600" size={48} />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{businessSettings?.businessName || 'Grab Bottle '}</h1>
          <p className="text-slate-500">Enter your PIN to access the terminal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Security PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              className="w-full text-center text-3xl tracking-widest py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none border-slate-300"
              placeholder="••••"
              maxLength={4}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center font-medium">Invalid PIN. Try again.</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || !pin}
            className="w-full bg-slate-900 text-white py-4 rounded-lg font-bold text-lg hover:bg-slate-800 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoggingIn ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Logging in...
              </>
            ) : (
              'Access System'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
