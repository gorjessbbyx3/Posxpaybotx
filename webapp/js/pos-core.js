/**
 * POS Core - Data Definitions, Configuration, State & Utilities
 *
 * This module defines all shared constants, menu data, staff,
 * application state, and utility functions used by all other modules.
 * Must be loaded FIRST before any other pos-*.js module.
 */

// ==========================================
// Configuration
// ==========================================
const CONFIG = {
    apiBaseUrl: '/api',
    cashDiscount: {
        enabled: true,
        mode: 'CASH_DISCOUNT', // 'CASH_DISCOUNT' or 'CARD_SURCHARGE'
        rate: 4.0,             // percentage
        cashLabel: 'Cash Discount',
        surchargeLabel: 'Non-Cash Adjustment',
        showDualPricing: true,
        exemptDebit: true,
        minCardAmount: 0,
    },
    taxRate: 8.875,
    terminal: {
        connected: false,
        model: 'VP8800',
        status: 'Ready'
    }
};

// ==========================================
// Sample Menu Data
// ==========================================
const MENU = {
    popular: [
        { id: 1, name: 'Cheeseburger', price: 12.99, station: 'grill' },
        { id: 2, name: 'Caesar Salad', price: 10.99, station: 'salad' },
        { id: 3, name: 'Grilled Chicken', price: 14.99, station: 'grill' },
        { id: 4, name: 'Fish & Chips', price: 15.99, station: 'fry' },
        { id: 5, name: 'Margherita Pizza', price: 13.99, station: 'grill' },
        { id: 6, name: 'Club Sandwich', price: 11.99, station: 'salad' },
        { id: 7, name: 'Steak Frites', price: 24.99, station: 'grill' },
        { id: 8, name: 'Pasta Alfredo', price: 13.49, station: 'salad' },
    ],
    appetizers: [
        { id: 10, name: 'Mozzarella Sticks', price: 8.99, station: 'fry' },
        { id: 11, name: 'Wings (12pc)', price: 13.99, station: 'fry' },
        { id: 12, name: 'Nachos Supreme', price: 11.99, station: 'grill' },
        { id: 13, name: 'Soup of the Day', price: 6.99, station: 'salad' },
        { id: 14, name: 'Bruschetta', price: 9.99, station: 'salad' },
        { id: 15, name: 'Calamari', price: 11.99, station: 'fry' },
        { id: 16, name: 'Spring Rolls', price: 8.49, station: 'fry' },
        { id: 17, name: 'Garlic Bread', price: 5.99, station: 'grill' },
    ],
    entrees: [
        { id: 20, name: 'NY Strip Steak', price: 28.99, station: 'grill' },
        { id: 21, name: 'Grilled Salmon', price: 22.99, station: 'grill' },
        { id: 22, name: 'Chicken Parmesan', price: 17.99, station: 'fry' },
        { id: 23, name: 'BBQ Ribs', price: 23.99, station: 'grill' },
        { id: 24, name: 'Lobster Tail', price: 34.99, station: 'grill' },
        { id: 25, name: 'Lamb Chops', price: 29.99, station: 'grill' },
        { id: 26, name: 'Pork Tenderloin', price: 19.99, station: 'grill' },
        { id: 27, name: 'Seafood Platter', price: 32.99, station: 'fry' },
    ],
    sides: [
        { id: 30, name: 'French Fries', price: 4.99, station: 'fry' },
        { id: 31, name: 'Coleslaw', price: 3.99, station: 'salad' },
        { id: 32, name: 'Mac & Cheese', price: 5.99, station: 'grill' },
        { id: 33, name: 'Side Salad', price: 4.49, station: 'salad' },
        { id: 34, name: 'Onion Rings', price: 5.49, station: 'fry' },
        { id: 35, name: 'Baked Potato', price: 4.99, station: 'grill' },
        { id: 36, name: 'Rice Pilaf', price: 3.99, station: 'salad' },
        { id: 37, name: 'Steamed Veggies', price: 4.49, station: 'salad' },
    ],
    drinks: [
        { id: 40, name: 'Soda', price: 2.99, station: 'expo' },
        { id: 41, name: 'Iced Tea', price: 2.99, station: 'expo' },
        { id: 42, name: 'Coffee', price: 3.49, station: 'expo' },
        { id: 43, name: 'Fresh Juice', price: 4.99, station: 'expo' },
        { id: 44, name: 'Lemonade', price: 3.49, station: 'expo' },
        { id: 45, name: 'Beer (Draft)', price: 6.99, station: 'expo' },
        { id: 46, name: 'House Wine', price: 8.99, station: 'expo' },
        { id: 47, name: 'Water', price: 0.00, station: 'expo' },
    ],
    desserts: [
        { id: 50, name: 'Cheesecake', price: 8.99, station: 'expo' },
        { id: 51, name: 'Chocolate Cake', price: 7.99, station: 'expo' },
        { id: 52, name: 'Ice Cream', price: 5.99, station: 'expo' },
        { id: 53, name: 'Apple Pie', price: 7.49, station: 'expo' },
        { id: 54, name: 'Tiramisu', price: 8.99, station: 'expo' },
        { id: 55, name: 'Creme Brulee', price: 9.49, station: 'expo' },
    ]
};

