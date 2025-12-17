export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
}

export enum AlcoholType {
  WHISKEY = 'Whiskey',
  VODKA = 'Vodka',
  GIN = 'Gin',
  RUM = 'Rum',
  WINE = 'Wine',
  BEER = 'Beer',
  RTD = 'RTD',
  OTHER = 'Other',
}

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string; // Simplified auth for demo
  permissions: string[]; // List of access keys: 'POS', 'INVENTORY', 'REPORTS', 'ADMIN'
}

export interface Product {
  id: string;
  name: string;
  type: AlcoholType;
  size: string; // e.g., "750ml"
  brand: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  supplier?: string;
  stock: number;
  lowStockThreshold?: number; // Custom alert level
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  priceAtSale: number;
  costAtSale: number;
}

export interface Sale {
  id: string;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  totalAmount: number;
  totalCost: number; // For profit calc
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE';
  items: SaleItem[];
}

export interface Shift {
  id: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number; // Actual cash counted
  expectedCash?: number; // Calculated from sales
  status: 'OPEN' | 'CLOSED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}

export interface InventoryAdjustment {
  id: string;
  productId: string;
  quantityChange: number; // negative for loss
  reason: string;
  userId: string;
  timestamp: string;
}

export interface BusinessSettings {
  id: string; // Always 'default' - single row
  businessName: string;
  tagline?: string;
  phone: string;
  email: string;
  location: string;
  logoUrl?: string; // Path to logo image
  receiptFooter?: string; // Custom message at bottom of receipt
}