// scripts.js - Complete and updated version with error handling and non-module approach
console.log("Script loaded");

// Global variables (no imports needed since DOMPurify and Chart.js are loaded via CDN)
let products = [
    {id: 1, name: 'Tusker Beer', barcode: '1001', costPrice: 120, sellingPrice: 200, stock: 45, reorderLevel: 10, category: 'Beer', icon: 'fas fa-beer'},
    {id: 2, name: 'Premium Whisky', barcode: '1002', costPrice: 1200, sellingPrice: 1800, stock: 8, reorderLevel: 15, category: 'Spirits', icon: 'fas fa-glass-whiskey'},
    {id: 3, name: 'Vodka Premium', barcode: '1003', costPrice: 800, sellingPrice: 1200, stock: 12, reorderLevel: 8, category: 'Spirits', icon: 'fas fa-cocktail'},
    {id: 4, name: 'Red Wine', barcode: '1004', costPrice: 600, sellingPrice: 1000, stock: 6, reorderLevel: 10, category: 'Wine', icon: 'fas fa-wine-bottle'},
    {id: 5, name: 'Coca Cola', barcode: '1005', costPrice: 50, sellingPrice: 100, stock: 35, reorderLevel: 20, category: 'Soft Drinks', icon: 'fas fa-bottle-water'},
    {id: 6, name: 'Energy Drink', barcode: '1006', costPrice: 80, sellingPrice: 150, stock: 28, reorderLevel: 15, category: 'Beverages', icon: 'fas fa-battery-bolt'}
];

let customers = [
    {id: 1, name: 'John Kimani', phone: '+254712345678', email: 'john@email.com', totalSpent: 25000, lastVisit: '2025-08-17', loyaltyPoints: 250, visits: 15},
    {id: 2, name: 'Mary Wanjiku', phone: '+254723456789', email: 'mary@email.com', totalSpent: 18500, lastVisit: '2025-08-16', loyaltyPoints: 185, visits: 12},
    {id: 3, name: 'Peter Ochieng', phone: '+254734567890', email: '', totalSpent: 32000, lastVisit: '2025-08-15', loyaltyPoints: 320, visits: 22},
    {id: 4, name: 'Grace Mutua', phone: '+254745678901', email: 'grace@email.com', totalSpent: 15200, lastVisit: '2025-08-14', loyaltyPoints: 152, visits: 8}
];

let staff = [
    {id: 1, name: 'Alice Mwangi', role: 'manager', phone: '+254756789012', email: 'alice@bar.com', salary: 45000, status: 'working', hoursToday: 7, salesToday: 28500},
    {id: 2, name: 'David Otieno', role: 'cashier', phone: '+254767890123', email: 'david@bar.com', salary: 28000, status: 'working', hoursToday: 6, salesToday: 19200},
    {id: 3, name: 'Sarah Njeri', role: 'bartender', phone: '+254778901234', email: 'sarah@bar.com', salary: 32000, status: 'working', hoursToday: 5, salesToday: 15800},
    {id: 4, name: 'James Kariuki', role: 'security', phone: '+254789012345', email: 'james@bar.com', salary: 25000, status: 'off', hoursToday: 0, salesToday: 0}
];

let cart = [];
let sales = [];
let expenses = [
    {id: 1, description: 'Electricity Bill', amount: 8500, date: '2025-08-18', addedBy: 'Admin User'},
    {id: 2, description: 'Stock Purchase - Spirits', amount: 45000, date: '2025-08-17', addedBy: 'Manager'},
    {id: 3, description: 'Staff Salaries', amount: 85000, date: '2025-08-16', addedBy: 'Admin User'}
];

let currentUser = {name: 'Admin User', role: 'admin'};

// Theme Management
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    const icon = document.querySelector('.theme-toggle i');
    icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('theme', newTheme);
    console.log("Theme switched to:", newTheme);
}

