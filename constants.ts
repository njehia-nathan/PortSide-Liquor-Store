import { AlcoholType, Product, Role, User } from "./types";

export const INITIAL_USERS: User[] = [
  { 
    id: 'u1', 
    name: 'Owner Admin', 
    role: Role.ADMIN, 
    pin: '1111',
    permissions: ['POS', 'INVENTORY', 'REPORTS', 'ADMIN']
  },
  { 
    id: 'u2', 
    name: 'Store Manager', 
    role: Role.MANAGER, 
    pin: '2222',
    permissions: ['POS', 'INVENTORY', 'REPORTS']
  },
  { 
    id: 'u3', 
    name: 'Joe Cashier', 
    role: Role.CASHIER, 
    pin: '3333',
    permissions: ['POS']
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Jameson Irish Whiskey',
    type: AlcoholType.WHISKEY,
    size: '750ml',
    brand: 'Jameson',
    sku: '1001',
    costPrice: 2000,
    sellingPrice: 3299,
    stock: 24,
    lowStockThreshold: 5
  },
  {
    id: 'p2',
    name: 'Jameson Irish Whiskey',
    type: AlcoholType.WHISKEY,
    size: '1L',
    brand: 'Jameson',
    sku: '1002',
    costPrice: 2800,
    sellingPrice: 4599,
    stock: 12,
    lowStockThreshold: 5
  },
  {
    id: 'p3',
    name: 'Smirnoff Red',
    type: AlcoholType.VODKA,
    size: '750ml',
    brand: 'Smirnoff',
    sku: '2001',
    costPrice: 1200,
    sellingPrice: 1999,
    stock: 36,
    lowStockThreshold: 10
  },
  {
    id: 'p4',
    name: 'Tanqueray London Dry',
    type: AlcoholType.GIN,
    size: '750ml',
    brand: 'Tanqueray',
    sku: '3001',
    costPrice: 1850,
    sellingPrice: 2999,
    stock: 15,
    lowStockThreshold: 5
  },
  {
    id: 'p5',
    name: 'Corona Extra 6pk',
    type: AlcoholType.BEER,
    size: '330ml x6',
    brand: 'Corona',
    sku: '4001',
    costPrice: 800,
    sellingPrice: 1399,
    stock: 50,
    lowStockThreshold: 12
  }
];

export const CURRENCY_FORMATTER = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
});