// ==========================================
// Menu Modifier Groups
// ==========================================
const MODIFIERS = {
    temperature: { label: 'Temperature', required: false, max: 1, options: [
        { name: 'Rare', price: 0 }, { name: 'Medium Rare', price: 0 },
        { name: 'Medium', price: 0 }, { name: 'Medium Well', price: 0 }, { name: 'Well Done', price: 0 }
    ]},
    protein: { label: 'Add Protein', required: false, max: 1, options: [
        { name: 'Add Chicken', price: 4.99 }, { name: 'Add Shrimp', price: 6.99 },
        { name: 'Add Steak', price: 7.99 }, { name: 'Add Salmon', price: 6.99 }
    ]},
    sides: { label: 'Side Choice', required: false, max: 2, options: [
        { name: 'Fries', price: 0 }, { name: 'Coleslaw', price: 0 },
        { name: 'Side Salad', price: 0 }, { name: 'Onion Rings', price: 1.50 },
        { name: 'Sweet Potato Fries', price: 1.50 }, { name: 'Mac & Cheese', price: 2.00 }
    ]},
    extras: { label: 'Extras', required: false, max: 5, options: [
        { name: 'Extra Cheese', price: 1.50 }, { name: 'Bacon', price: 2.00 },
        { name: 'Avocado', price: 2.50 }, { name: 'Fried Egg', price: 1.50 },
        { name: 'Jalapenos', price: 0.75 }, { name: 'Mushrooms', price: 1.00 }
    ]},
    sauce: { label: 'Sauce', required: false, max: 2, options: [
        { name: 'Ranch', price: 0 }, { name: 'BBQ', price: 0 },
        { name: 'Honey Mustard', price: 0 }, { name: 'Buffalo', price: 0 },
        { name: 'Garlic Aioli', price: 0.50 }, { name: 'Truffle Mayo', price: 1.00 }
    ]},
    allergy: { label: 'Allergy / Special', required: false, max: 5, options: [
        { name: 'No Gluten', price: 0 }, { name: 'No Dairy', price: 0 },
        { name: 'No Nuts', price: 0 }, { name: 'No Onion', price: 0 },
        { name: 'Extra Spicy', price: 0 }, { name: 'Mild', price: 0 }
    ]}
};

// Map items to their available modifier groups
const ITEM_MODIFIERS = {
    1: ['temperature', 'extras', 'sides', 'sauce'],
    6: ['extras', 'sides', 'sauce'],
    2: ['protein', 'allergy'],
    7: ['temperature', 'sides', 'sauce'],
    20: ['temperature', 'sides', 'sauce'],
    25: ['temperature', 'sides', 'sauce'],
    3: ['sides', 'sauce', 'allergy'],
    22: ['sides', 'sauce'],
    4: ['sides', 'sauce', 'allergy'],
    21: ['sides', 'sauce', 'allergy'],
    11: ['sauce', 'extras'],
    _default: ['allergy']
};

// ==========================================
// Discount / Promo Codes
// ==========================================
const PROMO_CODES = {
    'WELCOME10': { type: 'percent', value: 10, description: '10% off your order', minAmount: 0, oneTime: true },
    'LUNCH5': { type: 'fixed', value: 5, description: '$5 off lunch', minAmount: 20 },
    'HAPPY25': { type: 'percent', value: 25, description: '25% Happy Hour', minAmount: 0 },
    'FREESHIP': { type: 'delivery', value: 0, description: 'Free delivery', minAmount: 15 },
    'BOGO50': { type: 'percent', value: 50, description: '50% off (BOGO)', minAmount: 0 }
};

