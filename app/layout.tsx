'use client';

import React, { useEffect } from 'react';
import './globals.css';
import { StoreProvider } from '../context/StoreContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('SW registered:', registration.scope);

          // Check for updates every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60000);

          // Force update on page load
          registration.update();

          // Listen for new service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New service worker available! Reloading...');
                  // Auto-reload to activate new service worker
                  window.location.reload();
                }
              });
            }
          });
        },
        (err) => console.log('SW registration failed:', err)
      );
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>Port Side Liquor POS</title>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" type="image/png" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-gray-100 text-gray-900 antialiased select-none">
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
