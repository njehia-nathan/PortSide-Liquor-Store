'use client';

import React, { PropsWithChildren, useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { dbPromise } from '../db';
import { notifySuccess, notifyError, notifyWarning } from '../utils/notifications';
import {
  LogOut,
  ShoppingCart,
  Package,
  BarChart3,
  ShieldAlert,
  Cloud,
  CloudOff,
  RefreshCw,
  Save,
  Menu,
  X,
  Settings,
  Clock,
  Users,
  Ban,
  CheckSquare,
  AlertTriangle,
  DollarSign,
  Edit2,
  Check,
  AlertCircle
} from 'lucide-react';

const AppLayout = ({ children }: PropsWithChildren) => {
  const { currentUser, logout, currentShift, isOnline, isSyncing, auditLogs, businessSettings, products, updateProduct, sales, productSaleLogs } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [lastSaved, setLastSaved] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);
  const [showProductWarning, setShowProductWarning] = useState(false);
  const [productsWithIssues, setProductsWithIssues] = useState<any[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(new Set());
  
  // Sales validation state
  const [showSalesWarning, setShowSalesWarning] = useState(false);
  const [corruptedSales, setCorruptedSales] = useState<any[]>([]);
  const [missingSaleLogs, setMissingSaleLogs] = useState<any[]>([]);
  const [duplicateLogs, setDuplicateLogs] = useState<any[]>([]);
  const [editingSaleItemId, setEditingSaleItemId] = useState<string | null>(null);
  const [editItemCost, setEditItemCost] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [fixedSaleItemIds, setFixedSaleItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (auditLogs.length > 0) {
      const date = new Date(auditLogs[0].timestamp);
      setLastSaved(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } else {
      setLastSaved('Just now');
    }
  }, [auditLogs]);

  useEffect(() => {
    // Show banner when going offline
    if (!isOnline) {
      setShowOfflineBanner(true);
    }
  }, [isOnline]);

  useEffect(() => {
    // Check for products with missing costs when admin logs in
    if (currentUser && currentUser.permissions?.includes('ADMIN')) {
      const issueProducts = products.filter(p =>
        p.costPrice === 0 || p.sellingPrice === 0 ||
        isNaN(p.costPrice) || isNaN(p.sellingPrice)
      );

      setProductsWithIssues(issueProducts);
      
      // Always show warning if there are issues (until all are fixed)
      if (issueProducts.length > 0) {
        setShowProductWarning(true);
      } else {
        setShowProductWarning(false);
        setSavedProductIds(new Set()); // Reset saved state when all fixed
      }
    }
  }, [currentUser, products]);

  useEffect(() => {
    // Check for corrupted sales and missing logs when admin logs in
    if (currentUser && currentUser.permissions?.includes('ADMIN')) {
      // Check if user dismissed the dialog in this session
      const dismissed = sessionStorage.getItem('sales_validation_dismissed');
      
      // Find sales with 0 cost or price items (including NaN and undefined)
      const badSales = sales.filter(sale => {
        if (sale.isVoided) return false;
        return sale.items.some(item => 
          !item.costAtSale || item.costAtSale === 0 || isNaN(item.costAtSale) ||
          !item.priceAtSale || item.priceAtSale === 0 || isNaN(item.priceAtSale)
        );
      });

      // Find sales with missing product sale logs
      const missingLogs: any[] = [];
      sales.forEach(sale => {
        if (sale.isVoided) return;
        sale.items.forEach(item => {
          const logExists = productSaleLogs.some(log => 
            log.saleId === sale.id && log.productId === item.productId
          );
          if (!logExists) {
            missingLogs.push({
              saleId: sale.id,
              saleTimestamp: sale.timestamp,
              cashierName: sale.cashierName,
              item: item
            });
          }
        });
      });

      // Find duplicate logs (same saleId + productId)
      const logMap = new Map<string, any[]>();
      productSaleLogs.forEach(log => {
        const key = `${log.saleId}-${log.productId}`;
        if (!logMap.has(key)) {
          logMap.set(key, []);
        }
        logMap.get(key)!.push(log);
      });

      const duplicates: any[] = [];
      logMap.forEach((logs, key) => {
        if (logs.length > 1) {
          // Keep the first log, mark others as duplicates
          logs.slice(1).forEach(log => {
            duplicates.push(log);
          });
        }
      });

      setCorruptedSales(badSales);
      setMissingSaleLogs(missingLogs);
      setDuplicateLogs(duplicates);

      // Only show warning if there are issues AND user hasn't dismissed it this session
      if ((badSales.length > 0 || missingLogs.length > 0 || duplicates.length > 0) && !dismissed) {
        setShowSalesWarning(true);
      } else if (badSales.length === 0 && missingLogs.length === 0 && duplicates.length === 0) {
        // Clear dismissal flag if all issues are resolved
        sessionStorage.removeItem('sales_validation_dismissed');
        setShowSalesWarning(false);
        setFixedSaleItemIds(new Set());
      }
    }
  }, [currentUser, sales, productSaleLogs]);

  if (!currentUser) {
    return <>{children}</>;
  }

  const isActive = (path: string) => pathname === path ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800";
  const hasPerm = (perm: string) => currentUser.permissions?.includes(perm);

  const handleEditProduct = (product: any) => {
    setEditingProductId(product.id);
    setEditCostPrice(String(product.costPrice || ''));
    setEditSellingPrice(String(product.sellingPrice || ''));
  };

  const handleSaveProduct = async (product: any) => {
    const costPrice = parseFloat(editCostPrice) || 0;
    const sellingPrice = parseFloat(editSellingPrice) || 0;

    if (costPrice <= 0 || sellingPrice <= 0) {
      alert('Both Cost Price and Selling Price must be greater than 0');
      return;
    }

    try {
      await updateProduct({ ...product, costPrice, sellingPrice });
      setSavedProductIds(prev => new Set(prev).add(product.id));
      setEditingProductId(null);
      setEditCostPrice('');
      setEditSellingPrice('');
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('Failed to update product. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditCostPrice('');
    setEditSellingPrice('');
  };

  const handleBulkFixProducts = async () => {
    if (!confirm(`Fix all ${productsWithIssues.length} products by setting missing prices to 0.01? You can edit them individually after.`)) {
      return;
    }

    try {
      // Use Promise.all for parallel execution
      await Promise.all(
        productsWithIssues.map(async (product) => {
          const costPrice = product.costPrice === 0 || isNaN(product.costPrice) ? 0.01 : product.costPrice;
          const sellingPrice = product.sellingPrice === 0 || isNaN(product.sellingPrice) ? 0.01 : product.sellingPrice;
          
          await updateProduct({ ...product, costPrice, sellingPrice });
          setSavedProductIds(prev => new Set(prev).add(product.id));
        })
      );
      alert(`✓ Successfully fixed ${productsWithIssues.length} products`);
    } catch (error) {
      console.error('Bulk fix failed:', error);
      alert('Bulk fix failed. Please try again.');
    }
  };

  const handleEditSaleItem = (saleId: string, itemIndex: number, item: any) => {
    const uniqueId = `${saleId}-${itemIndex}`;
    setEditingSaleItemId(uniqueId);
    setEditItemCost(String(item.costAtSale || ''));
    setEditItemPrice(String(item.priceAtSale || ''));
  };

  const handleFixSaleItem = async (sale: any, itemIndex: number) => {
    const costAtSale = parseFloat(editItemCost) || 0;
    const priceAtSale = parseFloat(editItemPrice) || 0;

    if (costAtSale <= 0 || priceAtSale <= 0) {
      alert('Both Cost and Price must be greater than 0');
      return;
    }

    try {
      const db = await dbPromise();
      const tx = db.transaction(['sales', 'productSaleLogs', 'syncQueue'], 'readwrite');

      // Update the sale item
      const updatedItems = [...sale.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        costAtSale,
        priceAtSale
      };

      // Recalculate totals
      const newTotalAmount = updatedItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      const newTotalCost = updatedItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);

      const updatedSale = {
        ...sale,
        items: updatedItems,
        totalAmount: newTotalAmount,
        totalCost: newTotalCost
      };

      await tx.objectStore('sales').put(updatedSale);
      await tx.objectStore('syncQueue').add({
        type: 'UPDATE_SALE',
        payload: updatedSale,
        timestamp: Date.now()
      });

      // Update or create product sale log
      const item = updatedItems[itemIndex];
      const existingLog = productSaleLogs.find(log => 
        log.saleId === sale.id && log.productId === item.productId
      );

      if (existingLog) {
        const updatedLog = {
          ...existingLog,
          costAtSale,
          priceAtSale
        };
        await tx.objectStore('productSaleLogs').put(updatedLog);
        await tx.objectStore('syncQueue').add({
          type: 'UPDATE_PRODUCT_SALE_LOG',
          payload: updatedLog,
          timestamp: Date.now()
        });
      } else {
        // Create missing log
        const newLog = {
          id: `${sale.id}-${item.productId}-${Date.now()}`,
          productId: item.productId,
          productName: item.productName,
          saleId: sale.id,
          quantity: item.quantity,
          priceAtSale,
          costAtSale,
          timestamp: sale.timestamp,
          cashierId: sale.cashierId,
          cashierName: sale.cashierName
        };
        await tx.objectStore('productSaleLogs').put(newLog);
        await tx.objectStore('syncQueue').add({
          type: 'PRODUCT_SALE_LOG',
          payload: newLog,
          timestamp: Date.now()
        });
      }

      await tx.done;

      const uniqueId = `${sale.id}-${itemIndex}`;
      setFixedSaleItemIds(prev => new Set(prev).add(uniqueId));
      setEditingSaleItemId(null);
      setEditItemCost('');
      setEditItemPrice('');

      // Force re-render by updating the corrupted sales list
      setCorruptedSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
    } catch (error) {
      console.error('Failed to fix sale item:', error);
      alert('Failed to fix sale item. Please try again.');
    }
  };

  const handleCancelSaleEdit = () => {
    setEditingSaleItemId(null);
    setEditItemCost('');
    setEditItemPrice('');
  };

  const handleCreateMissingLog = async (missingLog: any) => {
    try {
      const db = await dbPromise();
      
      // Look up product and check price history for accurate historical prices
      const product = products.find(p => p.id === missingLog.item.productId);
      let costAtSale = missingLog.item.costAtSale;
      let priceAtSale = missingLog.item.priceAtSale;

      if (product) {
        // Check price history first for prices at the time of sale
        if (product.priceHistory && product.priceHistory.length > 0) {
          const saleDate = new Date(missingLog.saleTimestamp).getTime();
          const relevantPriceChange = product.priceHistory
            .filter(ph => new Date(ph.timestamp).getTime() <= saleDate)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

          if (relevantPriceChange) {
            if (!priceAtSale || priceAtSale === 0 || isNaN(priceAtSale)) {
              priceAtSale = relevantPriceChange.newSellingPrice || product.sellingPrice;
            }
            if (!costAtSale || costAtSale === 0 || isNaN(costAtSale)) {
              costAtSale = relevantPriceChange.newCostPrice || product.costPrice;
            }
          }
        }

        // Fallback to current prices if no history found
        if (!costAtSale || costAtSale === 0 || isNaN(costAtSale)) {
          costAtSale = product.costPrice || 0;
        }
        if (!priceAtSale || priceAtSale === 0 || isNaN(priceAtSale)) {
          priceAtSale = product.sellingPrice || 0;
        }
      }

      if (!costAtSale || costAtSale === 0 || !priceAtSale || priceAtSale === 0) {
        alert(`Cannot create log: Product "${missingLog.item.productName}" has no valid prices. Please update product prices in inventory first.`);
        return;
      }

      const tx = db.transaction(['productSaleLogs', 'syncQueue'], 'readwrite');

      const newLog = {
        id: `${missingLog.saleId}-${missingLog.item.productId}-${Date.now()}`,
        productId: missingLog.item.productId,
        productName: missingLog.item.productName,
        saleId: missingLog.saleId,
        quantity: missingLog.item.quantity,
        priceAtSale,
        costAtSale,
        timestamp: missingLog.saleTimestamp,
        cashierId: missingLog.item.cashierId || 'unknown',
        cashierName: missingLog.cashierName
      };

      await tx.objectStore('productSaleLogs').put(newLog);
      await tx.objectStore('syncQueue').add({
        type: 'PRODUCT_SALE_LOG',
        payload: newLog,
        timestamp: Date.now()
      });

      await tx.done;

      // Remove from missing logs list
      setMissingSaleLogs(prev => prev.filter(log => 
        !(log.saleId === missingLog.saleId && log.item.productId === missingLog.item.productId)
      ));

      alert('✓ Missing log created successfully');
    } catch (error) {
      console.error('Failed to create missing log:', error);
      alert('Failed to create missing log. Please try again.');
    }
  };

  const handleBulkFixSales = async () => {
    let fixableCount = 0;
    let unfixableCount = 0;

    // Count fixable items
    corruptedSales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const hasIssue = !item.costAtSale || item.costAtSale === 0 || isNaN(item.costAtSale) ||
                        !item.priceAtSale || item.priceAtSale === 0 || isNaN(item.priceAtSale);
        if (hasIssue) {
          const product = products.find(p => p.id === item.productId);
          if (product && product.costPrice > 0 && product.sellingPrice > 0) {
            fixableCount++;
          } else {
            unfixableCount++;
          }
        }
      });
    });

    if (fixableCount === 0) {
      notifyWarning('No items can be auto-fixed. Products must have valid prices in inventory first.');
      return;
    }

    try {
      const db = await dbPromise();
      
      // Use Promise.all for parallel processing
      await Promise.all(
        corruptedSales.map(async (sale) => {
          let saleUpdated = false;
          const updatedItems = [...sale.items];

          for (let itemIndex = 0; itemIndex < sale.items.length; itemIndex++) {
            const item = sale.items[itemIndex];
            const hasIssue = !item.costAtSale || item.costAtSale === 0 || isNaN(item.costAtSale) ||
                            !item.priceAtSale || item.priceAtSale === 0 || isNaN(item.priceAtSale);
            
            if (hasIssue) {
              const product = products.find(p => p.id === item.productId);
              
              if (product) {
                let newCostAtSale = item.costAtSale;
                let newPriceAtSale = item.priceAtSale;

                // Check price history for prices at the time of sale
                if (product.priceHistory && product.priceHistory.length > 0) {
                  const saleDate = new Date(sale.timestamp).getTime();
                  const relevantPriceChange = product.priceHistory
                    .filter(ph => new Date(ph.timestamp).getTime() <= saleDate)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

                  if (relevantPriceChange) {
                    if (!newPriceAtSale || newPriceAtSale === 0 || isNaN(newPriceAtSale)) {
                      newPriceAtSale = relevantPriceChange.newSellingPrice || product.sellingPrice;
                    }
                    if (!newCostAtSale || newCostAtSale === 0 || isNaN(newCostAtSale)) {
                      newCostAtSale = relevantPriceChange.newCostPrice || product.costPrice;
                    }
                  }
                }

                // Fallback to current prices if no history found
                if (!newPriceAtSale || newPriceAtSale === 0 || isNaN(newPriceAtSale)) {
                  newPriceAtSale = product.sellingPrice;
                }
                if (!newCostAtSale || newCostAtSale === 0 || isNaN(newCostAtSale)) {
                  newCostAtSale = product.costPrice;
                }

                // Only update if we have valid prices
                if (newCostAtSale > 0 && newPriceAtSale > 0) {
                  updatedItems[itemIndex] = {
                    ...item,
                    costAtSale: newCostAtSale,
                    priceAtSale: newPriceAtSale
                  };
                  saleUpdated = true;

                  const uniqueId = `${sale.id}-${itemIndex}`;
                  setFixedSaleItemIds(prev => new Set(prev).add(uniqueId));
                }
              }
            }
          }

          if (saleUpdated) {
            const tx = db.transaction(['sales', 'productSaleLogs', 'syncQueue'], 'readwrite');
            
            const newTotalAmount = updatedItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
            const newTotalCost = updatedItems.reduce((sum, item) => sum + (item.costAtSale * item.quantity), 0);

            const updatedSale = {
              ...sale,
              items: updatedItems,
              totalAmount: newTotalAmount,
              totalCost: newTotalCost
            };

            await tx.objectStore('sales').put(updatedSale);
            await tx.objectStore('syncQueue').add({
              type: 'UPDATE_SALE',
              payload: updatedSale,
              timestamp: Date.now()
            });

            // Update logs - prevent duplicates
            for (const item of updatedItems) {
              const existingLog = productSaleLogs.find(log => 
                log.saleId === sale.id && log.productId === item.productId
              );

              if (existingLog) {
                const updatedLog = {
                  ...existingLog,
                  costAtSale: item.costAtSale,
                  priceAtSale: item.priceAtSale
                };
                await tx.objectStore('productSaleLogs').put(updatedLog);
                await tx.objectStore('syncQueue').add({
                  type: 'UPDATE_PRODUCT_SALE_LOG',
                  payload: updatedLog,
                  timestamp: Date.now()
                });
              }
            }

            await tx.done;
            setCorruptedSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
          }
        })
      )

      const message = unfixableCount > 0
        ? `Fixed ${fixableCount} items. ${unfixableCount} items need manual fixing.`
        : `Successfully fixed ${fixableCount} items`;
      
      notifySuccess(message);
    } catch (error) {
      console.error('Bulk fix failed:', error);
      notifyError('Bulk fix failed. Please try again.');
    }
  };

  const handleDeleteDuplicateLog = async (log: any) => {
    try {
      // STEP 1: Update Supabase FIRST if online
      if (isOnline) {
        const { pushToCloud } = await import('../cloud');
        const success = await pushToCloud('DELETE_PRODUCT_SALE_LOG', { id: log.id });
        
        if (!success) {
          throw new Error('Failed to delete from Supabase');
        }
      }

      // STEP 2: Then update local IndexedDB
      const db = await dbPromise();
      await db.delete('productSaleLogs', log.id);

      // STEP 3: If offline, queue for later sync
      if (!isOnline) {
        await db.add('syncQueue', {
          type: 'DELETE_PRODUCT_SALE_LOG',
          payload: { id: log.id },
          timestamp: Date.now()
        });
      }

      // Remove from duplicates list
      setDuplicateLogs(prev => prev.filter(l => l.id !== log.id));

      notifySuccess(`Deleted duplicate log for ${log.productName}`);
    } catch (error) {
      console.error('Failed to delete duplicate log:', error);
      notifyError('Failed to delete duplicate log. Please try again.');
    }
  };

  const handleBulkDeleteDuplicates = async () => {
    try {
      const count = duplicateLogs.length;

      // STEP 1: Update Supabase FIRST if online
      if (isOnline) {
        const { pushToCloud } = await import('../cloud');
        const results = await Promise.all(
          duplicateLogs.map(log => 
            pushToCloud('DELETE_PRODUCT_SALE_LOG', { id: log.id })
          )
        );
        
        // Check if any failed
        const failedCount = results.filter(r => !r).length;
        if (failedCount > 0) {
          throw new Error(`Failed to delete ${failedCount} logs from Supabase`);
        }
      }

      // STEP 2: Then update local IndexedDB
      const db = await dbPromise();
      await Promise.all(
        duplicateLogs.map(log => db.delete('productSaleLogs', log.id))
      );

      // STEP 3: If offline, queue for later sync
      if (!isOnline) {
        await Promise.all(
          duplicateLogs.map(log => 
            db.add('syncQueue', {
              type: 'DELETE_PRODUCT_SALE_LOG',
              payload: { id: log.id },
              timestamp: Date.now()
            })
          )
        );
      }

      setDuplicateLogs([]);

      notifySuccess(`Successfully deleted ${count} duplicate logs`);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      notifyError('Bulk delete failed. Please try again.');
    }
  };

  const handleBulkCreateLogs = async () => {
    try {
      const db = await dbPromise();
      let createdCount = 0;
      let downloadedCount = 0;
      let skippedCount = 0;
      const downloadedLogs: any[] = [];
      const newlyCreatedLogs: any[] = [];

      // STEP 1: Check Supabase for existing logs if online
      if (isOnline) {
        const { supabase } = await import('../cloud');
        
        // Get all sale IDs that need logs
        const saleIds = [...new Set(missingSaleLogs.map(log => log.saleId))];
        
        // Fetch existing logs from Supabase for these sales
        const { data: cloudLogs, error } = await supabase
          .from('product_sale_logs')
          .select('*')
          .in('saleId', saleIds);

        if (error) {
          console.error('Failed to fetch logs from Supabase:', error);
          throw new Error('Failed to check existing logs in cloud');
        }

        // Download existing logs to local IndexedDB
        if (cloudLogs && cloudLogs.length > 0) {
          for (const cloudLog of cloudLogs) {
            // Check if this log is in our missing list
            const isMissing = missingSaleLogs.some(ml => 
              ml.saleId === cloudLog.saleId && ml.item.productId === cloudLog.productId
            );

            if (isMissing) {
              await db.put('productSaleLogs', cloudLog);
              downloadedLogs.push(cloudLog);
              downloadedCount++;
            }
          }
        }

        // Filter out logs that now exist (either locally or downloaded from cloud)
        const remainingMissing = missingSaleLogs.filter(log => {
          const existsInCloud = cloudLogs?.some(cl => 
            cl.saleId === log.saleId && cl.productId === log.item.productId
          );
          const existsLocally = productSaleLogs.some(pl => 
            pl.saleId === log.saleId && pl.productId === log.item.productId
          );
          return !existsInCloud && !existsLocally;
        });

        // STEP 2: Create only truly missing logs
        if (remainingMissing.length > 0) {
          const tx = db.transaction(['productSaleLogs', 'syncQueue'], 'readwrite');

          await Promise.all(
            remainingMissing.map(async (log) => {
              const product = products.find(p => p.id === log.item.productId);
              let costAtSale = log.item.costAtSale;
              let priceAtSale = log.item.priceAtSale;

              if (product) {
                if (product.priceHistory && product.priceHistory.length > 0) {
                  const saleDate = new Date(log.saleTimestamp).getTime();
                  const relevantPriceChange = product.priceHistory
                    .filter(ph => new Date(ph.timestamp).getTime() <= saleDate)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

                  if (relevantPriceChange) {
                    if (!priceAtSale || priceAtSale === 0 || isNaN(priceAtSale)) {
                      priceAtSale = relevantPriceChange.newSellingPrice || product.sellingPrice;
                    }
                    if (!costAtSale || costAtSale === 0 || isNaN(costAtSale)) {
                      costAtSale = relevantPriceChange.newCostPrice || product.costPrice;
                    }
                  }
                }

                if (!costAtSale || costAtSale === 0 || isNaN(costAtSale)) {
                  costAtSale = product.costPrice || 0;
                }
                if (!priceAtSale || priceAtSale === 0 || isNaN(priceAtSale)) {
                  priceAtSale = product.sellingPrice || 0;
                }
              }

              if (!costAtSale || costAtSale === 0 || !priceAtSale || priceAtSale === 0) {
                console.warn(`Skipping log for ${log.item.productName}: No valid prices`);
                skippedCount++;
                return;
              }

              const newLog = {
                id: `${log.saleId}-${log.item.productId}-${Date.now()}-${Math.random()}`,
                productId: log.item.productId,
                productName: log.item.productName,
                saleId: log.saleId,
                quantity: log.item.quantity,
                priceAtSale,
                costAtSale,
                timestamp: log.saleTimestamp,
                cashierId: log.item.cashierId || 'unknown',
                cashierName: log.cashierName
              };

              await tx.objectStore('productSaleLogs').put(newLog);
              await tx.objectStore('syncQueue').add({
                type: 'PRODUCT_SALE_LOG',
                payload: newLog,
                timestamp: Date.now()
              });

              newlyCreatedLogs.push(newLog);
              createdCount++;
            })
          );

          await tx.done;
        }
      } else {
        // Offline: Create all missing logs locally and queue for sync
        const tx = db.transaction(['productSaleLogs', 'syncQueue'], 'readwrite');

        await Promise.all(
          missingSaleLogs.map(async (log) => {
            const existingLog = productSaleLogs.find(existing => 
              existing.saleId === log.saleId && existing.productId === log.item.productId
            );

            if (existingLog) {
              skippedCount++;
              return;
            }

            const product = products.find(p => p.id === log.item.productId);
            let costAtSale = log.item.costAtSale || product?.costPrice || 0;
            let priceAtSale = log.item.priceAtSale || product?.sellingPrice || 0;

            if (!costAtSale || !priceAtSale) {
              skippedCount++;
              return;
            }

            const newLog = {
              id: `${log.saleId}-${log.item.productId}-${Date.now()}-${Math.random()}`,
              productId: log.item.productId,
              productName: log.item.productName,
              saleId: log.saleId,
              quantity: log.item.quantity,
              priceAtSale,
              costAtSale,
              timestamp: log.saleTimestamp,
              cashierId: log.item.cashierId || 'unknown',
              cashierName: log.cashierName
            };

            await tx.objectStore('productSaleLogs').put(newLog);
            await tx.objectStore('syncQueue').add({
              type: 'PRODUCT_SALE_LOG',
              payload: newLog,
              timestamp: Date.now()
            });

            newlyCreatedLogs.push(newLog);
            createdCount++;
          })
        );

        await tx.done;
      }

      // CRITICAL: Update React state so detection logic sees the new logs immediately
      if (downloadedLogs.length > 0 || newlyCreatedLogs.length > 0) {
        const allNewLogs = [...downloadedLogs, ...newlyCreatedLogs];
        // Update productSaleLogs context from StoreContext
        // Since we don't have direct access, we need to reload from IndexedDB
        const allLogs = await db.getAll('productSaleLogs');
        // Sort by timestamp (newest first)
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // This will trigger the useEffect in StoreContext to update
        window.location.reload();
      }

      setMissingSaleLogs([]);

      const message = downloadedCount > 0 
        ? `Downloaded ${downloadedCount} existing logs, created ${createdCount} new logs${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}. Refreshing...`
        : `Created ${createdCount} logs${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}. Refreshing...`;
      
      notifySuccess(message);
    } catch (error) {
      console.error('Bulk create failed:', error);
      notifyError('Failed to create logs. Please try again.');
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:overflow-visible print:bg-white print:h-auto">
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center justify-between print:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          {businessSettings?.logoUrl ? (
            <img src={businessSettings.logoUrl} alt="Logo" className="w-6 h-6 rounded object-contain" />
          ) : (
            <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center text-white font-bold text-xs">PS</div>
          )}
          <span className="truncate">{businessSettings?.businessName?.split(' ')[0] || 'Grab Bottle'}</span>
        </h1>
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw size={18} className="animate-spin text-blue-400" />
          ) : isOnline ? (
            <Cloud size={18} className="text-green-500" />
          ) : (
            <CloudOff size={18} className="text-slate-500" />
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${!sidebarOpen ? 'pointer-events-none lg:pointer-events-auto' : ''}
        print:hidden
      `}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2">
              {businessSettings?.logoUrl ? (
                <img src={businessSettings.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">PS</div>
              )}
              <span className="truncate">{businessSettings?.businessName || 'Grab Bottle '}</span>
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-slate-800 rounded"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-4 text-sm text-slate-400">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p>User: <span className="text-white font-medium">{currentUser.name}</span></p>
                <p className="mt-1 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${currentShift ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {currentShift ? 'Shift Open' : 'Shift Closed'}
                </p>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {hasPerm('POS') && (
            <Link href="/" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
              <ShoppingCart size={20} />
              <span className="font-medium">Point of Sale</span>
            </Link>
          )}

          {hasPerm('INVENTORY') && (
            <Link href="/inventory" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/inventory')}`}>
              <Package size={20} />
              <span className="font-medium">Inventory</span>
            </Link>
          )}

          {hasPerm('REPORTS') && (
            <Link href="/reports" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/reports')}`}>
              <BarChart3 size={20} />
              <span className="font-medium">Reports</span>
            </Link>
          )}

          {hasPerm('POS') && (
            <Link href="/my-shifts" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/my-shifts')}`}>
              <Clock size={20} />
              <span className="font-medium">My Shifts</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin/shift-reports" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/shift-reports')}`}>
              <Users size={20} />
              <span className="font-medium">All Shifts</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin/void-approvals" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/void-approvals')}`}>
              <Ban size={20} />
              <span className="font-medium">Void Approvals</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin/stock-approvals" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/stock-approvals')}`}>
              <CheckSquare size={20} />
              <span className="font-medium">Stock Approvals</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/admin" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin')}`}>
              <ShieldAlert size={20} />
              <span className="font-medium">Admin & Logs</span>
            </Link>
          )}

          {hasPerm('ADMIN') && (
            <Link href="/settings" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/settings')}`}>
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </Link>
          )}
        </nav>

        {/* System Status Footer */}
        <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            {isSyncing ? (
              <>
                <RefreshCw size={14} className="animate-spin text-blue-400" />
                <span className="text-blue-400">Syncing to Cloud...</span>
              </>
            ) : isOnline ? (
              <>
                <Cloud size={14} className="text-green-500" />
                <span className="text-green-500">Cloud Connected</span>
              </>
            ) : (
              <>
                <CloudOff size={14} className="text-slate-500" />
                <span className="text-slate-500">Offline Mode</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Save size={14} />
            <span>Saved locally: {lastSaved}</span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-semibold"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Product Warning Modal */}
      {showProductWarning && productsWithIssues.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-red-500 to-red-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <AlertTriangle size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Products Need Attention</h2>
                    <p className="text-red-100 text-sm mt-1">{productsWithIssues.length} product(s) have missing or invalid prices</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 bg-amber-50 border-b border-amber-200">
                <p className="text-sm text-amber-900">
                  <strong>Action Required:</strong> Update the cost and selling prices below. Rows turn green when saved. 
                  The dialog will close automatically when all products are fixed.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-red-600 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase border-r border-red-700">#</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase border-r border-red-700">Product</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase border-r border-red-700">Size</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase border-r border-red-700">SKU</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase border-r border-red-700">Cost Price</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase border-r border-red-700">Selling Price</th>
                      <th className="px-3 py-3 text-center text-xs font-bold uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsWithIssues.map((product, index) => {
                      const isSaved = savedProductIds.has(product.id);
                      const isEditing = editingProductId === product.id;
                      
                      return (
                        <tr 
                          key={product.id}
                          className={`border-b transition-colors ${
                            isSaved 
                              ? 'bg-green-50 hover:bg-green-100' 
                              : 'bg-white hover:bg-red-50'
                          }`}
                        >
                          <td className="px-3 py-3 font-mono text-sm text-slate-600 border-r border-slate-200">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{product.name}</span>
                              {isSaved && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded-full">
                                  <Check size={10} /> Saved
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700 border-r border-slate-200">{product.size}</td>
                          <td className="px-3 py-3 text-xs font-mono text-slate-600 border-r border-slate-200">{product.sku}</td>
                          <td className="px-3 py-3 border-r border-slate-200">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={editCostPrice}
                                onChange={(e) => setEditCostPrice(e.target.value)}
                                className="w-full px-2 py-1 border-2 border-amber-400 rounded text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="0.00"
                                autoFocus
                              />
                            ) : (
                              <span className={`text-sm font-mono ${
                                product.costPrice === 0 || isNaN(product.costPrice)
                                  ? 'text-red-600 font-bold' 
                                  : 'text-slate-700'
                              }`}>
                                {product.costPrice === 0 || isNaN(product.costPrice) ? 'MISSING' : `KES ${product.costPrice}`}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={editSellingPrice}
                                onChange={(e) => setEditSellingPrice(e.target.value)}
                                className="w-full px-2 py-1 border-2 border-amber-400 rounded text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="0.00"
                              />
                            ) : (
                              <span className={`text-sm font-mono ${
                                product.sellingPrice === 0 || isNaN(product.sellingPrice)
                                  ? 'text-red-600 font-bold' 
                                  : 'text-slate-700'
                              }`}>
                                {product.sellingPrice === 0 || isNaN(product.sellingPrice) ? 'MISSING' : `KES ${product.sellingPrice}`}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleSaveProduct(product)}
                                  className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              !isSaved && (
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
                                  title="Edit Prices"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">
                  {savedProductIds.size} of {productsWithIssues.length} products fixed
                </p>
                <button
                  onClick={handleBulkFixProducts}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <Check size={14} /> Bulk Fix All
                </button>
              </div>
              <div className="text-center text-xs text-slate-600">
                This dialog will remain visible until all products have valid prices.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Validation Dialog */}
      {showSalesWarning && (corruptedSales.length > 0 || missingSaleLogs.length > 0) && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-orange-500 to-orange-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <AlertTriangle size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
                      <AlertCircle size={20} />
                      Sales Data Issues Detected
                    </h2>
                    <p className="text-sm text-red-700 mt-1">
                      {corruptedSales.length} corrupted sale(s) • {missingSaleLogs.length} missing log(s) • {duplicateLogs.length} duplicate log(s)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 bg-red-50 border-b border-red-200">
                <p className="text-sm text-red-900">
                  <strong>Critical:</strong> These sales have zero cost/price data, missing logs, or duplicate logs. 
                  Fix them to ensure accurate profit reports. Rows turn green when fixed.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Corrupted Sales Section */}
                {corruptedSales.length > 0 && (
                  <div className="mb-6">
                    <div className="bg-orange-100 px-4 py-2 border-b-2 border-orange-300">
                      <h3 className="text-sm font-bold text-orange-900 flex items-center gap-2">
                        <DollarSign size={16} />
                        Sales with Zero Cost/Price ({corruptedSales.length})
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-orange-600 text-white sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">#</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">Sale ID</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">Date/Time</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">Cashier</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">Product</th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase border-r border-orange-700">Qty</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">Cost</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700">Price</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700 bg-purple-700">Historical</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-orange-700 bg-blue-700">Current</th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corruptedSales.flatMap((sale, saleIdx) => 
                          sale.items.map((item: any, itemIndex: number) => {
                            // Match the detection logic exactly
                            const hasIssue = !item.costAtSale || item.costAtSale === 0 || isNaN(item.costAtSale) ||
                                           !item.priceAtSale || item.priceAtSale === 0 || isNaN(item.priceAtSale);
                            if (!hasIssue) return null;

                            const uniqueId = `${sale.id}-${itemIndex}`;
                            const isFixed = fixedSaleItemIds.has(uniqueId);
                            const isEditing = editingSaleItemId === uniqueId;
                            const rowNumber = corruptedSales.slice(0, saleIdx).reduce((acc, s) => 
                              acc + s.items.filter((i: any) => !i.costAtSale || i.costAtSale === 0 || isNaN(i.costAtSale) || !i.priceAtSale || i.priceAtSale === 0 || isNaN(i.priceAtSale)).length, 0
                            ) + sale.items.slice(0, itemIndex).filter((i: any) => !i.costAtSale || i.costAtSale === 0 || isNaN(i.costAtSale) || !i.priceAtSale || i.priceAtSale === 0 || isNaN(i.priceAtSale)).length + 1;

                            // Look up actual sales history - check both before AND after this sale
                            const product = products.find(p => p.id === item.productId);
                            let historicalCost = null;
                            let historicalPrice = null;
                            let historicalInfo = null;
                            
                            if (product) {
                              const saleDate = new Date(sale.timestamp).getTime();
                              
                              // Get all valid sales of this product (excluding this corrupted sale)
                              const validSales = productSaleLogs
                                .filter(log => 
                                  log.productId === item.productId && 
                                  log.saleId !== sale.id &&
                                  log.costAtSale > 0 && log.priceAtSale > 0
                                )
                                .map(log => ({
                                  ...log,
                                  timeDiff: Math.abs(new Date(log.timestamp).getTime() - saleDate)
                                }))
                                .sort((a, b) => a.timeDiff - b.timeDiff);
                              
                              if (validSales.length > 0) {
                                // Use the closest sale (before or after)
                                const closestSale = validSales[0];
                                historicalCost = closestSale.costAtSale;
                                historicalPrice = closestSale.priceAtSale;
                                
                                const logDate = new Date(closestSale.timestamp).getTime();
                                const daysDiff = Math.floor(Math.abs(saleDate - logDate) / (1000 * 60 * 60 * 24));
                                const direction = logDate < saleDate ? 'before' : 'after';
                                
                                if (daysDiff === 0) {
                                  historicalInfo = 'Same day';
                                } else {
                                  historicalInfo = `${daysDiff}d ${direction}`;
                                }
                              } else {
                                // Fallback to price history if no sales found
                                if (product.priceHistory && product.priceHistory.length > 0) {
                                  const relevantPriceChange = product.priceHistory
                                    .filter(ph => new Date(ph.timestamp).getTime() <= saleDate)
                                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                  
                                  if (relevantPriceChange) {
                                    historicalCost = relevantPriceChange.newCostPrice;
                                    historicalPrice = relevantPriceChange.newSellingPrice;
                                    historicalInfo = 'Price change';
                                  }
                                }
                              }
                            }

                            return (
                              <tr 
                                key={uniqueId}
                                className={`border-b transition-colors ${
                                  isFixed 
                                    ? 'bg-green-50 hover:bg-green-100' 
                                    : 'bg-white hover:bg-orange-50'
                                }`}
                              >
                                <td className="px-2 py-2 font-mono text-xs text-slate-600 border-r border-slate-200">
                                  {rowNumber}
                                </td>
                                <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                                  #{sale.id.slice(-8)}
                                </td>
                                <td className="px-2 py-2 text-xs text-slate-600 border-r border-slate-200">
                                  {new Date(sale.timestamp).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs text-slate-700 border-r border-slate-200">
                                  {sale.cashierName}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-semibold text-slate-800">{item.productName}</span>
                                    {isFixed && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-600 text-white text-xs font-bold rounded-full">
                                        <Check size={10} /> Fixed
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500">{item.size}</span>
                                </td>
                                <td className="px-2 py-2 text-center text-sm font-mono border-r border-slate-200">
                                  {item.quantity}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={editItemCost}
                                      onChange={(e) => setEditItemCost(e.target.value)}
                                      className="w-24 px-2 py-1 border-2 border-amber-400 rounded text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                                      placeholder="0.00"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={`text-xs font-mono ${
                                      item.costAtSale === 0 || isNaN(item.costAtSale)
                                        ? 'text-red-600 font-bold' 
                                        : 'text-slate-700'
                                    }`}>
                                      {item.costAtSale === 0 || isNaN(item.costAtSale) ? 'MISSING' : `KES ${item.costAtSale}`}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={editItemPrice}
                                      onChange={(e) => setEditItemPrice(e.target.value)}
                                      className="w-24 px-2 py-1 border-2 border-amber-400 rounded text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                                      placeholder="0.00"
                                    />
                                  ) : (
                                    <span className={`text-xs font-mono ${
                                      item.priceAtSale === 0 || isNaN(item.priceAtSale)
                                        ? 'text-red-600 font-bold' 
                                        : 'text-slate-700'
                                    }`}>
                                      {item.priceAtSale === 0 || isNaN(item.priceAtSale) ? 'MISSING' : `KES ${item.priceAtSale}`}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200 bg-purple-50">
                                  {historicalCost || historicalPrice ? (
                                    <div className="text-xs font-mono text-purple-700">
                                      {historicalCost && <div>C: {historicalCost}</div>}
                                      {historicalPrice && <div>P: {historicalPrice}</div>}
                                      <div className="text-[9px] text-purple-500 mt-0.5">{historicalInfo}</div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">No Sales</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200 bg-blue-50">
                                  {(() => {
                                    const product = products.find(p => p.id === item.productId);
                                    if (!product) {
                                      return <span className="text-xs text-red-600 font-bold">Not Found</span>;
                                    }
                                    if (product.costPrice === 0 || product.sellingPrice === 0) {
                                      return <span className="text-xs text-orange-600 font-bold">No Prices</span>;
                                    }
                                    return (
                                      <div className="text-xs font-mono text-blue-700">
                                        <div>C: {product.costPrice}</div>
                                        <div>P: {product.sellingPrice}</div>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleFixSaleItem(sale, itemIndex)}
                                        className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                        title="Fix"
                                      >
                                        <Check size={12} />
                                      </button>
                                      <button
                                        onClick={handleCancelSaleEdit}
                                        className="p-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded transition-colors"
                                        title="Cancel"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    !isFixed && (
                                      <button
                                        onClick={() => handleEditSaleItem(sale.id, itemIndex, item)}
                                        className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
                                        title="Fix Item"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                    )
                                  )}
                                </td>
                              </tr>
                            );
                          }).filter(Boolean)
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Duplicate Logs Section */}
                {duplicateLogs.length > 0 && (
                  <div className="mb-6">
                    <div className="bg-red-100 px-4 py-2 border-b-2 border-red-300">
                      <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Duplicate Product Sale Logs ({duplicateLogs.length})
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-red-600 text-white sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">#</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">Log ID</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">Sale ID</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">Date/Time</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">Product</th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase border-r border-red-700">Qty</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">Cost</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-red-700">Price</th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateLogs.map((log, idx) => (
                          <tr key={log.id} className="border-b bg-white hover:bg-red-50 transition-colors">
                            <td className="px-2 py-2 font-mono text-xs text-slate-600 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              {log.id.slice(-12)}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              #{log.saleId.slice(-8)}
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-600 border-r border-slate-200">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-sm font-semibold text-slate-800 border-r border-slate-200">
                              {log.productName}
                            </td>
                            <td className="px-2 py-2 text-center text-sm font-mono border-r border-slate-200">
                              {log.quantity}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              KES {log.costAtSale}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              KES {log.priceAtSale}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => handleDeleteDuplicateLog(log)}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-bold transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Missing Logs Section */}
                {missingSaleLogs.length > 0 && (
                  <div>
                    <div className="bg-amber-100 px-4 py-2 border-b-2 border-amber-300">
                      <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Missing Product Sale Logs ({missingSaleLogs.length})
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-amber-600 text-white sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-amber-700">#</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-amber-700">Sale ID</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-amber-700">Date/Time</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-amber-700">Product</th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase border-r border-amber-700">Qty</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-amber-700">Cost</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase border-r border-amber-700">Price</th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingSaleLogs.map((log, idx) => (
                          <tr key={idx} className="border-b bg-white hover:bg-amber-50 transition-colors">
                            <td className="px-2 py-2 font-mono text-xs text-slate-600 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              #{log.saleId.slice(-8)}
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-600 border-r border-slate-200">
                              {new Date(log.saleTimestamp).toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-sm font-semibold text-slate-800 border-r border-slate-200">
                              {log.item.productName}
                            </td>
                            <td className="px-2 py-2 text-center text-sm font-mono border-r border-slate-200">
                              {log.item.quantity}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              {log.item.costAtSale ? `KES ${log.item.costAtSale}` : <span className="text-red-600 font-bold">MISSING</span>}
                            </td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-700 border-r border-slate-200">
                              {log.item.priceAtSale ? `KES ${log.item.priceAtSale}` : <span className="text-red-600 font-bold">MISSING</span>}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => handleCreateMissingLog(log)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition-colors"
                              >
                                Create
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">
                  {fixedSaleItemIds.size} items fixed • {missingSaleLogs.length} logs to create • {duplicateLogs.length} duplicates to delete
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      sessionStorage.setItem('sales_validation_dismissed', 'true');
                      setShowSalesWarning(false);
                    }}
                    className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors"
                  >
                    Dismiss for Now
                  </button>
                  {duplicateLogs.length > 0 && (
                    <button
                      onClick={handleBulkDeleteDuplicates}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      <X size={14} /> Delete All Duplicates
                    </button>
                  )}
                  {corruptedSales.length > 0 && (
                    <button
                      onClick={handleBulkFixSales}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      <Check size={14} /> Auto-Fix Sales
                    </button>
                  )}
                  {missingSaleLogs.length > 0 && (
                    <button
                      onClick={handleBulkCreateLogs}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      <Check size={14} /> Create All Logs
                    </button>
                  )}
                </div>
              </div>
              <div className="text-center text-xs text-slate-600">
                This dialog will remain visible until all issues are fixed or dismissed. Dismissed dialogs won't reappear until next login.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-100 relative print:overflow-visible print:bg-white print:p-0 pt-14 lg:pt-0">
        {/* Offline Banner */}
        {!isOnline && showOfflineBanner && (
          <div className="sticky top-0 z-30 bg-amber-500 text-slate-900 px-4 py-3 flex items-center justify-between shadow-lg print:hidden">
            <div className="flex items-center gap-3 flex-1">
              <CloudOff size={20} className="flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Working Offline</p>
                <p className="text-xs">All data is saved locally and will sync when you're back online</p>
              </div>
            </div>
            <button
              onClick={() => setShowOfflineBanner(false)}
              className="p-1 hover:bg-amber-600 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Syncing Banner */}
        {isOnline && isSyncing && (
          <div className="sticky top-0 z-30 bg-blue-500 text-white px-4 py-2 flex items-center gap-3 shadow-lg print:hidden">
            <RefreshCw size={18} className="animate-spin flex-shrink-0" />
            <p className="text-sm font-medium">Syncing data to cloud...</p>
          </div>
        )}

        {children}
      </main>
    </div>
  );
};

export default AppLayout;