// Navigation
function showPage(pageId) {
    if (!pageId) {
        console.error("No pageId provided to showPage");
        return;
    }
    console.log("showPage called with:", pageId);
    const pages = document.querySelectorAll('.page');
    if (!pages.length) {
        console.error("No .page elements found");
        return;
    }
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    } else {
        console.error("Page ID", pageId, "not found");
        return;
    }
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
    });
    const activeNav = document.querySelector(`.nav-item[onclick*="showPage('${pageId}')"]`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.setAttribute('aria-current', 'page');
    }
    switch (pageId) {
        case 'dashboard':
            updateDashboard();
            drawSalesChart();
            break;
        case 'pos':
            loadProducts();
            break;
        case 'inventory':
            loadInventory();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'reports':
            loadReports();
            drawFinancialChart();
            break;
        case 'staff':
            loadStaff();
            break;
        default:
            console.warn("Unknown pageId:", pageId);
    }
    console.log("Page switch complete for:", pageId);
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        const firstFocusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
        if (modalId === 'addStockModal') {
            populateProductSelect();
        }
    } else {
        console.error("Modal ID", modalId, "not found");
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) activeNav.focus();
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.style.display === 'block') {
                closeModal(modal.id);
            }
        });
    }
});

// Dashboard Functions
function updateDashboard() {
    const today = new Date().toDateString();
    const todaySales = sales.filter(sale => new Date(sale.timestamp).toDateString() === today);
    const totalSales = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = todaySales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    document.getElementById('todaySales').textContent = `KSh ${totalSales.toLocaleString()}`;
    document.getElementById('todayProfit').textContent = `KSh ${totalProfit.toLocaleString()}`;
    document.getElementById('totalCustomers').textContent = todaySales.length || 0;
    const lowStockCount = products.filter(p => p.stock <= p.reorderLevel).length;
    document.getElementById('lowStockItems').textContent = lowStockCount;
    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
}

function drawSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Sales (KSh)',
                    data: [67500, 82000, 55000, 78000, 95000, 102000, 88000],
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: '#667eea',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Sales (KSh)' } },
                    x: { title: { display: true, text: 'Day' } }
                }
            }
        });
    } else {
        console.warn("Chart.js not loaded or salesChart element not found");
    }
}

// POS Functions
function loadProducts() {
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.innerHTML = products.map(product => `
            <div class="product-card" onclick="addToCart(${product.id})" ${product.stock <= 0 ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                <div class="product-icon"><i class="${product.icon}"></i></div>
                <div class="product-name">${product.name}</div>
                <div class="product-price">KSh ${product.sellingPrice.toLocaleString()}</div>
                <div class="product-stock ${product.stock <= product.reorderLevel ? 'status-low' : 'status-good'}">Stock: ${product.stock}</div>
            </div>
        `).join('');
    }
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product && product.stock > 0) {
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            if (existingItem.quantity < product.stock) existingItem.quantity++;
        } else {
            cart.push({...product, quantity: 1});
        }
        updateCart();
    }
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    if (cartItems && cartTotal) {
        if (cart.length === 0) {
            cartItems.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px 20px;"><i class="fas fa-shopping-cart" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i><div>Cart is empty</div><div style="font-size: 12px;">Add products to start a sale</div></div>';
            cartTotal.textContent = '0';
        } else {
            cartItems.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div><div style="font-weight: 600;">${item.name}</div><div style="font-size: 12px; color: #6b7280;">KSh ${item.sellingPrice.toLocaleString()} each</div></div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="changeQuantity(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                        <span style="margin: 0 12px; font-weight: bold;">${item.quantity}</span>
                        <button class="quantity-btn" onclick="changeQuantity(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                        <button class="btn btn-danger" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
            cartTotal.textContent = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0).toLocaleString();
        }
    }
}

function changeQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    const product = products.find(p => p.id === productId);
    if (cartItem && product && (cartItem.quantity + change) > 0 && (cartItem.quantity + change) <= product.stock) {
        cartItem.quantity += change;
        updateCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function clearCart() {
    if (cart.length > 0 && confirm('Are you sure you want to clear the cart?')) {
        cart = [];
        updateCart();
    }
}

function processPayment(method) {
    if (cart.length > 0) {
        const total = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
        const profit = cart.reduce((sum, item) => sum + ((item.sellingPrice - item.costPrice) * item.quantity), 0);
        completeSale(method, total, profit);
    }
}

function completeSale(method, total, profit) {
    const sale = {
        id: Date.now(),
        timestamp: new Date(),
        items: [...cart],
        total, profit, paymentMethod: method, cashier: currentUser.name, customer: null
    };
    cart.forEach(cartItem => {
        const product = products.find(p => p.id === cartItem.id);
        if (product) product.stock -= cartItem.quantity;
    });
    sales.push(sale);
    clearCart();
    updateDashboard();
    loadInventory();
}

// Inventory Functions
function loadInventory() {
    const table = document.getElementById('inventoryTable');
    if (table) {
        table.innerHTML = products.map(product => `
            <tr>
                <td><div style="display: flex; align-items: center; gap: 10px;"><i class="${product.icon}" style="color: var(--primary);"></i><div><div style="font-weight: 600;">${product.name}</div><div style="font-size: 12px; opacity: 0.7;">${product.category}</div></div></div></td>
                <td><span style="font-weight: bold; font-size: 16px;">${product.stock}</span></td>
                <td>${product.reorderLevel}</td>
                <td>KSh ${product.costPrice.toLocaleString()}</td>
                <td>KSh ${product.sellingPrice.toLocaleString()}</td>
                <td><span class="status-badge ${product.stock <= product.reorderLevel ? 'status-low' : 'status-good'}">${product.stock <= product.reorderLevel ? 'LOW STOCK' : 'IN STOCK'}</span></td>
                <td><button class="btn btn-primary" onclick="editProduct(${product.id})"><i class="fas fa-edit"></i> Edit</button></td>
            </tr>
        `).join('');
    }
}

function populateProductSelect() {
    const select = document.getElementById('stockProduct');
    if (select) {
        select.innerHTML = '<option value="">Select Product</option>' + products.map(product => `<option value="${product.id}">${product.name} (Stock: ${product.stock})</option>`).join('');
    }
}

// Customer Functions
function loadCustomers() {
    const table = document.getElementById('customersTable');
    if (table) {
        table.innerHTML = customers.map(customer => `
            <tr>
                <td><div style="display: flex; align-items: center; gap: 10px;"><i class="fas fa-user-circle" style="color: var(--primary); font-size: 24px;"></i><div><div style="font-weight: 600;">${customer.name}</div><div style="font-size: 12px; opacity: 0.7;">${customer.visits} visits</div></div></div></td>
                <td>${customer.phone}</td>
                <td>${customer.email || '<span style="opacity: 0.5;">N/A</span>'}</td>
                <td style="font-weight: bold; color: #10b981;">KSh ${customer.totalSpent.toLocaleString()}</td>
                <td>${customer.lastVisit}</td>
                <td><span style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 4px 8px; border-radius: 12px;">${customer.loyaltyPoints} pts</span></td>
                <td><button class="btn btn-primary" onclick="editCustomer(${customer.id})"><i class="fas fa-edit"></i> Edit</button></td>
            </tr>
        `).join('');
    }
}

// Staff Functions
function loadStaff() {
    const table = document.getElementById('staffTable');
    if (table) {
        table.innerHTML = staff.map(member => `
            <tr>
                <td><div style="display: flex; align-items: center; gap: 10px;"><i class="fas fa-user-tie" style="color: var(--primary); font-size: 20px;"></i><div><div style="font-weight: 600;">${member.name}</div><div style="font-size: 12px; opacity: 0.7;">${member.email}</div></div></div></td>
                <td><span style="background: var(--primary); color: white; padding: 4px 12px; border-radius: 15px;">${member.role}</span></td>
                <td><span class="status-badge ${member.status === 'working' ? 'status-working' : 'status-off'}">${member.status === 'working' ? '🟢 WORKING' : '🔴 OFF DUTY'}</span></td>
                <td style="font-weight: bold;">${member.hoursToday}h</td>
                <td style="font-weight: bold; color: #10b981;">KSh ${member.salesToday.toLocaleString()}</td>
                <td><button class="btn btn-primary" onclick="editStaff(${member.id})"><i class="fas fa-edit"></i> Edit</button></td>
            </tr>
        `).join('');
    }
}

// Reports Functions
function loadReports() {
    const table = document.getElementById('expensesTable');
    if (table) {
        table.innerHTML = expenses.map(expense => `
            <tr>
                <td>${expense.date}</td>
                <td>${expense.description}</td>
                <td>KSh ${expense.amount.toLocaleString()}</td>
                <td>${expense.addedBy}</td>
            </tr>
        `).join('');
    }
}

function drawFinancialChart() {
    const ctx = document.getElementById('financialChart');
    if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [
                    {label: 'Revenue', data: [120000, 135000, 148000, 142000, 165000, 158000], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: true},
                    {label: 'Expenses', data: [85000, 92000, 98000, 95000, 108000, 105000], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', fill: true}
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {beginAtZero: true, title: {display: true, text: 'Amount (KSh)'}},
                    x: {title: {display: true, text: 'Month'}}
                },
                plugins: {legend: {position: 'top'}}
            }
        });
    }
}