// Delivery fee schedule
const DELIVERY_CONFIG = {
    baseFee: 5.99,
    freeDeliveryMin: 50.00,
    distanceRates: [
        { maxMiles: 3, fee: 0 },
        { maxMiles: 5, fee: 2.00 },
        { maxMiles: 10, fee: 5.00 }
    ]
};

// Table data
const TABLES = [];
for (let i = 1; i <= 20; i++) {
    const statuses = ['available', 'occupied', 'available', 'available', 'reserved', 'available', 'dirty', 'available'];
    TABLES.push({
        number: i,
        seats: Math.floor(Math.random() * 6) + 2,
        status: statuses[i % statuses.length],
        amount: statuses[i % statuses.length] === 'occupied' ? (Math.random() * 80 + 20).toFixed(2) : null
    });
}

// ==========================================
// Staff / Employee Database
// ==========================================
const STAFF = {
    '1234': { name: 'Maria G.', role: 'manager', id: 'EMP001', hourlyRate: 28.00 },
    '1111': { name: 'John D.', role: 'server', id: 'EMP002', hourlyRate: 12.00 },
    '2222': { name: 'Sarah K.', role: 'server', id: 'EMP003', hourlyRate: 12.00 },
    '3333': { name: 'Mike R.', role: 'cashier', id: 'EMP004', hourlyRate: 15.00 },
    '4444': { name: 'Lisa T.', role: 'bartender', id: 'EMP005', hourlyRate: 14.00 },
    '5555': { name: 'Carlos M.', role: 'kitchen', id: 'EMP006', hourlyRate: 16.00 },
    '9999': { name: 'Admin', role: 'admin', id: 'EMP000', hourlyRate: 0 }
};

// Role permissions
const ROLE_PERMISSIONS = {
    admin:     { pos: true, kitchen: true, tables: true, tickets: true, reports: true, voidTicket: true, discount: true, settings: true, refund: true, editMenu: true },
    manager:   { pos: true, kitchen: true, tables: true, tickets: true, reports: true, voidTicket: true, discount: true, settings: true, refund: true, editMenu: true },
    server:    { pos: true, kitchen: false, tables: true, tickets: true, reports: false, voidTicket: false, discount: false, settings: false, refund: false, editMenu: false },
    cashier:   { pos: true, kitchen: false, tables: false, tickets: true, reports: false, voidTicket: false, discount: true, settings: false, refund: false, editMenu: false },
    bartender: { pos: true, kitchen: false, tables: false, tickets: true, reports: false, voidTicket: false, discount: false, settings: false, refund: false, editMenu: false },
    kitchen:   { pos: false, kitchen: true, tables: false, tickets: false, reports: false, voidTicket: false, discount: false, settings: false, refund: false, editMenu: false }
};

// Time clock records
const timeClock = [];

// ==========================================
// Application State
// ==========================================
const state = {
    currentUser: null,
    currentRole: 'server',
    currentStaff: null,
    pin: '',
    currentCategory: 'popular',
    currentView: 'order',
    ticket: {
        id: null,
        type: 'dine-in',
        items: [],
        table: null,
        server: null,
        discount: null
    },
    ticketCounter: 1001,
    kitchenOrders: [],
    paymentMethod: 'cash',
    tenderedAmount: '',
    allTickets: [],
    clockedIn: false,
    menuSearchQuery: ''
};

// ==========================================
// Utility Functions
// ==========================================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function formatCurrency(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

function getDualPrices(price) {
    if (!CONFIG.cashDiscount.enabled) return [price, price];
    const rate = CONFIG.cashDiscount.rate / 100;
    if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
        return [price * (1 - rate), price];
    } else {
        return [price, price * (1 + rate)];
    }
}

function showToast(message, type = 'success') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// Clock
// ==========================================
function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const clockEl = $('#clock');
    if (clockEl) clockEl.textContent = time;
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// Customer Display Broadcast
// ==========================================
let customerChannel = null;
try {
    customerChannel = new BroadcastChannel('pos-customer-display');
} catch (e) {
    // BroadcastChannel not supported - silent fallback
}

function broadcastToCustomerDisplay(type, data) {
    if (!customerChannel) return;
    try {
        customerChannel.postMessage({ type, ...data });
    } catch (e) {}
}
