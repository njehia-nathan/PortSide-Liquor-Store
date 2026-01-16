import { dbPromise } from '../db';
import { Product, Sale, User, Shift, AuditLog } from '../types';

/**
 * BACKUP UTILITY
 * Creates backups before destructive operations
 * Allows restoration if something goes wrong
 */

export interface BackupData {
  timestamp: string;
  type: 'FULL' | 'PRODUCTS' | 'SALES' | 'USERS';
  data: {
    products?: Product[];
    sales?: Sale[];
    users?: User[];
    shifts?: Shift[];
    auditLogs?: AuditLog[];
  };
  reason?: string;
}

/**
 * Creates a full backup of all data
 */
export const createFullBackup = async (reason?: string): Promise<BackupData> => {
  const db = await dbPromise();
  
  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    type: 'FULL',
    data: {
      products: await db.getAll('products'),
      sales: await db.getAll('sales'),
      users: await db.getAll('users'),
      shifts: await db.getAll('shifts'),
      auditLogs: await db.getAll('auditLogs')
    },
    reason
  };

  // Store backup in localStorage (limited to ~5MB)
  try {
    const backupKey = `backup_${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));
    
    // Keep only last 5 backups
    const allBackups = Object.keys(localStorage).filter(k => k.startsWith('backup_'));
    if (allBackups.length > 5) {
      allBackups.sort();
      for (let i = 0; i < allBackups.length - 5; i++) {
        localStorage.removeItem(allBackups[i]);
      }
    }
    
    console.log('✅ Backup created:', backupKey);
  } catch (error) {
    console.error('⚠️ Failed to store backup in localStorage:', error);
  }

  return backup;
};

/**
 * Creates a backup of products only
 */
export const createProductsBackup = async (reason?: string): Promise<BackupData> => {
  const db = await dbPromise();
  
  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    type: 'PRODUCTS',
    data: {
      products: await db.getAll('products')
    },
    reason
  };

  try {
    const backupKey = `backup_products_${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));
    console.log('✅ Products backup created:', backupKey);
  } catch (error) {
    console.error('⚠️ Failed to store products backup:', error);
  }

  return backup;
};

/**
 * Restores data from a backup
 */
export const restoreFromBackup = async (backup: BackupData): Promise<void> => {
  const db = await dbPromise();
  
  try {
    if (backup.data.products) {
      for (const product of backup.data.products) {
        await db.put('products', product);
      }
      console.log('✅ Restored', backup.data.products.length, 'products');
    }
    
    if (backup.data.sales) {
      for (const sale of backup.data.sales) {
        await db.put('sales', sale);
      }
      console.log('✅ Restored', backup.data.sales.length, 'sales');
    }
    
    if (backup.data.users) {
      for (const user of backup.data.users) {
        await db.put('users', user);
      }
      console.log('✅ Restored', backup.data.users.length, 'users');
    }
    
    if (backup.data.shifts) {
      for (const shift of backup.data.shifts) {
        await db.put('shifts', shift);
      }
      console.log('✅ Restored', backup.data.shifts.length, 'shifts');
    }
    
    if (backup.data.auditLogs) {
      for (const log of backup.data.auditLogs) {
        await db.put('auditLogs', log);
      }
      console.log('✅ Restored', backup.data.auditLogs.length, 'audit logs');
    }
    
    console.log('✅ Backup restoration complete');
  } catch (error) {
    console.error('❌ Backup restoration failed:', error);
    throw error;
  }
};

/**
 * Lists all available backups
 */
export const listBackups = (): { key: string; backup: BackupData }[] => {
  const backups: { key: string; backup: BackupData }[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('backup_')) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          backups.push({
            key,
            backup: JSON.parse(data)
          });
        }
      } catch (error) {
        console.error('Failed to parse backup:', key, error);
      }
    }
  }
  
  return backups.sort((a, b) => b.key.localeCompare(a.key));
};

/**
 * Exports backup as downloadable JSON file
 */
export const exportBackup = (backup: BackupData): void => {
  const dataStr = JSON.stringify(backup, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `portside-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('✅ Backup exported as file');
};

/**
 * Imports backup from JSON file
 */
export const importBackup = (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string) as BackupData;
        resolve(backup);
      } catch (error) {
        reject(new Error('Invalid backup file format'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