function addExpense() {
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    if (desc && !isNaN(amount) && amount > 0) {
        expenses.push({
            id: Date.now(),
            description: desc,
            amount: amount,
            date: new Date().toISOString().split('T')[0],
            addedBy: currentUser.name
        });
        document.getElementById('expenseDesc').value = '';
        document.getElementById('expenseAmount').value = '';
        loadReports();
        showNotification('Expense added successfully!', 'success');
    } else {
        showNotification('Please enter a valid description and amount.', 'error');
    }
}

// Initialize Application
function initApp() {
    console.log("Initializing app and DOM ready");
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const themeIcon = document.querySelector('.theme-toggle i');
    themeIcon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    loadProducts();
    updateDashboard();
    const style = document.createElement('style');
    style.textContent = `@keyframes slideInRight {from {transform: translateX(100%); opacity: 0;} to {transform: translateX(0); opacity: 1;}} @keyframes slideOutRight {from {transform: translateX(0); opacity: 1;} to {transform: translateX(100%); opacity: 0;}}`;
    document.head.appendChild(style);
    setInterval(() => {
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
        if (Math.random() > 0.98) {
            const randomSale = Math.floor(Math.random() * 2000) + 500;
            const currentSales = parseInt(document.getElementById('todaySales').textContent.replace(/[^\d]/g, '')) || 0;
            document.getElementById('todaySales').textContent = `KSh ${(currentSales + randomSale).toLocaleString()}`;
        }
    }, 1000);
    setTimeout(() => showNotification('Welcome to BarMaster Pro! Your business management system is ready.', 'success'), 1000);
}

document.addEventListener('DOMContentLoaded', initApp);

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 15px 20px; border-radius: 8px; color: white; font-weight: 500; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: slideInRight 0.3s ease-out; max-width: 350px';
    const colors = {success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6'};
    const icons = {success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle'};
    notification.style.background = colors[type] || colors.info;
    notification.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><i class="${icons[type] || icons.info}"></i><span>${message}</span></div>`;
    document.body.appendChild(notification);
    setTimeout(() => {notification.style.animation = 'slideOutRight 0.3s ease-out'; setTimeout(() => document.body.removeChild(notification), 300);}, 3000);
}

// Placeholder functions (to be expanded)
function editProduct(id) { showNotification('Edit product feature coming soon!', 'info'); }
function editCustomer(id) { showNotification('Edit customer feature coming soon!', 'info'); }
function editStaff(id) { showNotification('Edit staff feature coming soon!', 'info'); }
function quickSale() { showNotification('Quick sale feature coming soon!', 'info'); }
function scanBarcode() { showNotification('Barcode scanning feature coming soon!', 'info'); }
function exportReport(format) { showNotification(`Export to ${format} feature coming soon!`, 'info'); }
function printReceipt() { showNotification('Print receipt feature coming soon!', 'info'); }
function emailReceipt() { showNotification('Email receipt feature coming soon!', 'info'); }
function smsReceipt() { showNotification('SMS receipt feature coming soon!', 'info'); }
function confirmMpesaPayment() { showNotification('M-Pesa payment confirmation coming soon!', 'info'); }
function clockInOut() { showNotification('Clock in/out feature coming soon!', 'info'); }
function addProduct(event) {
    event.preventDefault();
    showNotification('Add product feature coming soon!', 'info');
}
function receiveStock(event) {
    event.preventDefault();
    showNotification('Receive stock feature coming soon!', 'info');
}
function addCustomer(event) {
    event.preventDefault();
    showNotification('Add customer feature coming soon!', 'info');
}
function addStaff(event) {
    event.preventDefault();
    showNotification('Add staff feature coming soon!', 'info');
}
function sendSMSCampaign(event) {
    event.preventDefault();
    showNotification('SMS campaign feature coming soon!', 'info');
}