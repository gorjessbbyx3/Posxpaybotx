/**
 * Restaurant POS - Modern Web Frontend
 *
 * Touch-optimized, role-based POS interface with:
 * - Cash discount / dual pricing display
 * - PaybotX terminal integration
 * - Kitchen display system
 * - Table management
 * - Real-time order status
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
    // Burgers / sandwiches
    1: ['temperature', 'extras', 'sides', 'sauce'],    // Cheeseburger
    6: ['extras', 'sides', 'sauce'],                     // Club Sandwich
    // Salads
    2: ['protein', 'allergy'],                            // Caesar Salad
    // Steaks
    7: ['temperature', 'sides', 'sauce'],                // Steak Frites
    20: ['temperature', 'sides', 'sauce'],               // NY Strip
    25: ['temperature', 'sides', 'sauce'],               // Lamb Chops
    // Chicken
    3: ['sides', 'sauce', 'allergy'],                    // Grilled Chicken
    22: ['sides', 'sauce'],                              // Chicken Parmesan
    // Fish
    4: ['sides', 'sauce', 'allergy'],                    // Fish & Chips
    21: ['sides', 'sauce', 'allergy'],                   // Grilled Salmon
    // Wings
    11: ['sauce', 'extras'],                             // Wings
    // Default for everything else
    _default: ['allergy']
};

// ==========================================
// Discount / Promo System
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
// Theme Toggle
// ==========================================
$('#btn-theme').addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
});

// ==========================================
// Fullscreen
// ==========================================
$('#btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
});

// ==========================================
// Login System
// ==========================================
$$('#login-numpad .numpad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const num = btn.dataset.num;
        if (num === 'clear') {
            state.pin = '';
        } else if (num === 'enter') {
            if (state.pin.length === 4) {
                doLogin(state.pin);
            }
        } else if (state.pin.length < 4) {
            state.pin += num;
        }
        updatePinDots();
    });
});

$$('.quick-login-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const role = btn.dataset.user;
        // Find a staff member with this role
        const pinMap = { 'server': '1111', 'cashier': '3333', 'manager': '1234' };
        doLogin(pinMap[role] || '1111');
    });
});

function updatePinDots() {
    const dots = $$('.pin-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < state.pin.length);
    });
}

function doLogin(pin) {
    const staff = STAFF[pin];
    if (!staff && pin !== 'quick') {
        showToast('Invalid PIN', 'error');
        state.pin = '';
        updatePinDots();
        shakePinDisplay();
        return;
    }

    if (staff) {
        state.currentUser = staff.name;
        state.currentRole = staff.role;
        state.currentStaff = staff;
    } else {
        state.currentUser = 'User';
        state.currentRole = 'server';
        state.currentStaff = null;
    }

    // Update UI with user info
    $('#current-user').textContent = state.currentUser;
    const roleEl = document.getElementById('current-role');
    if (roleEl) roleEl.textContent = state.currentRole.charAt(0).toUpperCase() + state.currentRole.slice(1);

    // Apply role-based permissions
    applyRolePermissions();

    $('#login-screen').classList.remove('active');
    $('#pos-screen').classList.add('active');
    newTicket();
    showToast('Welcome, ' + state.currentUser + '!');
    populateMenu();
    populateTables();
    populateKitchen();

    // Auto clock-in prompt
    if (state.currentStaff && !isAlreadyClockedIn(state.currentStaff.id)) {
        setTimeout(() => {
            if (confirm('Clock in as ' + state.currentUser + '?')) {
                clockIn();
            }
        }, 500);
    }
}

function shakePinDisplay() {
    const pinDisplay = document.querySelector('.pin-display');
    if (!pinDisplay) return;
    pinDisplay.classList.add('shake');
    setTimeout(() => pinDisplay.classList.remove('shake'), 500);
}

function applyRolePermissions() {
    const perms = ROLE_PERMISSIONS[state.currentRole] || ROLE_PERMISSIONS.server;

    // Show/hide tabs based on role
    $$('.tab-btn').forEach(btn => {
        const view = btn.dataset.view;
        if (view === 'kitchen' && !perms.kitchen) {
            btn.style.display = 'none';
        } else if (view === 'reports' && !perms.reports) {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });

    // Show/hide action buttons based on role
    const discountBtn = $('#btn-discount');
    if (discountBtn) discountBtn.style.display = perms.discount ? '' : 'none';

    // Admin settings link visibility
    const adminLink = document.querySelector('.side-menu-link[href="admin.html"]');
    if (adminLink) adminLink.style.display = perms.settings ? '' : 'none';
}

function isAlreadyClockedIn(empId) {
    const last = timeClock.filter(r => r.empId === empId).pop();
    return last && !last.clockOut;
}

function clockIn() {
    if (!state.currentStaff) return;
    const record = {
        empId: state.currentStaff.id,
        empName: state.currentUser,
        role: state.currentRole,
        clockIn: new Date(),
        clockOut: null
    };
    timeClock.push(record);
    state.clockedIn = true;
    showToast('Clocked in at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
}

function clockOut() {
    if (!state.currentStaff) return;
    const record = timeClock.filter(r => r.empId === state.currentStaff.id && !r.clockOut).pop();
    if (record) {
        record.clockOut = new Date();
        const hours = ((record.clockOut - record.clockIn) / 3600000).toFixed(2);
        state.clockedIn = false;
        showToast('Clocked out. Shift: ' + hours + ' hours');
    }
}

$('#btn-logout').addEventListener('click', () => {
    // Prompt clock out if clocked in
    if (state.clockedIn) {
        if (confirm('Clock out before logging off?')) {
            clockOut();
        }
    }
    state.currentUser = null;
    state.currentStaff = null;
    state.pin = '';
    state.clockedIn = false;
    updatePinDots();
    $('#pos-screen').classList.remove('active');
    $('#login-screen').classList.add('active');
});

// ==========================================
// View Navigation
// ==========================================
$$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        $$('.main-view').forEach(v => v.classList.remove('active'));
        $(`#${view === 'order' ? 'order' : view}-view`).classList.add('active');
        state.currentView = view;

        if (view === 'kitchen') populateKitchen();
        if (view === 'tickets') populateTicketsList();
    });
});

// ==========================================
// Menu System
// ==========================================
$$('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        $$('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentCategory = tab.dataset.category;
        // Clear search when switching categories
        const searchInput = document.getElementById('menu-search');
        if (searchInput) { searchInput.value = ''; }
        const clearBtn = document.getElementById('menu-search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        state.menuSearchQuery = '';
        populateMenu();
    });
});

// Menu search
const menuSearchInput = document.getElementById('menu-search');
const menuSearchClear = document.getElementById('menu-search-clear');

if (menuSearchInput) {
    menuSearchInput.addEventListener('input', (e) => {
        state.menuSearchQuery = e.target.value.trim().toLowerCase();
        if (menuSearchClear) {
            menuSearchClear.style.display = state.menuSearchQuery ? 'flex' : 'none';
        }
        populateMenu();
    });
}

if (menuSearchClear) {
    menuSearchClear.addEventListener('click', () => {
        menuSearchInput.value = '';
        state.menuSearchQuery = '';
        menuSearchClear.style.display = 'none';
        populateMenu();
        menuSearchInput.focus();
    });
}

function populateMenu() {
    const grid = $('#menu-grid');
    let items;

    // If searching, search across all categories
    if (state.menuSearchQuery) {
        items = [];
        Object.values(MENU).forEach(catItems => {
            catItems.forEach(item => {
                if (item.name.toLowerCase().includes(state.menuSearchQuery)) {
                    items.push(item);
                }
            });
        });
    } else {
        items = MENU[state.currentCategory] || [];
    }

    grid.innerHTML = '';

    items.forEach(item => {
        const el = document.createElement('button');
        el.className = 'menu-item';

        const [cashPrice, cardPrice] = getDualPrices(item.price);
        let priceHtml;

        if (CONFIG.cashDiscount.enabled && CONFIG.cashDiscount.showDualPricing && item.price > 0) {
            priceHtml = `
                <span class="menu-item-price">${formatCurrency(item.price)}</span>
                <div class="menu-item-dual-price">
                    <span class="cash">${formatCurrency(cashPrice)}</span>
                    <span class="card">${formatCurrency(cardPrice)}</span>
                </div>
            `;
        } else {
            priceHtml = `<span class="menu-item-price">${formatCurrency(item.price)}</span>`;
        }

        el.innerHTML = `
            <span class="menu-item-name">${item.name}</span>
            ${priceHtml}
        `;

        el.addEventListener('click', () => addToTicket(item));
        grid.appendChild(el);
    });
}

// ==========================================
// Ticket Management
// ==========================================
function newTicket() {
    state.ticket = {
        id: state.ticketCounter++,
        type: 'dine-in',
        items: [],
        table: null,
        server: state.currentUser,
        discount: null
    };
    appliedDiscount = null;
    appliedPromo = null;
    deliveryFee = 0;
    deliveryAddress = '';
    hideDeliveryFields();
    updateTicketDisplay();
}

function addToTicket(menuItem) {
    // Check if item has modifiers
    const modGroups = ITEM_MODIFIERS[menuItem.id] || ITEM_MODIFIERS._default;
    if (modGroups && modGroups.length > 0 && modGroups[0] !== 'allergy') {
        // Show modifier modal
        openModifierModal(menuItem, modGroups);
        return;
    }

    // No important modifiers, add directly
    addItemDirectly(menuItem, []);
}

function addItemDirectly(menuItem, selectedMods) {
    // If no mods, check for existing item
    if (selectedMods.length === 0) {
        const existing = state.ticket.items.find(i => i.id === menuItem.id && i.mods.length === 0);
        if (existing) {
            existing.qty++;
            updateTicketDisplay();
            return;
        }
    }

    const modPrice = selectedMods.reduce((sum, m) => sum + (m.price || 0), 0);
    state.ticket.items.push({
        ...menuItem,
        price: menuItem.price + modPrice,
        basePrice: menuItem.price,
        qty: 1,
        mods: selectedMods.map(m => m.name)
    });
    updateTicketDisplay();
}

// ==========================================
// Modifier Modal
// ==========================================
let pendingModItem = null;
let pendingModSelections = {};

function openModifierModal(menuItem, modGroupKeys) {
    pendingModItem = menuItem;
    pendingModSelections = {};

    $('#modifier-item-name').textContent = menuItem.name + ' - Modifiers';

    const body = $('#modifier-body');
    body.innerHTML = '';

    modGroupKeys.forEach(groupKey => {
        const group = MODIFIERS[groupKey];
        if (!group) return;

        pendingModSelections[groupKey] = [];

        const section = document.createElement('div');
        section.className = 'modifier-group';
        section.innerHTML = `
            <div class="modifier-group-title">${group.label}${group.required ? ' *' : ''} ${group.max > 1 ? '(up to ' + group.max + ')' : ''}</div>
            <div class="modifier-options" id="mod-group-${groupKey}">
                ${group.options.map((opt, idx) => `
                    <button class="modifier-option" data-group="${groupKey}" data-idx="${idx}">
                        ${opt.name}${opt.price > 0 ? ' (+' + formatCurrency(opt.price) + ')' : ''}
                    </button>
                `).join('')}
            </div>
        `;
        body.appendChild(section);
    });

    // Wire up modifier option buttons
    body.querySelectorAll('.modifier-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const groupKey = btn.dataset.group;
            const idx = parseInt(btn.dataset.idx);
            const group = MODIFIERS[groupKey];
            const opt = group.options[idx];

            if (btn.classList.contains('selected')) {
                btn.classList.remove('selected');
                pendingModSelections[groupKey] = pendingModSelections[groupKey].filter(o => o.name !== opt.name);
            } else {
                if (group.max === 1) {
                    // Single select - deselect others in group
                    body.querySelectorAll(`[data-group="${groupKey}"]`).forEach(b => b.classList.remove('selected'));
                    pendingModSelections[groupKey] = [opt];
                } else if (pendingModSelections[groupKey].length < group.max) {
                    pendingModSelections[groupKey].push(opt);
                } else {
                    showToast('Maximum ' + group.max + ' selections for ' + group.label, 'warning');
                    return;
                }
                btn.classList.add('selected');
            }
        });
    });

    $('#modifier-modal').classList.add('active');
}

$('#modifier-confirm').addEventListener('click', () => {
    if (!pendingModItem) return;

    const allMods = [];
    Object.values(pendingModSelections).forEach(selections => {
        selections.forEach(opt => allMods.push(opt));
    });

    addItemDirectly(pendingModItem, allMods);
    $('#modifier-modal').classList.remove('active');
    pendingModItem = null;

    const modNames = allMods.map(m => m.name).join(', ');
    if (modNames) {
        showToast(pendingModItem ? 'Added with: ' + modNames : 'Item added');
    }
});

$('#modifier-cancel').addEventListener('click', () => {
    // Add without modifiers
    if (pendingModItem) {
        addItemDirectly(pendingModItem, []);
    }
    $('#modifier-modal').classList.remove('active');
    pendingModItem = null;
});

$('#close-modifier').addEventListener('click', () => {
    $('#modifier-modal').classList.remove('active');
    pendingModItem = null;
});

function removeFromTicket(index) {
    state.ticket.items.splice(index, 1);
    updateTicketDisplay();
}

function updateItemQty(index, delta) {
    const item = state.ticket.items[index];
    item.qty += delta;
    if (item.qty <= 0) {
        state.ticket.items.splice(index, 1);
    }
    updateTicketDisplay();
}

function updateTicketDisplay() {
    const container = $('#ticket-items');
    const items = state.ticket.items;

    $('#ticket-number').textContent = '#' + (state.ticket.id || '--');
    $('#ticket-type').textContent = state.ticket.type.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-ticket"><p>Tap menu items to add to order</p></div>';
        updateTotals(0, 0, 0);
        return;
    }

    container.innerHTML = '';
    let subtotal = 0;

    items.forEach((item, index) => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;

        const el = document.createElement('div');
        el.className = 'ticket-item';
        el.innerHTML = `
            <button class="ticket-item-qty" onclick="updateItemQty(${index}, 1)">${item.qty}</button>
            <div class="ticket-item-details">
                <div class="ticket-item-name">${item.name}</div>
                ${item.mods.length ? '<div class="ticket-item-mods">' + item.mods.join(', ') + '</div>' : ''}
            </div>
            <span class="ticket-item-price">${formatCurrency(lineTotal)}</span>
            <button class="ticket-item-remove" onclick="removeFromTicket(${index})">&times;</button>
        `;
        container.appendChild(el);
    });

    // Calculate discount
    let discountAmount = 0;
    if (state.ticket.discount) {
        if (state.ticket.discount.type === 'percent') {
            discountAmount = subtotal * (state.ticket.discount.value / 100);
        } else {
            discountAmount = Math.min(state.ticket.discount.value, subtotal);
        }
    }

    const afterDiscount = subtotal - discountAmount;

    // Delivery fee
    const isDelivery = state.ticket.type === 'delivery';
    const currentDeliveryFee = isDelivery ? calculateDeliveryFee(subtotal) : 0;
    deliveryFee = currentDeliveryFee;

    const tax = afterDiscount * (CONFIG.taxRate / 100);
    const total = afterDiscount + tax + currentDeliveryFee;

    updateTotals(subtotal, tax, total, discountAmount, currentDeliveryFee);

    // Update delivery fee display
    const feeEl = document.getElementById('delivery-fee-amount');
    if (feeEl) feeEl.textContent = formatCurrency(currentDeliveryFee);
}

// Make functions global for onclick handlers
window.updateItemQty = updateItemQty;
window.removeFromTicket = removeFromTicket;

function updateTotals(subtotal, tax, total, discountAmount, deliveryFeeAmt) {
    discountAmount = discountAmount || 0;
    deliveryFeeAmt = deliveryFeeAmt || 0;

    $('#subtotal').textContent = formatCurrency(subtotal);
    $('#tax-amount').textContent = formatCurrency(tax);
    $('#total-amount').textContent = formatCurrency(total);

    // Show ticket discount row
    const ticketDiscountRow = document.getElementById('ticket-discount-row');
    if (discountAmount > 0) {
        if (!ticketDiscountRow) {
            const discRow = document.createElement('div');
            discRow.id = 'ticket-discount-row';
            discRow.className = 'summary-row';
            discRow.innerHTML = `
                <span id="ticket-discount-label" style="color: var(--cash-green)">Discount</span>
                <span id="ticket-discount-amount" class="discount">-${formatCurrency(discountAmount)}</span>
            `;
            const taxRow = document.querySelector('.summary-row:nth-child(4)');
            if (taxRow) taxRow.parentNode.insertBefore(discRow, taxRow);
        } else {
            ticketDiscountRow.querySelector('#ticket-discount-label').textContent =
                state.ticket.discount ? state.ticket.discount.reason : 'Discount';
            ticketDiscountRow.querySelector('#ticket-discount-amount').textContent =
                '-' + formatCurrency(discountAmount);
            ticketDiscountRow.style.display = 'flex';
        }
    } else if (ticketDiscountRow) {
        ticketDiscountRow.style.display = 'none';
    }

    // Show delivery fee row
    const deliveryRow = document.getElementById('delivery-fee-row');
    if (deliveryFeeAmt > 0) {
        if (!deliveryRow) {
            const feeRow = document.createElement('div');
            feeRow.id = 'delivery-fee-row';
            feeRow.className = 'summary-row';
            feeRow.innerHTML = `
                <span>Delivery Fee</span>
                <span>${formatCurrency(deliveryFeeAmt)}</span>
            `;
            const totalRow = document.querySelector('.summary-row.total');
            if (totalRow) totalRow.parentNode.insertBefore(feeRow, totalRow);
        } else {
            deliveryRow.querySelector('span:last-child').textContent = formatCurrency(deliveryFeeAmt);
            deliveryRow.style.display = 'flex';
        }
    } else if (deliveryRow) {
        deliveryRow.style.display = 'none';
    }

    // Dual pricing
    if (CONFIG.cashDiscount.enabled && CONFIG.cashDiscount.showDualPricing) {
        const rate = CONFIG.cashDiscount.rate / 100;
        let cashTotal, cardTotal;

        if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
            cardTotal = total;
            cashTotal = total * (1 - rate);
            $('#discount-row').style.display = 'flex';
            $('#surcharge-row').style.display = 'none';
            $('#discount-label').textContent = CONFIG.cashDiscount.cashLabel + ' (' + CONFIG.cashDiscount.rate + '%)';
            $('#discount-amount').textContent = '-' + formatCurrency(total * rate);
        } else {
            cashTotal = total;
            cardTotal = total * (1 + rate);
            $('#discount-row').style.display = 'none';
            $('#surcharge-row').style.display = 'flex';
            $('#surcharge-label').textContent = CONFIG.cashDiscount.surchargeLabel + ' (' + CONFIG.cashDiscount.rate + '%)';
            $('#surcharge-amount').textContent = '+' + formatCurrency(total * rate);
        }

        $('#dual-price-display').style.display = 'flex';
        $('#cash-total').textContent = formatCurrency(cashTotal);
        $('#card-total').textContent = formatCurrency(cardTotal);
    } else {
        $('#discount-row').style.display = 'none';
        $('#surcharge-row').style.display = 'none';
        $('#dual-price-display').style.display = 'none';
    }
}

// ==========================================
// Order Type (base handler - overridden by delivery support)
// ==========================================
// Note: primary handler is in delivery support section
$('#order-type-select').removeEventListener('change', () => {});
$('#order-type-select').addEventListener('change', (e) => {
    // handled by delivery support section
    state.ticket.type = e.target.value;
    updateTicketDisplay();
});

// ==========================================
// Action Buttons
// ==========================================
$('#btn-send').addEventListener('click', () => {
    if (state.ticket.items.length === 0) {
        showToast('No items to send', 'warning');
        return;
    }

    // Send to kitchen
    const kitchenOrder = {
        id: state.ticket.id,
        items: state.ticket.items.map(i => ({...i})),
        time: new Date(),
        status: 'new',
        type: state.ticket.type,
        server: state.currentUser
    };

    state.kitchenOrders.push(kitchenOrder);

    // Also add to all tickets
    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * (CONFIG.taxRate / 100);
    const total = subtotal + tax;

    const discountAmount = state.ticket.discount ? state.ticket.discount.amount : 0;
    const afterDiscount = subtotal - discountAmount;
    const currentDeliveryFee = state.ticket.type === 'delivery' ? calculateDeliveryFee(subtotal) : 0;
    const adjustedTax = afterDiscount * (CONFIG.taxRate / 100);
    const adjustedTotal = afterDiscount + adjustedTax + currentDeliveryFee;

    state.allTickets.push({
        id: state.ticket.id,
        server: state.currentUser,
        type: state.ticket.type,
        items: [...state.ticket.items],
        subtotal,
        tax: adjustedTax,
        total: adjustedTotal,
        discount: state.ticket.discount || null,
        deliveryFee: currentDeliveryFee,
        deliveryAddress: deliveryAddress || '',
        table: state.ticket.table,
        status: 'open',
        paid: false,
        time: new Date()
    });

    // Print kitchen tickets routed by station
    printKitchenTickets(kitchenOrder);

    showToast('Order #' + state.ticket.id + ' sent to kitchen');
    newTicket();
    populateKitchen();
});

// ==========================================
// Kitchen Ticket Printing (Station Routing)
// ==========================================
function printKitchenTickets(order) {
    // Group items by station
    const stationGroups = {};
    order.items.forEach(item => {
        const station = item.station || 'expo';
        if (!stationGroups[station]) stationGroups[station] = [];
        stationGroups[station].push(item);
    });

    // Generate a kitchen ticket per station
    Object.entries(stationGroups).forEach(([station, items]) => {
        const ticketHtml = generateKitchenTicketHtml(order, station, items);
        // In production, this would route to the station's printer
        // For now, log it and show a single combined preview
        console.log(`Kitchen ticket for ${station.toUpperCase()}:`, items.map(i => i.name).join(', '));
    });
}

function generateKitchenTicketHtml(order, station, items) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `
<div style="font-family: 'Courier New', monospace; width: 280px; padding: 8px;">
    <div style="text-align: center; font-weight: bold; font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 4px;">
        ** ${station.toUpperCase()} **
    </div>
    <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px;">
        <span>#${order.id}</span>
        <span>${order.type.toUpperCase()}</span>
        <span>${timeStr}</span>
    </div>
    <div style="font-size: 12px; margin-bottom: 6px;">
        Server: ${order.server || 'N/A'}
        ${order.table ? ' | Table: ' + order.table : ''}
    </div>
    <div style="border-top: 1px dashed #000; padding-top: 6px;">
        ${items.map(item => `
            <div style="font-size: 16px; font-weight: bold; padding: 4px 0; border-bottom: 1px dotted #ccc;">
                ${item.qty > 1 ? '(' + item.qty + ') ' : ''}${item.name}
                ${item.mods && item.mods.length ? '<div style="font-size: 12px; font-weight: normal; padding-left: 12px; color: #666;">  >> ' + item.mods.join(', ') + '</div>' : ''}
            </div>
        `).join('')}
    </div>
    <div style="text-align: center; margin-top: 8px; font-size: 10px; color: #999;">
        ${items.length} item${items.length !== 1 ? 's' : ''} for ${station}
    </div>
</div>`;
}

// Print kitchen ticket to a new window (for reprint / manual print)
function printKitchenOrder(orderId) {
    const order = state.kitchenOrders.find(o => o.id === orderId);
    if (!order) {
        showToast('Kitchen order not found', 'error');
        return;
    }

    const stationGroups = {};
    order.items.forEach(item => {
        const station = item.station || 'expo';
        if (!stationGroups[station]) stationGroups[station] = [];
        stationGroups[station].push(item);
    });

    const printWindow = window.open('', 'kitchen-ticket', 'width=320,height=500');
    if (!printWindow) {
        showToast('Pop-up blocked', 'error');
        return;
    }

    let allTickets = '';
    Object.entries(stationGroups).forEach(([station, items]) => {
        allTickets += generateKitchenTicketHtml(order, station, items);
        allTickets += '<div style="border-bottom: 3px dashed #000; margin: 12px 0;"></div>';
    });

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Kitchen Ticket</title>
        <style>@page { size: 80mm auto; margin: 0; } body { margin: 0; padding: 4px; }</style>
        </head><body>${allTickets}
        <div style="text-align:center; margin-top:12px;">
            <button onclick="window.print()" style="padding:8px 20px; font-size:14px; cursor:pointer;">Print</button>
            <button onclick="window.close()" style="padding:8px 20px; font-size:14px; cursor:pointer; margin-left:8px;">Close</button>
        </div>
        </body></html>`);
    printWindow.document.close();
    showToast('Kitchen ticket ready');
}
window.printKitchenOrder = printKitchenOrder;

// ==========================================
// Hold / Park Order System
// ==========================================
const heldOrders = [];

$('#btn-hold').addEventListener('click', () => {
    if (state.ticket.items.length === 0) {
        // If nothing in current ticket, show held orders to recall
        if (heldOrders.length > 0) {
            openHeldOrdersModal();
        } else {
            showToast('No items to hold', 'warning');
        }
        return;
    }

    // Hold current ticket
    heldOrders.push({
        id: state.ticket.id,
        type: state.ticket.type,
        items: state.ticket.items.map(i => ({ ...i })),
        table: state.ticket.table,
        server: state.currentUser,
        discount: state.ticket.discount,
        heldAt: new Date(),
        note: ''
    });

    showToast('Order #' + state.ticket.id + ' held (' + heldOrders.length + ' held)');
    updateHeldBadge();
    newTicket();
});

function updateHeldBadge() {
    let badge = document.getElementById('held-badge');
    if (heldOrders.length > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'held-badge';
            badge.className = 'held-badge';
            const holdBtn = $('#btn-hold');
            holdBtn.style.position = 'relative';
            holdBtn.appendChild(badge);
        }
        badge.textContent = heldOrders.length;
        badge.style.display = 'inline-flex';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function openHeldOrdersModal() {
    let modal = document.getElementById('held-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'held-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: min(500px, 95vw);">
                <div class="modal-header">
                    <h3>Held Orders</h3>
                    <button class="modal-close" id="close-held">&times;</button>
                </div>
                <div id="held-body" style="padding: 16px; max-height: 60vh; overflow-y: auto;"></div>
                <div style="padding: 12px 16px; border-top: 1px solid var(--border-light);">
                    <button class="btn-cancel" id="held-close-btn" style="width: 100%;">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-held').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('held-close-btn').addEventListener('click', () => modal.classList.remove('active'));
    }

    const body = document.getElementById('held-body');
    if (heldOrders.length === 0) {
        body.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No held orders</p>';
    } else {
        body.innerHTML = heldOrders.map((order, idx) => {
            const elapsed = Math.floor((Date.now() - new Date(order.heldAt).getTime()) / 60000);
            const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
            const total = order.items.reduce((s, i) => s + i.price * i.qty, 0);
            return `
                <div class="held-card" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 10px; margin-bottom: 8px; background: var(--bg-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 700;">#${order.id} - ${order.type}</span>
                        <span style="font-size: 0.8rem; color: var(--warning); font-weight: 600;">${elapsed}m ago</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
                        ${order.server} &bull; ${itemCount} items &bull; ${formatCurrency(total)}
                        ${order.table ? ' &bull; Table ' + order.table : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                        ${order.items.slice(0, 3).map(i => (i.qty > 1 ? i.qty + 'x ' : '') + i.name).join(', ')}
                        ${order.items.length > 3 ? '...' : ''}
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-confirm" style="flex: 1; padding: 8px;" onclick="recallHeldOrder(${idx})">Recall</button>
                        <button class="btn-cancel" style="flex: 0 0 auto; padding: 8px 14px;" onclick="deleteHeldOrder(${idx})">Discard</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.classList.add('active');
}

function recallHeldOrder(idx) {
    const order = heldOrders[idx];
    if (!order) return;

    // If current ticket has items, hold it first
    if (state.ticket.items.length > 0) {
        heldOrders.push({
            id: state.ticket.id,
            type: state.ticket.type,
            items: state.ticket.items.map(i => ({ ...i })),
            table: state.ticket.table,
            server: state.currentUser,
            discount: state.ticket.discount,
            heldAt: new Date()
        });
    }

    // Recall the held order
    state.ticket = {
        id: order.id,
        type: order.type,
        items: order.items.map(i => ({ ...i })),
        table: order.table,
        server: order.server,
        discount: order.discount
    };

    if (order.discount) {
        appliedDiscount = { ...order.discount };
    }

    heldOrders.splice(idx, 1);
    updateHeldBadge();
    updateTicketDisplay();

    const modal = document.getElementById('held-modal');
    if (modal) modal.classList.remove('active');

    showToast('Order #' + order.id + ' recalled from hold');
}
window.recallHeldOrder = recallHeldOrder;

function deleteHeldOrder(idx) {
    if (!confirm('Discard held order?')) return;
    heldOrders.splice(idx, 1);
    updateHeldBadge();
    openHeldOrdersModal(); // Refresh display
    showToast('Held order discarded');
}
window.deleteHeldOrder = deleteHeldOrder;

$('#btn-split').addEventListener('click', () => {
    showToast('Split check feature', 'warning');
});

$('#btn-discount').addEventListener('click', () => {
    if (state.ticket.items.length === 0) {
        showToast('No items to discount', 'warning');
        return;
    }
    openDiscountModal();
});

// ==========================================
// Payment System
// ==========================================
function openPayment(method) {
    if (state.ticket.items.length === 0) {
        showToast('No items to pay for', 'warning');
        return;
    }

    state.paymentMethod = method;
    state.tenderedAmount = '';

    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * (CONFIG.taxRate / 100);
    let total = subtotal + tax;
    const rate = CONFIG.cashDiscount.rate / 100;

    let cashPrice = total;
    let cardPrice = total;
    let savings = 0;

    if (CONFIG.cashDiscount.enabled) {
        if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
            cashPrice = total * (1 - rate);
            cardPrice = total;
            savings = total * rate;
        } else {
            cashPrice = total;
            cardPrice = total * (1 + rate);
            savings = total * rate;
        }
    }

    const due = method === 'cash' ? cashPrice : cardPrice;

    $('#payment-due').textContent = formatCurrency(due);
    $('#payment-cash-price').textContent = formatCurrency(cashPrice);
    $('#payment-card-price').textContent = formatCurrency(cardPrice);
    $('#payment-cash-savings').textContent = savings > 0 ? 'Save ' + formatCurrency(savings) : '';

    // Highlight active method
    $$('.payment-method-btn').forEach(b => b.classList.remove('active'));
    const methodMap = { cash: 'pm-cash', credit: 'pm-credit', card: 'pm-credit', debit: 'pm-debit', other: 'pm-gift' };
    const activeBtn = $(('#' + (methodMap[method] || 'pm-cash')));
    if (activeBtn) activeBtn.classList.add('active');

    // Show/hide cash-specific UI
    const isCash = method === 'cash';
    $('#quick-cash-buttons').style.display = isCash ? 'grid' : 'none';
    $('#btn-process-payment').style.display = isCash ? 'block' : 'none';
    $('#btn-send-terminal').style.display = isCash ? 'none' : 'block';
    $('#change-display').style.display = 'none';

    updateTenderedDisplay();
    $('#payment-modal').classList.add('active');
}

$('#btn-pay-cash').addEventListener('click', () => openPayment('cash'));
$('#btn-pay-card').addEventListener('click', () => openPayment('credit'));
$('#btn-pay-other').addEventListener('click', () => openPayment('other'));

$('#close-payment').addEventListener('click', () => {
    $('#payment-modal').classList.remove('active');
});

// Payment method buttons inside modal
$$('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.payment-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.paymentMethod = btn.dataset.method;

        const isCash = state.paymentMethod === 'cash';
        $('#quick-cash-buttons').style.display = isCash ? 'grid' : 'none';
        $('#btn-process-payment').style.display = isCash ? 'block' : 'none';
        $('#btn-send-terminal').style.display = isCash ? 'none' : 'block';

        // Update due amount
        const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
        const tax = subtotal * (CONFIG.taxRate / 100);
        let total = subtotal + tax;
        const rate = CONFIG.cashDiscount.rate / 100;

        if (CONFIG.cashDiscount.enabled) {
            if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT' && isCash) {
                total = total * (1 - rate);
            } else if (CONFIG.cashDiscount.mode === 'CARD_SURCHARGE' && !isCash) {
                total = total * (1 + rate);
            }
        }

        $('#payment-due').textContent = formatCurrency(total);
    });
});

// Quick cash buttons
$$('.quick-cash').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = btn.dataset.amount;
        if (amount === 'exact') {
            state.tenderedAmount = $('#payment-due').textContent.replace('$', '');
        } else {
            state.tenderedAmount = amount;
        }
        updateTenderedDisplay();
    });
});

// Payment numpad
$$('.payment-numpad .numpad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const num = btn.dataset.num;
        if (num === 'clear') {
            state.tenderedAmount = '';
        } else {
            state.tenderedAmount += num;
        }
        updateTenderedDisplay();
    });
});

function updateTenderedDisplay() {
    const val = state.tenderedAmount || '0.00';
    $('#tendered-amount').value = parseFloat(val).toFixed(2);

    const due = parseFloat($('#payment-due').textContent.replace('$', ''));
    const tendered = parseFloat(val) || 0;
    const change = tendered - due;

    if (change > 0 && state.paymentMethod === 'cash') {
        $('#change-display').style.display = 'block';
        $('#change-amount').textContent = formatCurrency(change);
    } else {
        $('#change-display').style.display = 'none';
    }
}

// Process payment
$('#btn-process-payment').addEventListener('click', () => {
    processPayment('cash');
});

$('#btn-send-terminal').addEventListener('click', () => {
    processPayment('terminal');
});

function processPayment(via) {
    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * (CONFIG.taxRate / 100);
    let total = subtotal + tax;

    if (via === 'terminal') {
        // Simulate sending to PaybotX terminal
        $('#terminal-state').textContent = 'Processing...';
        showToast('Sent to PaybotX terminal - waiting for card...', 'warning');

        setTimeout(() => {
            $('#terminal-state').textContent = 'Approved';
            completePayment(total, state.paymentMethod);
        }, 2000);
    } else {
        completePayment(total, 'cash');
    }
}

function completePayment(total, method) {
    // Find and update ticket in allTickets
    const ticketIndex = state.allTickets.findIndex(t => t.id === state.ticket.id);
    if (ticketIndex >= 0) {
        const t = state.allTickets[ticketIndex];
        t.status = 'paid';
        t.paid = true;
        t.paymentMethod = method;
        t.paidAt = new Date().toISOString();
        t.deliveryFee = deliveryFee || 0;
        t.deliveryAddress = deliveryAddress || '';
        t.discount = state.ticket.discount || null;

        // Auto-print receipt
        printReceipt(t);
    }

    // Release table if dine-in
    if (state.ticket.table) {
        const table = TABLES.find(t => t.number === state.ticket.table);
        if (table) {
            table.status = 'dirty';
            table.amount = null;
        }
    }

    $('#payment-modal').classList.remove('active');
    showToast('Payment received - Ticket #' + state.ticket.id + ' (' + method + ')');
    newTicket();
}

// ==========================================
// Table Management (Enhanced Visual Layout)
// ==========================================
const TABLE_LAYOUT = {
    'Main Floor': [
        { number: 1, seats: 2, x: 5, y: 10, shape: 'round' },
        { number: 2, seats: 2, x: 22, y: 10, shape: 'round' },
        { number: 3, seats: 4, x: 40, y: 8, shape: 'rect' },
        { number: 4, seats: 4, x: 60, y: 8, shape: 'rect' },
        { number: 5, seats: 6, x: 80, y: 8, shape: 'rect-lg' },
        { number: 6, seats: 4, x: 5, y: 38, shape: 'rect' },
        { number: 7, seats: 4, x: 25, y: 38, shape: 'rect' },
        { number: 8, seats: 8, x: 48, y: 35, shape: 'rect-xl' },
        { number: 9, seats: 2, x: 75, y: 38, shape: 'round' },
        { number: 10, seats: 2, x: 88, y: 38, shape: 'round' },
        { number: 11, seats: 4, x: 5, y: 65, shape: 'rect' },
        { number: 12, seats: 4, x: 25, y: 65, shape: 'rect' },
        { number: 13, seats: 6, x: 48, y: 62, shape: 'rect-lg' },
        { number: 14, seats: 4, x: 73, y: 65, shape: 'rect' },
    ],
    'Patio': [
        { number: 15, seats: 4, x: 10, y: 15, shape: 'round' },
        { number: 16, seats: 4, x: 35, y: 15, shape: 'round' },
        { number: 17, seats: 6, x: 60, y: 15, shape: 'round' },
        { number: 18, seats: 2, x: 10, y: 50, shape: 'round' },
        { number: 19, seats: 2, x: 35, y: 50, shape: 'round' },
        { number: 20, seats: 2, x: 60, y: 50, shape: 'round' },
    ],
    'Bar': [
        { number: 'B1', seats: 1, x: 10, y: 30, shape: 'stool' },
        { number: 'B2', seats: 1, x: 20, y: 30, shape: 'stool' },
        { number: 'B3', seats: 1, x: 30, y: 30, shape: 'stool' },
        { number: 'B4', seats: 1, x: 40, y: 30, shape: 'stool' },
        { number: 'B5', seats: 1, x: 50, y: 30, shape: 'stool' },
        { number: 'B6', seats: 1, x: 60, y: 30, shape: 'stool' },
        { number: 'B7', seats: 1, x: 70, y: 30, shape: 'stool' },
        { number: 'B8', seats: 1, x: 80, y: 30, shape: 'stool' },
    ],
    'Private': [
        { number: 'P1', seats: 10, x: 30, y: 25, shape: 'rect-xl' },
        { number: 'P2', seats: 12, x: 30, y: 60, shape: 'rect-xl' },
    ]
};

let activeFloor = 'Main Floor';

function getTableData(num) {
    return TABLES.find(t => t.number === num) || { number: num, seats: 2, status: 'available', amount: null, server: null, startTime: null };
}

function populateTables() {
    const grid = $('#table-grid');
    grid.innerHTML = '';

    // Floor plan visual layout
    const layout = TABLE_LAYOUT[activeFloor] || [];

    layout.forEach(tbl => {
        const data = getTableData(tbl.number);

        const el = document.createElement('button');
        el.className = 'table-visual ' + (data.status || 'available') + ' shape-' + tbl.shape;
        el.style.left = tbl.x + '%';
        el.style.top = tbl.y + '%';

        let timeStr = '';
        if (data.startTime) {
            const elapsed = Math.floor((Date.now() - new Date(data.startTime).getTime()) / 60000);
            timeStr = elapsed + 'm';
        }

        el.innerHTML = `
            <span class="table-vis-number">${tbl.number}</span>
            <span class="table-vis-seats">${tbl.seats} <small>seats</small></span>
            ${data.amount ? '<span class="table-vis-amount">' + formatCurrency(data.amount) + '</span>' : ''}
            ${data.server ? '<span class="table-vis-server">' + data.server + '</span>' : ''}
            ${timeStr ? '<span class="table-vis-time">' + timeStr + '</span>' : ''}
        `;

        el.addEventListener('click', () => handleTableClick(tbl, data));
        grid.appendChild(el);
    });

    // Also show a quick summary
    updateTableSummary();
}

function handleTableClick(tbl, data) {
    if (data.status === 'available') {
        // Assign table to current ticket
        data.status = 'occupied';
        data.server = state.currentUser;
        data.startTime = new Date().toISOString();
        state.ticket.table = tbl.number;

        // Update TABLES array
        const existing = TABLES.find(t => t.number === tbl.number);
        if (existing) {
            existing.status = 'occupied';
            existing.server = state.currentUser;
            existing.startTime = data.startTime;
        } else {
            TABLES.push({ ...tbl, status: 'occupied', server: state.currentUser, startTime: data.startTime, amount: null });
        }

        showToast('Table ' + tbl.number + ' assigned to ' + state.currentUser);
        populateTables();

    } else if (data.status === 'occupied') {
        // Show table details modal
        openTableDetailModal(tbl, data);

    } else if (data.status === 'dirty') {
        if (confirm('Mark table ' + tbl.number + ' as clean?')) {
            const existing = TABLES.find(t => t.number === tbl.number);
            if (existing) {
                existing.status = 'available';
                existing.server = null;
                existing.startTime = null;
                existing.amount = null;
            }
            showToast('Table ' + tbl.number + ' cleared');
            populateTables();
        }

    } else if (data.status === 'reserved') {
        showToast('Table ' + tbl.number + ' is reserved', 'warning');
    }
}

function openTableDetailModal(tbl, data) {
    // Create a quick info modal for occupied tables
    let modal = document.getElementById('table-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'table-detail-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: min(380px, 90vw);">
                <div class="modal-header">
                    <h3 id="table-detail-title">Table Details</h3>
                    <button class="modal-close" id="close-table-detail">&times;</button>
                </div>
                <div id="table-detail-body" style="padding: 16px;"></div>
                <div style="padding: 12px 16px; display: flex; gap: 8px; border-top: 1px solid var(--border-light);">
                    <button class="btn-confirm" id="table-detail-transfer" style="flex:1">Transfer</button>
                    <button class="btn-cancel" id="table-detail-close" style="flex:1">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('close-table-detail').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('table-detail-close').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('table-detail-transfer').addEventListener('click', () => {
            showToast('Transfer initiated - select destination table', 'warning');
            modal.classList.remove('active');
        });
    }

    const elapsed = data.startTime
        ? Math.floor((Date.now() - new Date(data.startTime).getTime()) / 60000)
        : 0;

    document.getElementById('table-detail-title').textContent = 'Table ' + tbl.number;
    document.getElementById('table-detail-body').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Status</div>
                <div style="font-weight: 700; color: var(--warning);">Occupied</div>
            </div>
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Elapsed</div>
                <div style="font-weight: 700;">${elapsed} min</div>
            </div>
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Server</div>
                <div style="font-weight: 600;">${data.server || 'Unassigned'}</div>
            </div>
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Amount</div>
                <div style="font-weight: 700;">${data.amount ? formatCurrency(data.amount) : 'N/A'}</div>
            </div>
        </div>
        <div style="margin-top: 12px; padding: 8px; font-size: 0.85rem; color: var(--text-secondary);">
            Seats: ${tbl.seats} &bull; Section: ${activeFloor}
        </div>
    `;

    modal.classList.add('active');
}

function updateTableSummary() {
    const layout = TABLE_LAYOUT[activeFloor] || [];
    let available = 0, occupied = 0, reserved = 0, dirty = 0;

    layout.forEach(tbl => {
        const data = getTableData(tbl.number);
        switch (data.status) {
            case 'available': available++; break;
            case 'occupied': occupied++; break;
            case 'reserved': reserved++; break;
            case 'dirty': dirty++; break;
        }
    });

    // Update legend counts if elements exist
    const legend = document.querySelector('.table-legend');
    if (legend) {
        legend.innerHTML = `
            <span class="legend-item"><span class="legend-dot available"></span> Available (${available})</span>
            <span class="legend-item"><span class="legend-dot occupied"></span> Occupied (${occupied})</span>
            <span class="legend-item"><span class="legend-dot reserved"></span> Reserved (${reserved})</span>
            <span class="legend-item"><span class="legend-dot dirty"></span> Dirty (${dirty})</span>
        `;
    }
}

// Floor tab switching
$$('.floor-tab').forEach((tab, idx) => {
    tab.addEventListener('click', () => {
        $$('.floor-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const floors = ['Main Floor', 'Patio', 'Bar', 'Private'];
        activeFloor = floors[idx] || 'Main Floor';
        populateTables();
    });
});

// ==========================================
// Kitchen Display System
// ==========================================
function populateKitchen() {
    const container = $('#kds-tickets');
    container.innerHTML = '';

    let activeCount = 0;
    let totalTime = 0;

    state.kitchenOrders.forEach(order => {
        const elapsed = Math.floor((new Date() - order.time) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = minutes + ':' + String(seconds).padStart(2, '0');

        let timeClass = 'green';
        if (minutes >= 10) timeClass = 'red';
        else if (minutes >= 5) timeClass = 'yellow';

        const isUrgent = minutes >= 10;
        activeCount++;
        totalTime += elapsed;

        const el = document.createElement('div');
        el.className = 'kds-ticket' + (isUrgent ? ' urgent' : '');
        el.innerHTML = `
            <div class="kds-ticket-header">
                <span>#${order.id} - ${order.type}</span>
                <span class="kds-ticket-time ${timeClass}">${timeStr}</span>
            </div>
            <div class="kds-ticket-items">
                ${order.items.map(item => `
                    <div class="kds-item">
                        <span class="kds-item-name">${item.name}</span>
                        <span class="kds-item-qty">x${item.qty}</span>
                    </div>
                `).join('')}
            </div>
            <div class="kds-ticket-footer">
                <button class="kds-bump-btn" data-order-id="${order.id}">BUMP</button>
            </div>
        `;

        el.querySelector('.kds-bump-btn').addEventListener('click', () => {
            state.kitchenOrders = state.kitchenOrders.filter(o => o.id !== order.id);
            showToast('Order #' + order.id + ' bumped');
            populateKitchen();
        });

        container.appendChild(el);
    });

    $('#kds-active').textContent = activeCount;
    const avgSeconds = activeCount > 0 ? Math.floor(totalTime / activeCount) : 0;
    $('#kds-avg-time').textContent = Math.floor(avgSeconds / 60) + ':' + String(avgSeconds % 60).padStart(2, '0');
}

// Refresh KDS every 5 seconds
setInterval(() => {
    if (state.currentView === 'kitchen') populateKitchen();
}, 5000);

// KDS station filters
$$('.kds-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.kds-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Filter by station would filter kitchenOrders
        populateKitchen();
    });
});

// ==========================================
// Tickets List View
// ==========================================
function populateTicketsList() {
    const container = $('#tickets-list');
    container.innerHTML = '';

    if (state.allTickets.length === 0) {
        container.innerHTML = '<div class="empty-ticket"><p>No tickets yet</p></div>';
        return;
    }

    state.allTickets.forEach(ticket => {
        const el = document.createElement('div');
        el.className = 'ticket-card';

        const rate = CONFIG.cashDiscount.rate / 100;
        let cashPrice = ticket.total;
        let cardPrice = ticket.total;
        if (CONFIG.cashDiscount.enabled) {
            if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
                cashPrice = ticket.total * (1 - rate);
            } else {
                cardPrice = ticket.total * (1 + rate);
            }
        }

        el.innerHTML = `
            <div class="ticket-card-header">
                <span class="ticket-card-id">#${ticket.id}</span>
                <span class="ticket-card-status ${ticket.status}">${ticket.status}</span>
            </div>
            <div class="ticket-card-details">
                ${ticket.server} &bull; ${ticket.type} &bull; ${ticket.items.length} items
            </div>
            <div class="ticket-card-total">
                <span>Total</span>
                <span>${formatCurrency(ticket.total)}</span>
            </div>
            ${CONFIG.cashDiscount.enabled ? `
                <div class="ticket-card-dual">
                    <span class="cash-tag">Cash: ${formatCurrency(cashPrice)}</span>
                    <span class="card-tag">Card: ${formatCurrency(cardPrice)}</span>
                </div>
            ` : ''}
        `;

        container.appendChild(el);
    });
}

// Ticket filters
$$('.ticket-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.ticket-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        populateTicketsList();
    });
});

// ==========================================
// Split Check
// ==========================================
$('#btn-split').addEventListener('click', () => {
    if (state.ticket.items.length === 0) {
        showToast('No items to split', 'warning');
        return;
    }
    openSplitModal(2);
    $('#split-modal').classList.add('active');
});

$('#close-split').addEventListener('click', () => {
    $('#split-modal').classList.remove('active');
});

$('#split-cancel').addEventListener('click', () => {
    $('#split-modal').classList.remove('active');
});

$$('.split-way-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.split-way-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ways = btn.dataset.ways;
        if (ways === 'custom') {
            const custom = prompt('How many ways to split?', '5');
            if (custom && parseInt(custom) > 0) {
                openSplitModal(parseInt(custom));
            }
        } else {
            openSplitModal(parseInt(ways));
        }
    });
});

function openSplitModal(ways) {
    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * (CONFIG.taxRate / 100);
    const total = subtotal + tax;
    const perSplit = total / ways;
    const rate = CONFIG.cashDiscount.rate / 100;

    const preview = $('#split-preview');
    preview.innerHTML = '';

    for (let i = 0; i < ways; i++) {
        const amount = (i === ways - 1) ? total - (perSplit * (ways - 1)) : perSplit;
        let cashPrice = amount;
        let cardPrice = amount;

        if (CONFIG.cashDiscount.enabled) {
            if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
                cashPrice = amount * (1 - rate);
            } else {
                cardPrice = amount * (1 + rate);
            }
        }

        const card = document.createElement('div');
        card.className = 'split-card';
        card.innerHTML = `
            <span class="split-card-num">Guest ${i + 1}</span>
            <span class="split-card-amount">${formatCurrency(amount)}</span>
            ${CONFIG.cashDiscount.enabled ? `
                <div class="split-card-dual">
                    <span class="cash">${formatCurrency(cashPrice)}</span>
                    <span class="card">${formatCurrency(cardPrice)}</span>
                </div>
            ` : ''}
        `;
        preview.appendChild(card);
    }
}

$('#split-confirm').addEventListener('click', () => {
    showToast('Check split applied');
    $('#split-modal').classList.remove('active');
});

// ==========================================
// Discount / Promo System
// ==========================================
let appliedDiscount = null;
let appliedPromo = null;
let deliveryFee = 0;
let deliveryAddress = '';

function openDiscountModal() {
    const modal = document.getElementById('discount-modal');
    if (!modal) {
        createDiscountModal();
    }
    document.getElementById('discount-modal').classList.add('active');
    document.getElementById('promo-code-input').value = '';
    document.getElementById('promo-result').textContent = '';
    updateDiscountPreview();
}

function createDiscountModal() {
    const modal = document.createElement('div');
    modal.id = 'discount-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content discount-modal-content">
            <div class="modal-header">
                <h3>Discount / Promo</h3>
                <button class="modal-close" id="close-discount">&times;</button>
            </div>
            <div class="discount-body">
                <div class="discount-section">
                    <h4 class="discount-section-title">Quick Discounts</h4>
                    <div class="discount-quick-btns">
                        <button class="discount-quick-btn" data-type="percent" data-value="5">5%</button>
                        <button class="discount-quick-btn" data-type="percent" data-value="10">10%</button>
                        <button class="discount-quick-btn" data-type="percent" data-value="15">15%</button>
                        <button class="discount-quick-btn" data-type="percent" data-value="20">20%</button>
                        <button class="discount-quick-btn" data-type="fixed" data-value="5">$5 Off</button>
                        <button class="discount-quick-btn" data-type="fixed" data-value="10">$10 Off</button>
                    </div>
                </div>
                <div class="discount-section">
                    <h4 class="discount-section-title">Promo Code</h4>
                    <div class="promo-input-row">
                        <input type="text" id="promo-code-input" class="promo-code-input" placeholder="Enter promo code..." autocomplete="off">
                        <button class="btn-apply-promo" id="btn-apply-promo">Apply</button>
                    </div>
                    <p class="promo-result" id="promo-result"></p>
                </div>
                <div class="discount-section">
                    <h4 class="discount-section-title">Discount Reason</h4>
                    <div class="discount-reasons">
                        <button class="discount-reason-btn" data-reason="Manager Comp">Manager Comp</button>
                        <button class="discount-reason-btn" data-reason="Employee Meal">Employee Meal</button>
                        <button class="discount-reason-btn" data-reason="Customer Service">Service Recovery</button>
                        <button class="discount-reason-btn" data-reason="Happy Hour">Happy Hour</button>
                        <button class="discount-reason-btn" data-reason="Senior">Senior 10%</button>
                        <button class="discount-reason-btn" data-reason="Military">Military 15%</button>
                    </div>
                </div>
                <div class="discount-preview" id="discount-preview"></div>
            </div>
            <div class="discount-footer">
                <button class="btn-cancel" id="discount-cancel">Cancel</button>
                <button class="btn-remove-discount" id="btn-remove-discount" style="display:none">Remove Discount</button>
                <button class="btn-confirm" id="discount-confirm">Apply Discount</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Quick discount buttons
    modal.querySelectorAll('.discount-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.discount-quick-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appliedDiscount = {
                type: btn.dataset.type,
                value: parseFloat(btn.dataset.value),
                reason: 'Manual Discount'
            };
            updateDiscountPreview();
        });
    });

    // Reason buttons
    const reasonDiscounts = {
        'Manager Comp': { type: 'percent', value: 100 },
        'Employee Meal': { type: 'percent', value: 50 },
        'Customer Service': { type: 'percent', value: 25 },
        'Happy Hour': { type: 'percent', value: 25 },
        'Senior': { type: 'percent', value: 10 },
        'Military': { type: 'percent', value: 15 }
    };

    modal.querySelectorAll('.discount-reason-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.discount-reason-btn').forEach(b => b.classList.remove('active'));
            modal.querySelectorAll('.discount-quick-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const reason = btn.dataset.reason;
            const disc = reasonDiscounts[reason];
            appliedDiscount = { ...disc, reason };
            updateDiscountPreview();
        });
    });

    // Promo code
    document.getElementById('btn-apply-promo').addEventListener('click', () => {
        const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
        const promo = PROMO_CODES[code];
        const resultEl = document.getElementById('promo-result');

        if (!promo) {
            resultEl.textContent = 'Invalid promo code';
            resultEl.style.color = 'var(--danger)';
            return;
        }

        const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
        if (subtotal < promo.minAmount) {
            resultEl.textContent = 'Minimum order ' + formatCurrency(promo.minAmount) + ' required';
            resultEl.style.color = 'var(--warning)';
            return;
        }

        resultEl.textContent = promo.description;
        resultEl.style.color = 'var(--success)';
        appliedPromo = { ...promo, code };

        if (promo.type !== 'delivery') {
            appliedDiscount = {
                type: promo.type,
                value: promo.value,
                reason: 'Promo: ' + code
            };
        }
        updateDiscountPreview();
    });

    // Confirm
    document.getElementById('discount-confirm').addEventListener('click', () => {
        if (appliedDiscount) {
            applyDiscountToTicket();
            showToast('Discount applied: ' + appliedDiscount.reason);
        }
        document.getElementById('discount-modal').classList.remove('active');
    });

    document.getElementById('discount-cancel').addEventListener('click', () => {
        document.getElementById('discount-modal').classList.remove('active');
    });

    document.getElementById('close-discount').addEventListener('click', () => {
        document.getElementById('discount-modal').classList.remove('active');
    });

    document.getElementById('btn-remove-discount').addEventListener('click', () => {
        appliedDiscount = null;
        appliedPromo = null;
        state.ticket.discount = null;
        updateTicketDisplay();
        document.getElementById('discount-modal').classList.remove('active');
        showToast('Discount removed');
    });
}

function updateDiscountPreview() {
    const preview = document.getElementById('discount-preview');
    if (!preview) return;

    if (!appliedDiscount) {
        preview.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Select a discount option above</p>';
        document.getElementById('btn-remove-discount').style.display = state.ticket.discount ? 'inline-block' : 'none';
        return;
    }

    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    let discountAmount;

    if (appliedDiscount.type === 'percent') {
        discountAmount = subtotal * (appliedDiscount.value / 100);
    } else {
        discountAmount = Math.min(appliedDiscount.value, subtotal);
    }

    const afterDiscount = subtotal - discountAmount;
    const tax = afterDiscount * (CONFIG.taxRate / 100);
    const total = afterDiscount + tax;

    preview.innerHTML = `
        <div class="discount-preview-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
        <div class="discount-preview-row discount-highlight">
            <span>${appliedDiscount.reason} (${appliedDiscount.type === 'percent' ? appliedDiscount.value + '%' : formatCurrency(appliedDiscount.value)}):</span>
            <span>-${formatCurrency(discountAmount)}</span>
        </div>
        <div class="discount-preview-row"><span>After Discount:</span><span>${formatCurrency(afterDiscount)}</span></div>
        <div class="discount-preview-row"><span>Tax:</span><span>${formatCurrency(tax)}</span></div>
        <div class="discount-preview-row discount-total"><span>New Total:</span><span>${formatCurrency(total)}</span></div>
    `;
}

function applyDiscountToTicket() {
    if (!appliedDiscount) return;

    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    let discountAmount;
    if (appliedDiscount.type === 'percent') {
        discountAmount = subtotal * (appliedDiscount.value / 100);
    } else {
        discountAmount = Math.min(appliedDiscount.value, subtotal);
    }

    state.ticket.discount = {
        ...appliedDiscount,
        amount: Math.round(discountAmount * 100) / 100
    };

    updateTicketDisplay();
}

// ==========================================
// Delivery Order Support
// ==========================================
function calculateDeliveryFee(subtotal) {
    if (subtotal >= DELIVERY_CONFIG.freeDeliveryMin) return 0;
    if (appliedPromo && appliedPromo.type === 'delivery') return 0;
    return DELIVERY_CONFIG.baseFee;
}

// Enhance order type change to show delivery fields
$('#order-type-select').addEventListener('change', function() {
    state.ticket.type = this.value;
    $('#ticket-type').textContent = this.value.charAt(0).toUpperCase() + this.value.slice(1);

    if (this.value === 'delivery') {
        showDeliveryFields();
    } else {
        hideDeliveryFields();
        deliveryFee = 0;
        deliveryAddress = '';
    }

    updateTicketDisplay();
});

function showDeliveryFields() {
    let deliverySection = document.getElementById('delivery-section');
    if (deliverySection) {
        deliverySection.style.display = 'block';
        return;
    }

    deliverySection = document.createElement('div');
    deliverySection.id = 'delivery-section';
    deliverySection.className = 'delivery-section';
    deliverySection.innerHTML = `
        <div class="delivery-fields">
            <input type="text" id="delivery-name" class="delivery-input" placeholder="Customer name">
            <input type="tel" id="delivery-phone" class="delivery-input" placeholder="Phone number">
            <input type="text" id="delivery-address" class="delivery-input delivery-address" placeholder="Delivery address">
            <textarea id="delivery-notes" class="delivery-input delivery-notes" placeholder="Delivery instructions..." rows="2"></textarea>
        </div>
        <div class="delivery-fee-display">
            <span>Delivery Fee:</span>
            <span id="delivery-fee-amount">${formatCurrency(DELIVERY_CONFIG.baseFee)}</span>
            <span class="delivery-free-note" id="delivery-free-note">Free over ${formatCurrency(DELIVERY_CONFIG.freeDeliveryMin)}</span>
        </div>
    `;

    const ticketActions = document.querySelector('.ticket-actions');
    ticketActions.parentNode.insertBefore(deliverySection, ticketActions);

    document.getElementById('delivery-address').addEventListener('input', function() {
        deliveryAddress = this.value;
    });

    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    deliveryFee = calculateDeliveryFee(subtotal);
    document.getElementById('delivery-fee-amount').textContent = formatCurrency(deliveryFee);
}

function hideDeliveryFields() {
    const deliverySection = document.getElementById('delivery-section');
    if (deliverySection) {
        deliverySection.style.display = 'none';
    }
}

// ==========================================
// Reports
// ==========================================
function populateReports() {
    // Set date input to today
    const today = new Date().toISOString().split('T')[0];
    $('#report-date').value = today;

    // Calculate from local ticket data
    let totalSales = 0;
    let totalTax = 0;
    let totalTips = 0;
    let cashSales = 0;
    let cardSales = 0;
    let ticketCount = state.allTickets.length;

    state.allTickets.forEach(t => {
        totalSales += t.total;
        totalTax += t.tax;
        if (t.paymentMethod === 'cash') {
            cashSales += t.total;
        } else {
            cardSales += t.total;
        }
    });

    const avgTicket = ticketCount > 0 ? totalSales / ticketCount : 0;

    $('#report-total-sales').textContent = formatCurrency(totalSales);
    $('#report-ticket-count').textContent = ticketCount;
    $('#report-avg-ticket').textContent = formatCurrency(avgTicket);
    $('#report-cash-sales').textContent = formatCurrency(cashSales);
    $('#report-card-sales').textContent = formatCurrency(cardSales);
    $('#report-tax').textContent = formatCurrency(totalTax);
    $('#report-discounts').textContent = formatCurrency(0);
    $('#report-tips').textContent = formatCurrency(totalTips);
}

$('#btn-refresh-report').addEventListener('click', () => {
    populateReports();
    showToast('Report refreshed');
});

$('#btn-settle-batch').addEventListener('click', () => {
    settleBatch();
});

// Override print report to use thermal formatter (added later in file)
$('#btn-print-report').addEventListener('click', () => {
    if (typeof printThermalReport === 'function') {
        printThermalReport();
    } else {
        window.print();
    }
});

$('#btn-eod').addEventListener('click', () => {
    if (typeof openEOD === 'function') {
        openEOD();
    } else {
        if (confirm('Close the day?')) {
            state.allTickets.forEach(t => { t.status = 'closed'; });
            populateReports();
            showToast('Day closed.');
        }
    }
});

// ==========================================
// PaybotX Batch Settlement
// ==========================================
function settleBatch() {
    const batchState = {
        step: 'initializing',
        batchNum: 'B-' + Date.now().toString(36).toUpperCase(),
        startTime: new Date(),
        transactions: [],
        totalAmount: 0,
        totalCount: 0
    };

    // Gather all unsettled card transactions
    state.allTickets.forEach(t => {
        if (t.paid && t.paymentMethod !== 'cash' && t.paymentMethod !== 'gift' && t.status !== 'voided') {
            if (!t.batchSettled) {
                batchState.transactions.push({
                    ticketId: t.id,
                    amount: t.total + (t.tip || 0),
                    method: t.paymentMethod,
                    tip: t.tip || 0
                });
                batchState.totalAmount += t.total + (t.tip || 0);
                batchState.totalCount++;
            }
        }
    });

    if (batchState.totalCount === 0) {
        showToast('No unsettled card transactions', 'warning');
        return;
    }

    showToast(`Settling batch ${batchState.batchNum}: ${batchState.totalCount} txns, ${formatCurrency(batchState.totalAmount)}...`, 'warning');

    // Simulate PaybotX batch settlement process
    setTimeout(() => {
        batchState.step = 'sending';
        showToast('Sending to PaybotX terminal...', 'warning');
    }, 800);

    setTimeout(() => {
        batchState.step = 'processing';
        showToast('Terminal processing batch...', 'warning');
    }, 2000);

    setTimeout(() => {
        // Mark all transactions as settled
        state.allTickets.forEach(t => {
            if (t.paid && t.paymentMethod !== 'cash' && t.paymentMethod !== 'gift' && !t.batchSettled) {
                t.batchSettled = true;
                t.batchNumber = batchState.batchNum;
                t.settledAt = new Date().toISOString();
            }
        });

        batchState.step = 'complete';
        showToast(`Batch ${batchState.batchNum} settled: ${batchState.totalCount} transactions, ${formatCurrency(batchState.totalAmount)}`);

        // Print batch report
        printBatchReport(batchState);
        saveState();
    }, 3500);
}

function printBatchReport(batch) {
    const now = new Date();
    const dashes = '-'.repeat(32);

    const report = `
<div style="font-family:'Courier New',monospace;width:280px;padding:8px;font-size:12px;color:#000;background:#fff;">
    <div style="text-align:center;font-weight:bold;font-size:14px;">BATCH SETTLEMENT REPORT</div>
    <div style="text-align:center;font-size:11px;">PaybotX Terminal - ${CONFIG.terminal.model}</div>
    <div style="text-align:center;font-size:11px;">${now.toLocaleDateString()} ${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
    <pre style="margin:8px 0;font-size:11px;">
${dashes}
Batch #:           ${batch.batchNum}
${dashes}
Transactions:      ${String(batch.totalCount).padStart(10)}
Total Amount:      ${formatCurrency(batch.totalAmount).padStart(10)}
${dashes}
${batch.transactions.map(t =>
    `#${t.ticketId} ${t.method.padEnd(8)} ${formatCurrency(t.amount).padStart(10)}${t.tip ? ' (tip:'+formatCurrency(t.tip)+')' : ''}`
).join('\n')}
${dashes}
Status: APPROVED
${dashes}
    </pre>
    <div style="text-align:center;font-size:10px;color:#666;">--- End of Batch Report ---</div>
</div>`;

    const pw = window.open('', 'batch-report', 'width=320,height=500');
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><title>Batch Report</title>
        <style>@page{size:80mm auto;margin:0;}body{margin:0;padding:4px;}</style>
        </head><body>${report}
        <div style="text-align:center;margin-top:12px;">
            <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;">Print</button>
            <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer;margin-left:8px;">Close</button>
        </div></body></html>`);
    pw.document.close();
}

// ==========================================
// View Navigation (updated for reports)
// ==========================================
// Override the existing view handler to include reports
$$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        $$('.main-view').forEach(v => v.classList.remove('active'));

        const viewMap = {
            'order': 'order-view',
            'tables': 'tables-view',
            'kitchen': 'kitchen-view',
            'tickets': 'tickets-view',
            'reports': 'reports-view'
        };

        const viewId = viewMap[view] || (view + '-view');
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.classList.add('active');

        state.currentView = view;
        if (view === 'kitchen') populateKitchen();
        if (view === 'tickets') populateTicketsList();
        if (view === 'reports') populateReports();
    });
});

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

// Hook into ticket updates to broadcast to customer display
const _origUpdateTicketDisplay = updateTicketDisplay;
updateTicketDisplay = function() {
    _origUpdateTicketDisplay();
    broadcastToCustomerDisplay('order-update', {
        items: state.ticket.items.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        orderType: state.ticket.type
    });
};

// ==========================================
// Tip Management (Payment Modal Enhancement)
// ==========================================
const TIP_PRESETS = [15, 18, 20, 25];
let selectedTipPercent = 0;
let selectedTipAmount = 0;

function createTipSection() {
    const paymentSummary = document.querySelector('.payment-summary-panel');
    if (!paymentSummary || document.getElementById('tip-section')) return;

    const tipSection = document.createElement('div');
    tipSection.id = 'tip-section';
    tipSection.className = 'tip-section';
    tipSection.innerHTML = `
        <h4 class="tip-header">Add Gratuity</h4>
        <div class="tip-presets" id="tip-presets">
            ${TIP_PRESETS.map(pct => `
                <button class="tip-preset-btn" data-percent="${pct}">
                    <span class="tip-pct">${pct}%</span>
                    <span class="tip-val" id="tip-val-${pct}">$0.00</span>
                </button>
            `).join('')}
        </div>
        <div class="tip-custom">
            <button class="tip-preset-btn" id="tip-custom-btn">Custom</button>
            <button class="tip-preset-btn tip-none" id="tip-none-btn">No Tip</button>
        </div>
        <div class="tip-total-row" id="tip-total-row" style="display:none">
            <span>Tip:</span>
            <span id="tip-display-amount">$0.00</span>
        </div>
    `;

    paymentSummary.appendChild(tipSection);

    // Event listeners for tip buttons
    tipSection.querySelectorAll('.tip-preset-btn[data-percent]').forEach(btn => {
        btn.addEventListener('click', () => {
            tipSection.querySelectorAll('.tip-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTipPercent = parseInt(btn.dataset.percent);
            const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
            selectedTipAmount = Math.round(subtotal * (selectedTipPercent / 100) * 100) / 100;
            updateTipDisplay();
        });
    });

    document.getElementById('tip-none-btn').addEventListener('click', () => {
        tipSection.querySelectorAll('.tip-preset-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tip-none-btn').classList.add('active');
        selectedTipPercent = 0;
        selectedTipAmount = 0;
        updateTipDisplay();
    });

    document.getElementById('tip-custom-btn').addEventListener('click', () => {
        const customTip = prompt('Enter tip amount:', '0.00');
        if (customTip !== null) {
            const amt = parseFloat(customTip);
            if (!isNaN(amt) && amt >= 0) {
                tipSection.querySelectorAll('.tip-preset-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('tip-custom-btn').classList.add('active');
                selectedTipPercent = 0;
                selectedTipAmount = Math.round(amt * 100) / 100;
                updateTipDisplay();
            }
        }
    });
}

function updateTipDisplay() {
    const tipRow = document.getElementById('tip-total-row');
    const tipAmount = document.getElementById('tip-display-amount');
    if (!tipRow || !tipAmount) return;

    if (selectedTipAmount > 0) {
        tipRow.style.display = 'flex';
        tipAmount.textContent = formatCurrency(selectedTipAmount);
    } else {
        tipRow.style.display = 'none';
    }

    // Update tip preset values
    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    TIP_PRESETS.forEach(pct => {
        const el = document.getElementById('tip-val-' + pct);
        if (el) el.textContent = formatCurrency(subtotal * pct / 100);
    });
}

// Override openPayment to add tip section
const _origOpenPayment = openPayment;
openPayment = function(method) {
    selectedTipPercent = 0;
    selectedTipAmount = 0;
    _origOpenPayment(method);
    setTimeout(() => {
        createTipSection();
        updateTipDisplay();
    }, 50);
    broadcastToCustomerDisplay('payment-start', {});
};

// Override completePayment to include tip and broadcast
const _origCompletePayment = completePayment;
completePayment = function(total, method) {
    // Track tip in ticket data
    const ticketIndex = state.allTickets.findIndex(t => t.id === state.ticket.id);
    if (ticketIndex >= 0) {
        state.allTickets[ticketIndex].tip = selectedTipAmount;
    }

    _origCompletePayment(total, method);
    broadcastToCustomerDisplay('payment-complete', {});
};

// ==========================================
// Enhanced KDS with Station Filtering
// ==========================================
let activeStation = 'all';

const _origPopulateKitchen = populateKitchen;
populateKitchen = function() {
    const container = $('#kds-tickets');
    container.innerHTML = '';

    let activeCount = 0;
    let totalTime = 0;

    const filteredOrders = activeStation === 'all'
        ? state.kitchenOrders
        : state.kitchenOrders.filter(order =>
            order.items.some(item => item.station === activeStation)
        );

    filteredOrders.forEach(order => {
        const elapsed = Math.floor((new Date() - order.time) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = minutes + ':' + String(seconds).padStart(2, '0');

        let timeClass = 'green';
        if (minutes >= 10) timeClass = 'red';
        else if (minutes >= 5) timeClass = 'yellow';

        const isUrgent = minutes >= 10;
        activeCount++;
        totalTime += elapsed;

        // Filter items by station if a station is selected
        const displayItems = activeStation === 'all'
            ? order.items
            : order.items.filter(item => item.station === activeStation);

        const el = document.createElement('div');
        el.className = 'kds-ticket' + (isUrgent ? ' urgent' : '');
        el.innerHTML = `
            <div class="kds-ticket-header">
                <span>#${order.id} - ${order.type}</span>
                <span class="kds-ticket-time ${timeClass}">${timeStr}</span>
            </div>
            <div class="kds-ticket-server">Server: ${order.server || 'Unknown'}</div>
            <div class="kds-ticket-items">
                ${displayItems.map(item => `
                    <div class="kds-item ${item.done ? 'done' : ''}">
                        <span class="kds-item-name">${item.name}</span>
                        <span class="kds-item-qty">x${item.qty}</span>
                    </div>
                `).join('')}
            </div>
            <div class="kds-ticket-footer">
                <button class="kds-bump-btn" data-order-id="${order.id}">BUMP</button>
            </div>
        `;

        el.querySelector('.kds-bump-btn').addEventListener('click', () => {
            state.kitchenOrders = state.kitchenOrders.filter(o => o.id !== order.id);
            showToast('Order #' + order.id + ' bumped');
            populateKitchen();
        });

        container.appendChild(el);
    });

    $('#kds-active').textContent = activeCount;
    const avgSeconds = activeCount > 0 ? Math.floor(totalTime / activeCount) : 0;
    $('#kds-avg-time').textContent = Math.floor(avgSeconds / 60) + ':' + String(avgSeconds % 60).padStart(2, '0');
};

// Station filter with actual filtering
$$('.kds-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.kds-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStation = btn.dataset.station;
        populateKitchen();
    });
});

// ==========================================
// Enhanced Ticket Filters with Search
// ==========================================
let activeTicketFilter = 'open';
let ticketSearchQuery = '';

// Ticket search input
const ticketSearchEl = document.getElementById('ticket-search');
if (ticketSearchEl) {
    ticketSearchEl.addEventListener('input', (e) => {
        ticketSearchQuery = e.target.value.trim().toLowerCase();
        populateTicketsList();
    });
}

const _origPopulateTicketsList = populateTicketsList;
populateTicketsList = function() {
    const container = $('#tickets-list');
    container.innerHTML = '';

    let filtered = state.allTickets;
    if (activeTicketFilter === 'open') {
        filtered = state.allTickets.filter(t => t.status === 'open');
    } else if (activeTicketFilter === 'paid') {
        filtered = state.allTickets.filter(t => t.status === 'paid');
    } else if (activeTicketFilter === 'closed') {
        filtered = state.allTickets.filter(t => t.status === 'closed');
    } else if (activeTicketFilter === 'voided') {
        filtered = state.allTickets.filter(t => t.status === 'voided');
    }

    // Apply search filter
    if (ticketSearchQuery) {
        filtered = filtered.filter(t => {
            const idMatch = String(t.id).includes(ticketSearchQuery);
            const serverMatch = (t.server || '').toLowerCase().includes(ticketSearchQuery);
            const typeMatch = (t.type || '').toLowerCase().includes(ticketSearchQuery);
            const itemMatch = t.items.some(i => i.name.toLowerCase().includes(ticketSearchQuery));
            return idMatch || serverMatch || typeMatch || itemMatch;
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-ticket"><p>No tickets found</p></div>';
        return;
    }

    filtered.forEach(ticket => {
        const el = document.createElement('div');
        el.className = 'ticket-card';

        const rate = CONFIG.cashDiscount.rate / 100;
        let cashPrice = ticket.total;
        let cardPrice = ticket.total;
        if (CONFIG.cashDiscount.enabled) {
            if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
                cashPrice = ticket.total * (1 - rate);
            } else {
                cardPrice = ticket.total * (1 + rate);
            }
        }

        const timeStr = ticket.time ? new Date(ticket.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

        const itemsSummary = ticket.items.slice(0, 3).map(i =>
            (i.qty > 1 ? i.qty + 'x ' : '') + i.name
        ).join(', ') + (ticket.items.length > 3 ? ' +' + (ticket.items.length - 3) + ' more' : '');

        el.innerHTML = `
            <div class="ticket-card-header">
                <span class="ticket-card-id">#${ticket.id}</span>
                <span class="ticket-card-status ${ticket.status}">${ticket.status}</span>
            </div>
            <div class="ticket-card-details">
                ${ticket.server} &bull; ${ticket.type} &bull; ${ticket.items.length} items &bull; ${timeStr}
            </div>
            <div class="ticket-card-items-preview">${itemsSummary}</div>
            ${ticket.discount ? `
                <div class="ticket-card-discount">
                    <span>${ticket.discount.reason}</span>
                    <span>-${formatCurrency(ticket.discount.amount)}</span>
                </div>
            ` : ''}
            <div class="ticket-card-total">
                <span>Total</span>
                <span>${formatCurrency(ticket.total)}</span>
            </div>
            ${ticket.tip ? `
                <div class="ticket-card-tip">
                    <span>Tip</span>
                    <span>${formatCurrency(ticket.tip)}</span>
                </div>
            ` : ''}
            ${ticket.paymentMethod ? `
                <div class="ticket-card-payment-method">
                    Paid: ${ticket.paymentMethod.toUpperCase()}${ticket.paidAt ? ' at ' + new Date(ticket.paidAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
            ` : ''}
            ${CONFIG.cashDiscount.enabled ? `
                <div class="ticket-card-dual">
                    <span class="cash-tag">Cash: ${formatCurrency(cashPrice)}</span>
                    <span class="card-tag">Card: ${formatCurrency(cardPrice)}</span>
                </div>
            ` : ''}
            <div class="ticket-card-actions">
                ${ticket.status === 'open' ? `
                    <button class="ticket-action-btn pay" onclick="openTicketPayment(${ticket.id})">Pay</button>
                ` : ''}
                ${ticket.status === 'open' ? `
                    <button class="ticket-action-btn void" onclick="voidTicket(${ticket.id})">Void</button>
                ` : ''}
                ${ticket.status === 'paid' ? `
                    <button class="ticket-action-btn void" onclick="refundTicket(${ticket.id})">Refund</button>
                ` : ''}
                <button class="ticket-action-btn reprint" onclick="reprintTicket(${ticket.id})">Reprint</button>
                <button class="ticket-action-btn recall" onclick="recallTicket(${ticket.id})">Recall</button>
            </div>
        `;

        container.appendChild(el);
    });
};

$$('.ticket-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.ticket-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTicketFilter = btn.dataset.filter;
        populateTicketsList();
    });
});

function openTicketPayment(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    // Load ticket into current state for payment
    state.ticket = {
        id: ticket.id,
        type: ticket.type,
        items: [...ticket.items],
        table: null
    };
    updateTicketDisplay();
    openPayment('cash');
}
window.openTicketPayment = openTicketPayment;

function voidTicket(ticketId) {
    if (!confirm('Void ticket #' + ticketId + '?')) return;
    const idx = state.allTickets.findIndex(t => t.id === ticketId);
    if (idx >= 0) {
        state.allTickets[idx].status = 'voided';
        showToast('Ticket #' + ticketId + ' voided');
        populateTicketsList();
    }
}
window.voidTicket = voidTicket;

// ==========================================
// Refund Processing System
// ==========================================
function refundTicket(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket) {
        showToast('Ticket not found', 'error');
        return;
    }

    // Check permissions
    const perms = ROLE_PERMISSIONS[state.currentRole] || {};
    if (!perms.refund) {
        showToast('Manager authorization required for refunds', 'error');
        return;
    }

    if (ticket.status !== 'paid') {
        showToast('Can only refund paid tickets', 'warning');
        return;
    }

    openRefundModal(ticket);
}
window.refundTicket = refundTicket;

function openRefundModal(ticket) {
    let modal = document.getElementById('refund-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'refund-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: min(440px, 95vw);">
                <div class="modal-header">
                    <h3 id="refund-title">Process Refund</h3>
                    <button class="modal-close" id="close-refund">&times;</button>
                </div>
                <div id="refund-body" style="padding: 16px;"></div>
                <div style="padding: 12px 16px; display: flex; gap: 8px; border-top: 1px solid var(--border-light);">
                    <button class="btn-cancel" id="refund-cancel" style="flex:1">Cancel</button>
                    <button class="btn-confirm" id="refund-confirm" style="flex:1; background: var(--danger);">Process Refund</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('close-refund').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('refund-cancel').addEventListener('click', () => modal.classList.remove('active'));
    }

    const refundBody = document.getElementById('refund-body');
    refundBody.innerHTML = `
        <div style="margin-bottom: 12px;">
            <p style="font-weight: 600; margin-bottom: 4px;">Ticket #${ticket.id}</p>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">
                ${ticket.server} &bull; ${ticket.type} &bull; Paid: ${ticket.paymentMethod}
            </p>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Refund Type</label>
            <div style="display: flex; gap: 8px;">
                <button class="refund-type-btn active" data-type="full" style="flex:1; padding: 10px; border-radius: 8px; border: 2px solid var(--danger); background: var(--danger-bg); color: var(--danger); font-weight: 600; cursor: pointer;">Full Refund<br><small>${formatCurrency(ticket.total)}</small></button>
                <button class="refund-type-btn" data-type="partial" style="flex:1; padding: 10px; border-radius: 8px; border: 2px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-weight: 600; cursor: pointer;">Partial Refund</button>
            </div>
        </div>
        <div id="partial-refund-section" style="display: none; margin-bottom: 12px;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Refund Amount</label>
            <input type="number" id="refund-amount-input" step="0.01" min="0.01" max="${ticket.total.toFixed(2)}" value="${ticket.total.toFixed(2)}" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 1rem;">
        </div>
        <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Reason</label>
            <select id="refund-reason" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 0.9rem;">
                <option value="Customer complaint">Customer Complaint</option>
                <option value="Wrong order">Wrong Order</option>
                <option value="Food quality">Food Quality Issue</option>
                <option value="Overcharge">Overcharge</option>
                <option value="Duplicate charge">Duplicate Charge</option>
                <option value="Other">Other</option>
            </select>
        </div>
    `;

    // Toggle full/partial
    refundBody.querySelectorAll('.refund-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            refundBody.querySelectorAll('.refund-type-btn').forEach(b => {
                b.style.borderColor = 'var(--border-color)';
                b.style.background = 'var(--bg-primary)';
                b.style.color = 'var(--text-primary)';
                b.classList.remove('active');
            });
            btn.style.borderColor = 'var(--danger)';
            btn.style.background = 'var(--danger-bg)';
            btn.style.color = 'var(--danger)';
            btn.classList.add('active');

            const partial = document.getElementById('partial-refund-section');
            if (btn.dataset.type === 'partial') {
                partial.style.display = 'block';
            } else {
                partial.style.display = 'none';
            }
        });
    });

    // Confirm handler - rebind each time
    const confirmBtn = document.getElementById('refund-confirm');
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

    newConfirm.addEventListener('click', () => {
        const isPartial = refundBody.querySelector('.refund-type-btn.active')?.dataset.type === 'partial';
        let refundAmount = ticket.total;
        if (isPartial) {
            refundAmount = parseFloat(document.getElementById('refund-amount-input').value);
            if (isNaN(refundAmount) || refundAmount <= 0 || refundAmount > ticket.total) {
                showToast('Invalid refund amount', 'error');
                return;
            }
        }

        const reason = document.getElementById('refund-reason').value;

        // Record refund
        refundHistory.push({
            ticketId: ticket.id,
            amount: refundAmount,
            reason: reason,
            method: ticket.paymentMethod,
            processedBy: state.currentUser,
            time: new Date().toISOString(),
            type: isPartial ? 'partial' : 'full'
        });

        // Update ticket status
        if (!isPartial) {
            ticket.status = 'refunded';
        } else {
            ticket.refundedAmount = (ticket.refundedAmount || 0) + refundAmount;
        }

        modal.classList.remove('active');
        showToast('Refund of ' + formatCurrency(refundAmount) + ' processed for ticket #' + ticket.id);
        populateTicketsList();
    });

    modal.classList.add('active');
}

// Add refund button to paid ticket cards
const _origTicketsForRefund = populateTicketsList;

function reprintTicket(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket) {
        showToast('Ticket not found', 'error');
        return;
    }
    printReceipt(ticket);
}
window.reprintTicket = reprintTicket;

function recallTicket(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket) {
        showToast('Ticket not found', 'error');
        return;
    }

    // Load this ticket's items into current working ticket
    state.ticket = {
        id: ticket.id,
        type: ticket.type,
        items: ticket.items.map(i => ({ ...i })),
        table: ticket.table || null,
        server: ticket.server,
        discount: ticket.discount || null
    };

    // Restore discount state
    if (ticket.discount) {
        appliedDiscount = { ...ticket.discount };
    }

    updateTicketDisplay();

    // Switch to order view
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.main-view').forEach(v => v.classList.remove('active'));
    const orderTab = document.querySelector('[data-view="order"]');
    if (orderTab) orderTab.classList.add('active');
    const orderView = document.getElementById('order-view');
    if (orderView) orderView.classList.add('active');
    state.currentView = 'order';

    showToast('Ticket #' + ticketId + ' recalled');
}
window.recallTicket = recallTicket;

// ==========================================
// Receipt Printing System
// ==========================================
function printReceipt(ticket) {
    const receiptWindow = window.open('', 'receipt', 'width=320,height=600');
    if (!receiptWindow) {
        showToast('Pop-up blocked - please allow pop-ups for receipt printing', 'error');
        return;
    }

    const rate = CONFIG.cashDiscount.rate / 100;
    const subtotal = ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const discountAmt = ticket.discount ? ticket.discount.amount : 0;
    const afterDiscount = subtotal - discountAmt;
    const tax = afterDiscount * (CONFIG.taxRate / 100);
    const total = afterDiscount + tax + (ticket.deliveryFee || 0);
    let cashTotal = total;
    let cardTotal = total;

    if (CONFIG.cashDiscount.enabled) {
        if (CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
            cashTotal = total * (1 - rate);
        } else {
            cardTotal = total * (1 + rate);
        }
    }

    const tipAmount = ticket.tip || 0;
    const grandTotal = total + tipAmount;
    const now = ticket.time ? new Date(ticket.time) : new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const receiptHtml = `<!DOCTYPE html>
<html><head><title>Receipt</title>
<style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: 'Courier New', monospace;
        width: 280px; max-width: 280px;
        padding: 8px; font-size: 12px; line-height: 1.4;
        color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 8px 0; }
    .header { text-align: center; margin-bottom: 8px; }
    .header h1 { font-size: 16px; margin-bottom: 2px; }
    .header p { font-size: 10px; color: #333; }
    .row { display: flex; justify-content: space-between; }
    .item-row { margin: 2px 0; }
    .item-name { max-width: 180px; }
    .item-mods { font-size: 10px; color: #666; padding-left: 12px; }
    .total-row { font-weight: bold; font-size: 14px; }
    .dual-prices { margin: 6px 0; padding: 6px; border: 1px solid #333; border-radius: 4px; }
    .dual-prices .row { font-weight: bold; }
    .cash-line { color: #000; }
    .footer { text-align: center; font-size: 10px; margin-top: 10px; color: #555; }
    .barcode { text-align: center; font-size: 24px; letter-spacing: 4px; margin: 6px 0; }
    .savings { text-align: center; font-weight: bold; padding: 4px; border: 1px dashed #000; margin: 4px 0; font-size: 11px; }
    @media print {
        body { width: 80mm; }
        .no-print { display: none; }
    }
</style>
</head><body>
    <div class="header">
        <h1>Restaurant POS</h1>
        <p>123 Main Street</p>
        <p>City, ST 12345</p>
        <p>(555) 123-4567</p>
    </div>

    <div class="divider"></div>

    <div class="row"><span>Ticket #${ticket.id}</span><span>${ticket.type}</span></div>
    <div class="row"><span>${dateStr} ${timeStr}</span></div>
    <div class="row"><span>Server: ${ticket.server || state.currentUser || 'N/A'}</span></div>
    ${ticket.table ? `<div class="row"><span>Table: ${ticket.table}</span></div>` : ''}

    <div class="double-divider"></div>

    ${ticket.items.map(item => `
        <div class="item-row">
            <div class="row">
                <span class="item-name">${item.qty > 1 ? item.qty + 'x ' : ''}${item.name}</span>
                <span>${formatCurrency(item.price * item.qty)}</span>
            </div>
            ${item.mods && item.mods.length ? '<div class="item-mods">' + item.mods.join(', ') + '</div>' : ''}
        </div>
    `).join('')}

    <div class="double-divider"></div>

    <div class="row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
    ${discountAmt > 0 ? `<div class="row" style="color:#28a745"><span>${ticket.discount.reason}</span><span>-${formatCurrency(discountAmt)}</span></div>` : ''}
    <div class="row"><span>Tax (${CONFIG.taxRate}%)</span><span>${formatCurrency(tax)}</span></div>
    ${ticket.deliveryFee > 0 ? `<div class="row"><span>Delivery Fee</span><span>${formatCurrency(ticket.deliveryFee)}</span></div>` : ''}

    <div class="divider"></div>

    <div class="row total-row"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>

    ${CONFIG.cashDiscount.enabled ? `
        <div class="dual-prices">
            <div class="row cash-line"><span>Cash Price:</span><span>${formatCurrency(cashTotal)}</span></div>
            <div class="row"><span>Card Price:</span><span>${formatCurrency(cardTotal)}</span></div>
        </div>
        <div class="savings">Pay with cash and save ${formatCurrency(cardTotal - cashTotal)}!</div>
    ` : ''}

    ${tipAmount > 0 ? `
        <div class="divider"></div>
        <div class="row"><span>Tip</span><span>${formatCurrency(tipAmount)}</span></div>
        <div class="row bold"><span>Grand Total</span><span>${formatCurrency(grandTotal)}</span></div>
    ` : ''}

    ${ticket.paymentMethod ? `
        <div class="divider"></div>
        <div class="row"><span>Paid by: ${ticket.paymentMethod.toUpperCase()}</span></div>
    ` : `
        <div class="divider"></div>
        <div class="row"><span>Tip: ___________</span></div>
        <div class="row"><span>Total: ___________</span></div>
        <div style="margin-top:20px"><span>Signature: _______________</span></div>
    `}

    <div class="divider"></div>
    <div class="barcode">||||| ${ticket.id} |||||</div>

    <div class="footer">
        <p>Thank you! Pay with cash and save!</p>
        <p style="margin-top:4px">We offer a ${CONFIG.cashDiscount.rate}% discount for cash payments.</p>
        <p>All prices include a non-cash adjustment.</p>
    </div>

    <div class="no-print" style="text-align:center; margin-top:16px;">
        <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">Print Receipt</button>
        <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-left:8px;">Close</button>
    </div>
</body></html>`;

    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
    showToast('Receipt ready for printing');
}

// ==========================================
// Enhanced Reports System
// ==========================================
let activeReportTab = 'summary';
const refundHistory = [];

// Report tab switching
$$('.report-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.report-tab').forEach(b => b.classList.remove('active'));
        $$('.report-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        activeReportTab = btn.dataset.report;

        const panelMap = {
            'summary': 'report-summary',
            'hourly': 'report-hourly',
            'items': 'report-items',
            'labor': 'report-labor',
            'refunds': 'report-refunds-panel'
        };
        const panel = document.getElementById(panelMap[activeReportTab]);
        if (panel) panel.classList.add('active');

        populateReports();
    });
});

const _origPopulateReports = populateReports;
populateReports = function() {
    const today = new Date().toISOString().split('T')[0];
    $('#report-date').value = today;

    let totalSales = 0;
    let totalTax = 0;
    let totalTips = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let cashSales = 0;
    let cardSales = 0;
    let ticketCount = state.allTickets.length;
    const rate = CONFIG.cashDiscount.rate / 100;

    state.allTickets.forEach(t => {
        if (t.status === 'voided' || t.status === 'refunded') return;
        totalSales += t.total;
        totalTax += t.tax;
        if (t.tip) totalTips += t.tip;
        if (t.discount) totalDiscounts += t.discount.amount || 0;
        if (t.paymentMethod === 'cash') {
            cashSales += t.total;
        } else if (t.paymentMethod) {
            cardSales += t.total;
        }
    });

    refundHistory.forEach(r => { totalRefunds += r.amount; });

    const avgTicket = ticketCount > 0 ? totalSales / ticketCount : 0;
    const netSales = totalSales - totalRefunds;

    $('#report-total-sales').textContent = formatCurrency(totalSales);
    $('#report-ticket-count').textContent = ticketCount;
    $('#report-avg-ticket').textContent = formatCurrency(avgTicket);
    $('#report-cash-sales').textContent = formatCurrency(cashSales);
    $('#report-card-sales').textContent = formatCurrency(cardSales);
    $('#report-tax').textContent = formatCurrency(totalTax);
    $('#report-discounts').textContent = formatCurrency(Math.abs(totalDiscounts));
    $('#report-tips').textContent = formatCurrency(totalTips);

    const refundsEl = document.getElementById('report-refunds');
    if (refundsEl) refundsEl.textContent = formatCurrency(totalRefunds);
    const netEl = document.getElementById('report-net-sales');
    if (netEl) netEl.textContent = formatCurrency(netSales);

    // Populate sub-reports
    if (activeReportTab === 'hourly') populateHourlyReport();
    if (activeReportTab === 'items') populateItemMixReport();
    if (activeReportTab === 'labor') populateLaborReport();
    if (activeReportTab === 'refunds') populateRefundsReport();
};

// Hourly breakdown chart
function populateHourlyReport() {
    const chart = document.getElementById('hourly-chart');
    if (!chart) return;

    const hourlyData = {};
    for (let h = 6; h <= 23; h++) {
        hourlyData[h] = { sales: 0, tickets: 0 };
    }

    state.allTickets.forEach(t => {
        if (!t.time || t.status === 'voided') return;
        const hour = new Date(t.time).getHours();
        if (hourlyData[hour]) {
            hourlyData[hour].sales += t.total;
            hourlyData[hour].tickets++;
        }
    });

    const maxSales = Math.max(...Object.values(hourlyData).map(h => h.sales), 1);

    chart.innerHTML = `
        <div class="hourly-chart-header">
            <span>Hourly Sales Breakdown</span>
        </div>
        <div class="hourly-bars">
            ${Object.entries(hourlyData).map(([hour, data]) => {
                const pct = (data.sales / maxSales) * 100;
                const label = parseInt(hour) > 12 ? (parseInt(hour) - 12) + 'p' : (parseInt(hour) === 12 ? '12p' : hour + 'a');
                return `
                    <div class="hourly-bar-col">
                        <div class="hourly-bar-wrapper">
                            <div class="hourly-bar" style="height: ${Math.max(pct, 2)}%">
                                ${data.sales > 0 ? '<span class="hourly-bar-value">' + formatCurrency(data.sales) + '</span>' : ''}
                            </div>
                        </div>
                        <span class="hourly-bar-label">${label}</span>
                        <span class="hourly-bar-count">${data.tickets}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Item mix report
function populateItemMixReport() {
    const tbody = document.getElementById('item-mix-body');
    if (!tbody) return;

    const itemMap = {};
    state.allTickets.forEach(t => {
        if (t.status === 'voided') return;
        t.items.forEach(item => {
            const key = item.name;
            if (!itemMap[key]) {
                itemMap[key] = { name: item.name, qty: 0, revenue: 0 };
            }
            itemMap[key].qty += item.qty;
            itemMap[key].revenue += item.price * item.qty;
        });
    });

    const sorted = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
    const totalRev = sorted.reduce((s, i) => s + i.revenue, 0);

    tbody.innerHTML = sorted.length === 0
        ? '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 20px;">No items sold yet</td></tr>'
        : sorted.map(item => `
            <tr>
                <td>${item.name}</td>
                <td style="text-align:right">${item.qty}</td>
                <td style="text-align:right">${formatCurrency(item.revenue)}</td>
                <td style="text-align:right">
                    <div class="item-mix-bar-container">
                        <div class="item-mix-bar" style="width: ${totalRev > 0 ? (item.revenue / totalRev * 100) : 0}%"></div>
                        <span>${totalRev > 0 ? (item.revenue / totalRev * 100).toFixed(1) : '0.0'}%</span>
                    </div>
                </td>
            </tr>
        `).join('');
}

// Labor report
function populateLaborReport() {
    const tbody = document.getElementById('labor-body');
    if (!tbody) return;

    const laborData = {};

    // Collect time clock data
    timeClock.forEach(record => {
        if (!laborData[record.empId]) {
            laborData[record.empId] = {
                name: record.empName,
                role: record.role,
                hours: 0,
                sales: 0,
                tips: 0
            };
        }
        if (record.clockOut) {
            laborData[record.empId].hours += (record.clockOut - record.clockIn) / 3600000;
        } else {
            // Still clocked in
            laborData[record.empId].hours += (new Date() - record.clockIn) / 3600000;
        }
    });

    // Collect sales/tips per server
    state.allTickets.forEach(t => {
        if (t.status === 'voided') return;
        const serverName = t.server;
        // Find matching labor entry
        const entry = Object.values(laborData).find(l => l.name === serverName);
        if (entry) {
            entry.sales += t.total;
            if (t.tip) entry.tips += t.tip;
        } else {
            // Server not clocked in but has sales
            const key = 'unk_' + serverName;
            if (!laborData[key]) {
                laborData[key] = { name: serverName || 'Unknown', role: 'N/A', hours: 0, sales: 0, tips: 0 };
            }
            laborData[key].sales += t.total;
            if (t.tip) laborData[key].tips += t.tip;
        }
    });

    const entries = Object.values(laborData);
    tbody.innerHTML = entries.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px;">No labor data</td></tr>'
        : entries.map(e => `
            <tr>
                <td>${e.name}</td>
                <td><span class="role-badge-sm">${e.role}</span></td>
                <td style="text-align:right">${e.hours.toFixed(2)}h</td>
                <td style="text-align:right">${formatCurrency(e.sales)}</td>
                <td style="text-align:right">${formatCurrency(e.tips)}</td>
            </tr>
        `).join('');
}

// Refunds report
function populateRefundsReport() {
    const list = document.getElementById('refunds-list');
    if (!list) return;

    if (refundHistory.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No refunds today</p>';
        return;
    }

    list.innerHTML = refundHistory.map(r => `
        <div class="refund-card">
            <div class="refund-card-header">
                <span>#${r.ticketId}</span>
                <span class="refund-amount">-${formatCurrency(r.amount)}</span>
            </div>
            <div class="refund-card-details">
                ${r.reason} &bull; ${r.method} &bull; ${new Date(r.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                &bull; By: ${r.processedBy}
            </div>
        </div>
    `).join('');
};

// ==========================================
// Side Menu
// ==========================================
$('#btn-menu').addEventListener('click', () => {
    const sideMenu = $('#side-menu');
    sideMenu.classList.toggle('open');

    // Create or toggle overlay
    let overlay = document.querySelector('.side-menu-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'side-menu-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
            sideMenu.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    overlay.classList.toggle('active');
});

$('#close-side-menu').addEventListener('click', () => {
    $('#side-menu').classList.remove('open');
    const overlay = document.querySelector('.side-menu-overlay');
    if (overlay) overlay.classList.remove('active');
});

// Clock in/out from side menu
document.getElementById('menu-clock-in').addEventListener('click', () => {
    if (state.clockedIn) {
        clockOut();
    } else {
        clockIn();
    }
    $('#side-menu').classList.remove('open');
    const overlay = document.querySelector('.side-menu-overlay');
    if (overlay) overlay.classList.remove('active');
});

// Open cash drawer
document.getElementById('menu-open-drawer').addEventListener('click', () => {
    showToast('Cash drawer opened');
    $('#side-menu').classList.remove('open');
    document.querySelector('.side-menu-overlay').classList.remove('active');
});

// ==========================================
// Data Persistence (localStorage)
// ==========================================
const STORAGE_KEY = 'pos_data';

function saveState() {
    try {
        const data = {
            allTickets: state.allTickets,
            ticketCounter: state.ticketCounter,
            heldOrders: heldOrders,
            refundHistory: refundHistory,
            timeClock: timeClock.map(r => ({
                ...r,
                clockIn: r.clockIn ? r.clockIn.toISOString() : null,
                clockOut: r.clockOut ? r.clockOut.toISOString() : null
            })),
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // Storage full or unavailable - silent fail
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const data = JSON.parse(raw);

        // Only restore if saved today (don't carry over stale data)
        const savedDate = data.savedAt ? data.savedAt.split('T')[0] : null;
        const today = new Date().toISOString().split('T')[0];
        if (savedDate !== today) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        if (data.allTickets) {
            state.allTickets = data.allTickets.map(t => ({
                ...t,
                time: t.time ? new Date(t.time) : null
            }));
        }
        if (data.ticketCounter) state.ticketCounter = data.ticketCounter;
        if (data.heldOrders) {
            heldOrders.length = 0;
            data.heldOrders.forEach(o => heldOrders.push({
                ...o,
                heldAt: o.heldAt ? new Date(o.heldAt) : new Date()
            }));
            updateHeldBadge();
        }
        if (data.refundHistory) {
            refundHistory.length = 0;
            data.refundHistory.forEach(r => refundHistory.push(r));
        }
        if (data.timeClock) {
            timeClock.length = 0;
            data.timeClock.forEach(r => timeClock.push({
                ...r,
                clockIn: r.clockIn ? new Date(r.clockIn) : null,
                clockOut: r.clockOut ? new Date(r.clockOut) : null
            }));
        }
    } catch (e) {
        // Corrupted data - ignore
    }
}

// Auto-save on key actions
const _origUpdateTicketDisplayPersist = updateTicketDisplay;
updateTicketDisplay = function() {
    _origUpdateTicketDisplayPersist();
    saveState();
};

const _origCompletePaymentPersist = completePayment;
completePayment = function(total, method) {
    _origCompletePaymentPersist(total, method);
    saveState();
};

// Save periodically
setInterval(saveState, 30000);

// ==========================================
// Time Clock UI
// ==========================================
const timeClockModal = document.getElementById('timeclock-modal');
const tcClockInBtn = document.getElementById('tc-btn-clockin');
const tcClockOutBtn = document.getElementById('tc-btn-clockout');
const tcBreakBtn = document.getElementById('tc-btn-break');

document.getElementById('close-timeclock').addEventListener('click', () => {
    timeClockModal.classList.remove('active');
});

// Override the side menu clock-in to open the full time clock modal
document.getElementById('menu-clock-in').removeEventListener('click', () => {});
document.getElementById('menu-clock-in').addEventListener('click', () => {
    openTimeClockModal();
    $('#side-menu').classList.remove('open');
    const overlay = document.querySelector('.side-menu-overlay');
    if (overlay) overlay.classList.remove('active');
});

function openTimeClockModal() {
    timeClockModal.classList.add('active');
    updateTimeClockUI();
}

function updateTimeClockUI() {
    const empEl = document.getElementById('tc-employee');
    const stateEl = document.getElementById('tc-state');
    const shiftEl = document.getElementById('tc-shift-time');

    empEl.textContent = state.currentUser || '--';

    if (state.clockedIn) {
        stateEl.textContent = 'Clocked In';
        stateEl.className = 'timeclock-state tc-active';
        tcClockInBtn.disabled = true;
        tcClockOutBtn.disabled = false;
        tcBreakBtn.disabled = false;

        // Show elapsed shift time
        const record = timeClock.filter(r => r.empId === (state.currentStaff && state.currentStaff.id) && !r.clockOut).pop();
        if (record) {
            const elapsed = ((new Date() - new Date(record.clockIn)) / 3600000).toFixed(2);
            shiftEl.textContent = 'Shift: ' + elapsed + ' hrs';
        }
    } else {
        stateEl.textContent = 'Not Clocked In';
        stateEl.className = 'timeclock-state tc-inactive';
        tcClockInBtn.disabled = false;
        tcClockOutBtn.disabled = true;
        tcBreakBtn.disabled = true;
        shiftEl.textContent = '';
    }

    // Show today's log entries for this user
    const logEl = document.getElementById('tc-log-entries');
    const today = new Date().toDateString();
    const myRecords = timeClock.filter(r => {
        const d = new Date(r.clockIn);
        return r.empId === (state.currentStaff && state.currentStaff.id) && d.toDateString() === today;
    });

    if (myRecords.length === 0) {
        logEl.innerHTML = '<p class="tc-empty">No shifts recorded today</p>';
    } else {
        logEl.innerHTML = myRecords.map(r => {
            const inTime = new Date(r.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const outTime = r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--';
            const hrs = r.clockOut ? ((new Date(r.clockOut) - new Date(r.clockIn)) / 3600000).toFixed(2) : 'active';
            return `<div class="tc-log-entry">
                <span class="tc-log-time">${inTime} - ${outTime}</span>
                <span class="tc-log-hours">${hrs} hrs</span>
            </div>`;
        }).join('');
    }

    // Show all staff for managers
    const allStaffSection = document.getElementById('tc-all-staff-section');
    if (state.currentRole === 'admin' || state.currentRole === 'manager') {
        allStaffSection.style.display = 'block';
        const tbody = document.getElementById('tc-all-staff-body');
        const todayRecords = timeClock.filter(r => new Date(r.clockIn).toDateString() === today);
        tbody.innerHTML = todayRecords.map(r => {
            const inTime = new Date(r.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const outTime = r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--';
            const hrs = r.clockOut ? ((new Date(r.clockOut) - new Date(r.clockIn)) / 3600000).toFixed(2) : 'active';
            return `<tr><td>${r.empName}</td><td>${r.role}</td><td>${inTime}</td><td>${outTime}</td><td>${hrs}</td></tr>`;
        }).join('') || '<tr><td colspan="5" style="text-align:center">No staff clocked in today</td></tr>';
    } else {
        allStaffSection.style.display = 'none';
    }
}

tcClockInBtn.addEventListener('click', () => {
    clockIn();
    updateTimeClockUI();
});

tcClockOutBtn.addEventListener('click', () => {
    clockOut();
    updateTimeClockUI();
});

// Break tracking
let onBreak = false;
let breakStart = null;

tcBreakBtn.addEventListener('click', () => {
    if (!onBreak) {
        onBreak = true;
        breakStart = new Date();
        tcBreakBtn.textContent = 'End Break';
        tcBreakBtn.classList.add('tc-on-break');
        showToast('Break started');
    } else {
        onBreak = false;
        const breakMins = Math.round((new Date() - breakStart) / 60000);
        tcBreakBtn.textContent = 'Start Break';
        tcBreakBtn.classList.remove('tc-on-break');
        showToast('Break ended (' + breakMins + ' min)');
        breakStart = null;
    }
});

// ==========================================
// Cash Drawer Management
// ==========================================
const cashDrawerState = {
    isOpen: false,
    openedBy: null,
    openedAt: null,
    openingAmount: 0,
    activity: []
};

const cashDrawerModal = document.getElementById('cashdrawer-modal');

document.getElementById('close-cashdrawer').addEventListener('click', () => {
    cashDrawerModal.classList.remove('active');
});

// Override the side menu open drawer to show the full modal
document.getElementById('menu-open-drawer').addEventListener('click', () => {
    openCashDrawerModal();
    $('#side-menu').classList.remove('open');
    const overlay = document.querySelector('.side-menu-overlay');
    if (overlay) overlay.classList.remove('active');
});

function openCashDrawerModal() {
    cashDrawerModal.classList.add('active');
    updateCashDrawerUI();
}

function updateCashDrawerUI() {
    const stateLabel = document.getElementById('drawer-state-label');
    const openedBy = document.getElementById('drawer-opened-by');

    if (cashDrawerState.isOpen) {
        stateLabel.textContent = 'Drawer Open';
        stateLabel.className = 'drawer-state drawer-open';
        openedBy.textContent = 'Opened by ' + (cashDrawerState.openedBy || 'Unknown') +
            ' at ' + (cashDrawerState.openedAt ? new Date(cashDrawerState.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '');
    } else {
        stateLabel.textContent = 'Drawer Closed';
        stateLabel.className = 'drawer-state drawer-closed';
        openedBy.textContent = '';
    }

    // Activity log
    const logEl = document.getElementById('drawer-activity-log');
    if (cashDrawerState.activity.length === 0) {
        logEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:8px">No activity today</p>';
    } else {
        logEl.innerHTML = cashDrawerState.activity.slice(-10).reverse().map(a => {
            const time = new Date(a.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return `<div class="drawer-activity-entry">
                <span>${time}</span>
                <span>${a.action}</span>
                <span>${a.user || ''}</span>
                ${a.amount ? '<span>' + formatCurrency(a.amount) + '</span>' : ''}
            </div>`;
        }).join('');
    }
}

// Denomination counting
document.querySelectorAll('.drawer-denom').forEach(input => {
    input.addEventListener('input', () => {
        let total = 0;
        document.querySelectorAll('.drawer-denom').forEach(el => {
            const denom = el.dataset.denom;
            const val = parseFloat(el.value) || 0;
            total += denom === 'coins' ? val : val * parseFloat(denom);
        });
        document.getElementById('drawer-counted-total').textContent = formatCurrency(total);
    });
});

document.getElementById('btn-open-drawer').addEventListener('click', () => {
    let total = 0;
    document.querySelectorAll('.drawer-denom').forEach(el => {
        const denom = el.dataset.denom;
        const val = parseFloat(el.value) || 0;
        total += denom === 'coins' ? val : val * parseFloat(denom);
    });

    cashDrawerState.isOpen = true;
    cashDrawerState.openedBy = state.currentUser;
    cashDrawerState.openedAt = new Date();
    cashDrawerState.openingAmount = total;
    cashDrawerState.activity.push({
        action: 'Drawer Opened',
        user: state.currentUser,
        amount: total,
        time: new Date()
    });
    updateCashDrawerUI();
    showToast('Cash drawer opened with ' + formatCurrency(total));
});

document.getElementById('btn-close-drawer').addEventListener('click', () => {
    cashDrawerState.isOpen = false;
    cashDrawerState.activity.push({
        action: 'Drawer Closed',
        user: state.currentUser,
        time: new Date()
    });
    updateCashDrawerUI();
    showToast('Cash drawer closed');
});

document.getElementById('btn-no-sale').addEventListener('click', () => {
    cashDrawerState.activity.push({
        action: 'No Sale',
        user: state.currentUser,
        time: new Date()
    });
    updateCashDrawerUI();
    showToast('No sale - drawer popped');
});

// ==========================================
// End of Day Close-Out
// ==========================================
const eodModal = document.getElementById('eod-modal');
let eodCurrentStep = 1;

document.getElementById('close-eod').addEventListener('click', () => {
    eodModal.classList.remove('active');
    eodCurrentStep = 1;
});

// Wire up the Reports Close Day button
const eodButton = document.getElementById('btn-eod');
if (eodButton) {
    eodButton.addEventListener('click', openEOD);
}

function openEOD() {
    eodCurrentStep = 1;
    eodModal.classList.add('active');
    updateEODStep();
    populateEODSummary();
}

function updateEODStep() {
    document.querySelectorAll('.eod-step').forEach(el => {
        const step = parseInt(el.dataset.step);
        el.classList.toggle('active', step <= eodCurrentStep);
        el.classList.toggle('completed', step < eodCurrentStep);
    });
    document.querySelectorAll('.eod-panel').forEach((el, idx) => {
        el.classList.toggle('active', idx + 1 === eodCurrentStep);
    });

    const prevBtn = document.getElementById('eod-prev');
    const nextBtn = document.getElementById('eod-next');

    prevBtn.style.display = eodCurrentStep > 1 ? 'inline-block' : 'none';

    if (eodCurrentStep === 3) {
        nextBtn.textContent = 'Close Day';
        nextBtn.disabled = !document.getElementById('eod-confirm-check').checked;
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.disabled = false;
    }
}

function populateEODSummary() {
    const grid = document.getElementById('eod-summary-grid');
    const warnings = document.getElementById('eod-warnings');

    let totalSales = 0, cashSales = 0, cardSales = 0, ticketCount = 0;
    let totalTips = 0, totalDiscounts = 0, voidCount = 0, refundTotal = 0;
    const refunds = state.allTickets.filter(t => t.status === 'refunded');

    state.allTickets.forEach(t => {
        if (t.status === 'voided') { voidCount++; return; }
        if (t.status === 'refunded') { refundTotal += t.total || 0; }
        if (t.paid) {
            ticketCount++;
            totalSales += t.total || 0;
            if (t.tip) totalTips += t.tip;
            if (t.discount) totalDiscounts += t.discount.amount || 0;
            if (t.paymentMethod === 'cash') cashSales += t.total || 0;
            else cardSales += t.total || 0;
        }
    });

    const openTickets = state.allTickets.filter(t => t.status === 'open');

    grid.innerHTML = `
        <div class="eod-summary-item"><span>Total Sales</span><strong>${formatCurrency(totalSales)}</strong></div>
        <div class="eod-summary-item"><span>Tickets</span><strong>${ticketCount}</strong></div>
        <div class="eod-summary-item"><span>Cash Sales</span><strong>${formatCurrency(cashSales)}</strong></div>
        <div class="eod-summary-item"><span>Card Sales</span><strong>${formatCurrency(cardSales)}</strong></div>
        <div class="eod-summary-item"><span>Tips</span><strong>${formatCurrency(totalTips)}</strong></div>
        <div class="eod-summary-item"><span>Discounts</span><strong>${formatCurrency(totalDiscounts)}</strong></div>
        <div class="eod-summary-item"><span>Voids</span><strong>${voidCount}</strong></div>
        <div class="eod-summary-item"><span>Refunds</span><strong>${formatCurrency(refundTotal)}</strong></div>
        <div class="eod-summary-item eod-net"><span>Net Sales</span><strong>${formatCurrency(totalSales - refundTotal)}</strong></div>
    `;

    // Expected cash in drawer
    const expectedCash = cashDrawerState.openingAmount + cashSales;
    document.getElementById('eod-expected-cash').textContent = formatCurrency(expectedCash);

    // Warnings
    let warningHtml = '';
    if (openTickets.length > 0) {
        warningHtml += `<div class="eod-warning">Warning: ${openTickets.length} open ticket(s) remaining</div>`;
    }
    if (voidCount > 3) {
        warningHtml += `<div class="eod-warning">Note: ${voidCount} voided tickets today</div>`;
    }
    warnings.innerHTML = warningHtml;
}

// EOD denomination counting
document.querySelectorAll('.eod-denom').forEach(input => {
    input.addEventListener('input', () => {
        let total = 0;
        document.querySelectorAll('.eod-denom').forEach(el => {
            const denom = el.dataset.denom;
            const val = parseFloat(el.value) || 0;
            total += denom === 'coins' ? val : val * parseFloat(denom);
        });
        document.getElementById('eod-counted-cash').textContent = formatCurrency(total);

        const expected = parseFloat(document.getElementById('eod-expected-cash').textContent.replace(/[^0-9.-]/g, '')) || 0;
        const variance = total - expected;
        const varianceEl = document.getElementById('eod-variance');
        varianceEl.textContent = (variance >= 0 ? '+' : '') + formatCurrency(variance);
        varianceEl.className = Math.abs(variance) < 1 ? 'eod-variance-ok' : 'eod-variance-bad';
    });
});

document.getElementById('eod-confirm-check').addEventListener('change', () => {
    updateEODStep();
});

document.getElementById('eod-next').addEventListener('click', () => {
    if (eodCurrentStep < 3) {
        eodCurrentStep++;
        updateEODStep();

        if (eodCurrentStep === 3) {
            // Populate confirmation
            const countedCash = document.getElementById('eod-counted-cash').textContent;
            const expectedCash = document.getElementById('eod-expected-cash').textContent;
            const variance = document.getElementById('eod-variance').textContent;

            let totalSales = 0;
            state.allTickets.forEach(t => {
                if (t.paid && t.status !== 'voided') totalSales += t.total || 0;
            });

            document.getElementById('eod-confirm-details').innerHTML = `
                <div class="eod-confirm-row"><span>Total Sales:</span><strong>${formatCurrency(totalSales)}</strong></div>
                <div class="eod-confirm-row"><span>Expected Cash:</span><strong>${expectedCash}</strong></div>
                <div class="eod-confirm-row"><span>Counted Cash:</span><strong>${countedCash}</strong></div>
                <div class="eod-confirm-row"><span>Variance:</span><strong>${variance}</strong></div>
                <div class="eod-confirm-row"><span>Closed By:</span><strong>${state.currentUser}</strong></div>
                <div class="eod-confirm-row"><span>Date:</span><strong>${new Date().toLocaleDateString()}</strong></div>
            `;
        }
    } else {
        // Close day
        if (!document.getElementById('eod-confirm-check').checked) {
            showToast('Please confirm the totals', 'error');
            return;
        }
        eodModal.classList.remove('active');
        eodCurrentStep = 1;

        cashDrawerState.isOpen = false;
        cashDrawerState.activity.push({
            action: 'EOD Close',
            user: state.currentUser,
            time: new Date()
        });

        showToast('Day closed successfully');
    }
});

document.getElementById('eod-prev').addEventListener('click', () => {
    if (eodCurrentStep > 1) {
        eodCurrentStep--;
        updateEODStep();
    }
});

// ==========================================
// 86'd Items (Mark Items Out of Stock)
// ==========================================
const eightySixed = new Set();

function toggleEightySix(itemId) {
    if (eightySixed.has(itemId)) {
        eightySixed.delete(itemId);
        showToast('Item back in stock');
    } else {
        eightySixed.add(itemId);
        showToast("Item 86'd (out of stock)");
    }
    populateMenu();
}
window.toggleEightySix = toggleEightySix;

// Patch the addToOrder function to check 86'd status
const _origAddToOrder = typeof addToOrder !== 'undefined' ? addToOrder : null;

function addToOrderWith86Check(item) {
    if (eightySixed.has(item.id)) {
        showToast(item.name + " is 86'd (out of stock)", 'error');
        return;
    }
    if (_origAddToOrder) {
        _origAddToOrder(item);
    }
}

// ==========================================
// Keyboard Shortcuts
// ==========================================
const shortcutsModal = document.getElementById('shortcuts-overlay');

document.getElementById('close-shortcuts').addEventListener('click', () => {
    shortcutsModal.classList.remove('active');
});

const categoryKeys = ['popular', 'appetizers', 'entrees', 'sides', 'drinks', 'desserts'];

document.addEventListener('keydown', (e) => {
    // Don't fire shortcuts when typing in an input
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Allow Escape to blur input
        if (e.key === 'Escape') {
            e.target.blur();
            e.preventDefault();
        }
        return;
    }

    // Don't fire shortcuts on login screen
    if (document.getElementById('login-screen').classList.contains('active')) return;

    // Check for active modals - Escape closes them
    const activeModals = document.querySelectorAll('.modal.active');
    if (e.key === 'Escape') {
        if (activeModals.length > 0) {
            activeModals.forEach(m => m.classList.remove('active'));
            e.preventDefault();
            return;
        }
    }

    // Ctrl + key shortcuts
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'n':
                e.preventDefault();
                if (typeof newTicket === 'function') newTicket();
                break;
            case 'f':
                e.preventDefault();
                const searchInput = document.getElementById('menu-search');
                if (searchInput) searchInput.focus();
                break;
            case 'd':
                e.preventDefault();
                document.getElementById('btn-theme').click();
                break;
        }
        return;
    }

    // F-key shortcuts
    switch (e.key) {
        case 'F1':
            e.preventDefault();
            switchToView('order');
            break;
        case 'F2':
            e.preventDefault();
            switchToView('tables');
            break;
        case 'F3':
            e.preventDefault();
            switchToView('kitchen');
            break;
        case 'F4':
            e.preventDefault();
            switchToView('tickets');
            break;
        case 'F5':
            e.preventDefault();
            switchToView('reports');
            break;
        case 'F8':
            e.preventDefault();
            document.getElementById('btn-send').click();
            break;
        case 'F9':
            e.preventDefault();
            document.getElementById('btn-pay-cash').click();
            break;
        case 'F10':
            e.preventDefault();
            document.getElementById('btn-pay-card').click();
            break;
        case 'F11':
            e.preventDefault();
            document.getElementById('btn-hold').click();
            break;
        case 'F12':
            e.preventDefault();
            document.getElementById('btn-discount').click();
            break;
    }

    // Number keys 1-6 for category switching (only in order view)
    if (state.currentView === 'order' && e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key) - 1;
        if (idx < categoryKeys.length) {
            const tabs = document.querySelectorAll('.category-tab');
            tabs.forEach(t => t.classList.remove('active'));
            if (tabs[idx]) {
                tabs[idx].classList.add('active');
                state.currentCategory = categoryKeys[idx];
                state.menuSearchQuery = '';
                const searchInput = document.getElementById('menu-search');
                if (searchInput) searchInput.value = '';
                populateMenu();
            }
        }
    }

    // ? key shows shortcuts help
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        shortcutsModal.classList.add('active');
    }
});

// Helper to switch views programmatically
function switchToView(viewName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.querySelectorAll('.main-view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(viewName + '-view');
    if (viewEl) viewEl.classList.add('active');
    state.currentView = viewName;

    // Trigger population callbacks
    if (viewName === 'kitchen' && typeof populateKitchen === 'function') populateKitchen();
    if (viewName === 'tickets' && typeof populateTicketsList === 'function') populateTicketsList();
}

// ==========================================
// Patch Menu Rendering for 86'd Items
// ==========================================
const _origPopulateMenu = populateMenu;
populateMenu = function() {
    _origPopulateMenu();

    // Add 86'd visual state to menu items
    const grid = document.getElementById('menu-grid');
    if (!grid) return;

    grid.querySelectorAll('.menu-item').forEach(btn => {
        const itemName = btn.querySelector('.menu-item-name');
        if (!itemName) return;
        const name = itemName.textContent;

        // Find the item by name across all categories
        let foundItem = null;
        Object.values(MENU).forEach(catItems => {
            const match = catItems.find(i => i.name === name);
            if (match) foundItem = match;
        });

        if (foundItem && eightySixed.has(foundItem.id)) {
            btn.classList.add('menu-item-86d');
            btn.setAttribute('title', '86\'d - Out of Stock');
        }

        // Right-click to toggle 86'd (for managers)
        if (state.currentRole === 'admin' || state.currentRole === 'manager') {
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (foundItem) {
                    toggleEightySix(foundItem.id);
                }
            });
        }
    });
};

// ==========================================
// Tip Adjustment
// ==========================================
const tipAdjustModal = document.getElementById('tip-adjust-modal');
let tipAdjustTicketId = null;

document.getElementById('close-tip-adjust').addEventListener('click', () => {
    tipAdjustModal.classList.remove('active');
});

document.getElementById('tip-adjust-cancel').addEventListener('click', () => {
    tipAdjustModal.classList.remove('active');
});

function openTipAdjust(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket) { showToast('Ticket not found', 'error'); return; }
    if (!ticket.paid) { showToast('Can only adjust tips on paid tickets', 'error'); return; }

    tipAdjustTicketId = ticketId;

    const infoEl = document.getElementById('tip-ticket-info');
    infoEl.innerHTML = `
        <div class="tip-info-row"><span>Ticket</span><strong>#${ticket.id}</strong></div>
        <div class="tip-info-row"><span>Total</span><strong>${formatCurrency(ticket.total)}</strong></div>
        <div class="tip-info-row"><span>Payment</span><strong>${ticket.paymentMethod || 'N/A'}</strong></div>
        <div class="tip-info-row"><span>Current Tip</span><strong>${formatCurrency(ticket.tip || 0)}</strong></div>
    `;

    document.getElementById('tip-amount-input').value = (ticket.tip || 0).toFixed(2);
    updateTipNewTotal(ticket);

    tipAdjustModal.classList.add('active');
}
window.openTipAdjust = openTipAdjust;

function updateTipNewTotal(ticket) {
    const tipVal = parseFloat(document.getElementById('tip-amount-input').value) || 0;
    document.getElementById('tip-new-total').textContent = formatCurrency(ticket.total + tipVal);
}

// Tip preset buttons
document.querySelectorAll('.tip-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const ticket = state.allTickets.find(t => t.id === tipAdjustTicketId);
        if (!ticket) return;

        const pct = btn.dataset.pct;
        if (pct === 'custom') {
            document.getElementById('tip-amount-input').focus();
            document.getElementById('tip-amount-input').select();
            return;
        }

        const tipAmount = ticket.total * (parseInt(pct) / 100);
        document.getElementById('tip-amount-input').value = tipAmount.toFixed(2);
        updateTipNewTotal(ticket);

        document.querySelectorAll('.tip-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.getElementById('tip-amount-input').addEventListener('input', () => {
    const ticket = state.allTickets.find(t => t.id === tipAdjustTicketId);
    if (ticket) updateTipNewTotal(ticket);
    document.querySelectorAll('.tip-preset-btn').forEach(b => b.classList.remove('active'));
});

document.getElementById('tip-adjust-save').addEventListener('click', () => {
    const ticket = state.allTickets.find(t => t.id === tipAdjustTicketId);
    if (!ticket) return;

    const newTip = parseFloat(document.getElementById('tip-amount-input').value) || 0;
    if (newTip < 0) {
        showToast('Tip cannot be negative', 'error');
        return;
    }

    const oldTip = ticket.tip || 0;
    ticket.tip = Math.round(newTip * 100) / 100;
    ticket.tipAdjustedAt = new Date().toISOString();
    ticket.tipAdjustedBy = state.currentUser;

    tipAdjustModal.classList.remove('active');
    showToast(`Tip adjusted: ${formatCurrency(oldTip)} → ${formatCurrency(ticket.tip)}`);
    populateTicketsList();
    saveState();
});

// ==========================================
// Order Notes & Special Instructions
// ==========================================
const notesModal = document.getElementById('notes-modal');
let activeNoteItemIndex = -1;

document.getElementById('btn-notes').addEventListener('click', () => {
    openNotesModal();
});

document.getElementById('close-notes').addEventListener('click', () => {
    notesModal.classList.remove('active');
});

document.getElementById('notes-cancel').addEventListener('click', () => {
    notesModal.classList.remove('active');
});

function openNotesModal() {
    notesModal.classList.add('active');

    // Populate ticket note
    document.getElementById('ticket-note-input').value = state.ticket.note || '';

    // Populate item notes
    const listEl = document.getElementById('notes-item-list');
    if (state.ticket.items.length === 0) {
        listEl.innerHTML = '<p class="notes-empty">No items in order</p>';
    } else {
        listEl.innerHTML = state.ticket.items.map((item, idx) => `
            <div class="notes-item-row">
                <span class="notes-item-name">${item.qty}x ${item.name}</span>
                <input type="text" class="notes-item-input" data-index="${idx}"
                    value="${item.note || ''}" placeholder="Add note...">
            </div>
        `).join('');
    }

    activeNoteItemIndex = -1;
}

// Quick tags - append to the focused note input
document.querySelectorAll('.quick-tag').forEach(btn => {
    btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;

        // Try to find the focused item note input
        const focusedInput = notesModal.querySelector('.notes-item-input:focus');
        if (focusedInput) {
            focusedInput.value = focusedInput.value ? focusedInput.value + ', ' + tag : tag;
            return;
        }

        // Otherwise append to ticket note
        const ticketNote = document.getElementById('ticket-note-input');
        ticketNote.value = ticketNote.value ? ticketNote.value + ', ' + tag : tag;
    });
});

document.getElementById('notes-save').addEventListener('click', () => {
    // Save ticket note
    state.ticket.note = document.getElementById('ticket-note-input').value.trim() || null;

    // Save item notes
    notesModal.querySelectorAll('.notes-item-input').forEach(input => {
        const idx = parseInt(input.dataset.index);
        if (state.ticket.items[idx]) {
            state.ticket.items[idx].note = input.value.trim() || null;
        }
    });

    notesModal.classList.remove('active');
    updateTicketDisplay();
    showToast('Notes saved');
});

// ==========================================
// Customer Tab Management
// ==========================================
const tabModal = document.getElementById('tab-modal');
const customerTabs = [];

document.getElementById('close-tab').addEventListener('click', () => {
    tabModal.classList.remove('active');
});

document.getElementById('menu-customer-tabs').addEventListener('click', () => {
    openTabModal();
    $('#side-menu').classList.remove('open');
    const overlay = document.querySelector('.side-menu-overlay');
    if (overlay) overlay.classList.remove('active');
});

function openTabModal() {
    tabModal.classList.add('active');
    document.getElementById('tab-new-form').style.display = 'none';
    refreshTabList();
}

function refreshTabList() {
    const listEl = document.getElementById('tab-list');
    const query = (document.getElementById('tab-search').value || '').toLowerCase();

    let tabs = customerTabs.filter(t => t.status === 'open');
    if (query) {
        tabs = tabs.filter(t =>
            t.name.toLowerCase().includes(query) ||
            (t.phone || '').includes(query)
        );
    }

    if (tabs.length === 0) {
        listEl.innerHTML = '<p class="tab-empty">No open tabs</p>';
    } else {
        listEl.innerHTML = tabs.map((tab, idx) => `
            <div class="tab-card">
                <div class="tab-card-info">
                    <strong>${tab.name}</strong>
                    <span class="tab-card-phone">${tab.phone || 'No phone'}</span>
                </div>
                <div class="tab-card-balance">
                    <span class="tab-running">${formatCurrency(tab.runningTotal)}</span>
                    <span class="tab-limit-label">of ${formatCurrency(tab.limit)} limit</span>
                </div>
                <div class="tab-card-meta">
                    <span>${tab.tickets.length} ticket(s)</span>
                    <span>Opened ${new Date(tab.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="tab-card-actions">
                    <button class="tab-btn-sm" onclick="addToTab(${idx})">Add Current</button>
                    <button class="tab-btn-sm tab-btn-close" onclick="closeTab(${idx})">Close Tab</button>
                </div>
            </div>
        `).join('');
    }
}

document.getElementById('tab-search').addEventListener('input', () => {
    refreshTabList();
});

document.getElementById('tab-new-btn').addEventListener('click', () => {
    document.getElementById('tab-new-form').style.display = 'block';
    document.getElementById('tab-name').focus();
});

document.getElementById('tab-form-cancel').addEventListener('click', () => {
    document.getElementById('tab-new-form').style.display = 'none';
});

document.getElementById('tab-form-save').addEventListener('click', () => {
    const name = document.getElementById('tab-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    const tab = {
        name,
        phone: document.getElementById('tab-phone').value.trim(),
        limit: parseFloat(document.getElementById('tab-limit').value) || 100,
        runningTotal: 0,
        tickets: [],
        status: 'open',
        openedAt: new Date().toISOString(),
        openedBy: state.currentUser
    };

    customerTabs.push(tab);
    document.getElementById('tab-new-form').style.display = 'none';
    document.getElementById('tab-name').value = '';
    document.getElementById('tab-phone').value = '';
    document.getElementById('tab-limit').value = '100';
    refreshTabList();
    showToast(`Tab opened for ${name}`);
});

function addToTab(tabIndex) {
    const tab = customerTabs[tabIndex];
    if (!tab || tab.status !== 'open') return;

    if (state.ticket.items.length === 0) {
        showToast('No items to add', 'warning');
        return;
    }

    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    if (tab.runningTotal + subtotal > tab.limit) {
        showToast(`Exceeds tab limit (${formatCurrency(tab.limit)})`, 'error');
        return;
    }

    tab.runningTotal += subtotal;
    tab.tickets.push({
        id: state.ticket.id,
        items: [...state.ticket.items],
        subtotal,
        time: new Date().toISOString()
    });

    refreshTabList();
    showToast(`${formatCurrency(subtotal)} added to ${tab.name}'s tab`);
}
window.addToTab = addToTab;

function closeTab(tabIndex) {
    const tab = customerTabs[tabIndex];
    if (!tab) return;

    tab.status = 'closed';
    tab.closedAt = new Date().toISOString();

    refreshTabList();
    showToast(`Tab closed for ${tab.name} - Total: ${formatCurrency(tab.runningTotal)}`);
}
window.closeTab = closeTab;

// ==========================================
// Gift Card Management
// ==========================================
const giftCardModal = document.getElementById('giftcard-modal');
const giftCards = {};

document.getElementById('close-giftcard').addEventListener('click', () => {
    giftCardModal.classList.remove('active');
});

document.getElementById('menu-gift-cards').addEventListener('click', () => {
    giftCardModal.classList.add('active');
    document.getElementById('gc-result').style.display = 'none';
    document.getElementById('gc-card-number').value = '';
    $('#side-menu').classList.remove('open');
    const overlay = document.querySelector('.side-menu-overlay');
    if (overlay) overlay.classList.remove('active');
});

document.getElementById('gc-lookup-btn').addEventListener('click', () => {
    const cardNum = document.getElementById('gc-card-number').value.trim();
    if (!cardNum) { showToast('Enter a card number', 'error'); return; }

    const card = giftCards[cardNum];
    if (!card) {
        showToast('Card not found', 'error');
        document.getElementById('gc-result').style.display = 'none';
        return;
    }

    showGiftCardResult(card);
});

function showGiftCardResult(card) {
    document.getElementById('gc-result').style.display = 'block';
    document.getElementById('gc-balance').textContent = formatCurrency(card.balance);
    document.getElementById('gc-balance').className = 'gc-balance-amount' + (card.balance <= 0 ? ' gc-zero' : '');

    const histEl = document.getElementById('gc-history');
    if (card.history.length === 0) {
        histEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:8px">No transactions</p>';
    } else {
        histEl.innerHTML = card.history.slice(-5).reverse().map(h => `
            <div class="gc-history-row">
                <span>${new Date(h.time).toLocaleDateString()}</span>
                <span>${h.type}</span>
                <span class="${h.type === 'charge' ? 'gc-debit' : 'gc-credit'}">${h.type === 'charge' ? '-' : '+'}${formatCurrency(h.amount)}</span>
            </div>
        `).join('');
    }
}

// Sell new gift card
document.querySelectorAll('.gc-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = parseFloat(btn.dataset.amount);
        activateGiftCard(amount);
    });
});

document.getElementById('gc-sell-btn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('gc-custom-amount').value);
    if (!amount || amount < 5) { showToast('Minimum $5', 'error'); return; }
    activateGiftCard(amount);
});

function activateGiftCard(amount) {
    const cardNum = 'GC-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

    giftCards[cardNum] = {
        number: cardNum,
        balance: amount,
        originalAmount: amount,
        activatedAt: new Date().toISOString(),
        activatedBy: state.currentUser,
        history: [
            { type: 'activation', amount, time: new Date().toISOString() }
        ]
    };

    document.getElementById('gc-card-number').value = cardNum;
    showGiftCardResult(giftCards[cardNum]);
    showToast(`Gift card activated: ${cardNum} for ${formatCurrency(amount)}`);
}

// Reload card
document.getElementById('gc-reload-btn').addEventListener('click', () => {
    const cardNum = document.getElementById('gc-card-number').value.trim();
    const card = giftCards[cardNum];
    if (!card) return;

    const reloadAmount = parseFloat(prompt('Reload amount:'));
    if (!reloadAmount || reloadAmount <= 0) return;

    card.balance += reloadAmount;
    card.history.push({ type: 'reload', amount: reloadAmount, time: new Date().toISOString() });
    showGiftCardResult(card);
    showToast(`Reloaded ${formatCurrency(reloadAmount)} to ${cardNum}`);
});

// Pay with gift card
document.getElementById('gc-pay-btn').addEventListener('click', () => {
    const cardNum = document.getElementById('gc-card-number').value.trim();
    const card = giftCards[cardNum];
    if (!card) return;

    if (state.ticket.items.length === 0) {
        showToast('No items in current order', 'warning');
        return;
    }

    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * (CONFIG.taxRate / 100);
    const total = subtotal + tax;

    if (card.balance < total) {
        showToast(`Insufficient balance. Card: ${formatCurrency(card.balance)}, Total: ${formatCurrency(total)}`, 'error');
        return;
    }

    card.balance -= total;
    card.history.push({ type: 'charge', amount: total, time: new Date().toISOString(), ticketId: state.ticket.id });
    showGiftCardResult(card);

    // Complete the payment
    state.ticket.table = state.ticket.table;
    state.allTickets.push({
        ...state.ticket,
        id: state.ticket.id,
        status: 'paid',
        paid: true,
        paymentMethod: 'gift',
        giftCardNumber: cardNum,
        total,
        subtotal,
        tax,
        time: new Date(),
        paidAt: new Date().toISOString()
    });

    giftCardModal.classList.remove('active');
    showToast(`Paid ${formatCurrency(total)} with gift card ${cardNum}. Remaining: ${formatCurrency(card.balance)}`);
    newTicket();
    saveState();
});

// ==========================================
// Thermal Report Printing
// ==========================================
function printThermalReport() {
    let totalSales = 0, cashSales = 0, cardSales = 0, ticketCount = 0;
    let totalTips = 0, totalDiscounts = 0, voidCount = 0, refundTotal = 0;

    state.allTickets.forEach(t => {
        if (t.status === 'voided') { voidCount++; return; }
        if (t.paid) {
            ticketCount++;
            totalSales += t.total || 0;
            if (t.tip) totalTips += t.tip;
            if (t.discount) totalDiscounts += t.discount.amount || 0;
            if (t.paymentMethod === 'cash') cashSales += t.total || 0;
            else cardSales += t.total || 0;
        }
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const receiptWidth = 280;
    const dashes = '-'.repeat(32);
    const stars = '*'.repeat(32);

    const report = `
<div style="font-family:'Courier New',monospace;width:${receiptWidth}px;padding:8px;font-size:12px;color:#000;background:#fff;">
    <div style="text-align:center;font-weight:bold;font-size:14px;">DAILY SALES REPORT</div>
    <div style="text-align:center;font-size:11px;">${CONFIG.restaurant ? CONFIG.restaurant.name || 'Restaurant POS' : 'Restaurant POS'}</div>
    <div style="text-align:center;font-size:11px;">${dateStr} ${timeStr}</div>
    <div style="text-align:center;font-size:11px;">Printed by: ${state.currentUser}</div>
    <pre style="margin:8px 0;font-size:11px;">${stars}
SALES SUMMARY
${dashes}
Tickets:           ${String(ticketCount).padStart(10)}
Total Sales:       ${formatCurrency(totalSales).padStart(10)}
Cash Sales:        ${formatCurrency(cashSales).padStart(10)}
Card Sales:        ${formatCurrency(cardSales).padStart(10)}
${dashes}
DEDUCTIONS
${dashes}
Discounts:         ${formatCurrency(totalDiscounts).padStart(10)}
Refunds:           ${formatCurrency(refundTotal).padStart(10)}
Voids:             ${String(voidCount).padStart(10)}
${dashes}
EXTRAS
${dashes}
Tips:              ${formatCurrency(totalTips).padStart(10)}
${dashes}
NET SALES:         ${formatCurrency(totalSales - refundTotal).padStart(10)}
Avg Ticket:        ${formatCurrency(ticketCount > 0 ? totalSales / ticketCount : 0).padStart(10)}
${stars}
</pre>
    <div style="text-align:center;font-size:10px;color:#666;">--- End of Report ---</div>
</div>`;

    const printWindow = window.open('', 'report-print', 'width=320,height=600');
    if (!printWindow) { showToast('Pop-up blocked', 'error'); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Sales Report</title>
        <style>@page{size:80mm auto;margin:0;}body{margin:0;padding:4px;}</style>
        </head><body>${report}
        <div style="text-align:center;margin-top:12px;">
            <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;">Print</button>
            <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer;margin-left:8px;">Close</button>
        </div>
        </body></html>`);
    printWindow.document.close();
    showToast('Report ready to print');
}

// Wire up the Print Report button
const printReportBtn = document.getElementById('btn-print-report');
if (printReportBtn) {
    printReportBtn.addEventListener('click', printThermalReport);
}

// ==========================================
// Patch Ticket Display to Show Notes
// ==========================================
const _origUpdateTicketDisplayNotes = updateTicketDisplay;
updateTicketDisplay = function() {
    _origUpdateTicketDisplayNotes();

    // Add note indicators to items
    const container = document.getElementById('ticket-items');
    if (!container) return;

    const items = container.querySelectorAll('.ticket-item');
    items.forEach((el, idx) => {
        const item = state.ticket.items[idx];
        if (item && item.note) {
            const noteEl = document.createElement('div');
            noteEl.className = 'ticket-item-note';
            noteEl.textContent = item.note;
            const details = el.querySelector('.ticket-item-details');
            if (details) details.appendChild(noteEl);
        }
    });

    // Show ticket-level note
    if (state.ticket.note) {
        const noteBar = document.createElement('div');
        noteBar.className = 'ticket-note-bar';
        noteBar.textContent = state.ticket.note;
        container.prepend(noteBar);
    }
};

// ==========================================
// Patch Tickets List for Tip Adjust Button
// ==========================================
const _origPopulateTicketsListTip = populateTicketsList;
populateTicketsList = function() {
    _origPopulateTicketsListTip();

    const container = document.getElementById('tickets-list');
    if (!container) return;

    container.querySelectorAll('.ticket-card').forEach((el, idx) => {
        const ticket = state.allTickets[idx];
        if (!ticket || !ticket.paid) return;

        // Add tip info and adjust button
        const tipRow = document.createElement('div');
        tipRow.className = 'ticket-card-tip';
        tipRow.innerHTML = `
            <span>Tip: ${formatCurrency(ticket.tip || 0)}</span>
            <button class="tip-adjust-btn" onclick="openTipAdjust(${ticket.id})">Adjust Tip</button>
        `;
        el.appendChild(tipRow);
    });
};

// ==========================================
// Patch Kitchen Ticket for Notes Display
// ==========================================
const _origPrintKitchenTickets = printKitchenTickets;
printKitchenTickets = function(order) {
    // Inject item notes into station-routed tickets
    order.items.forEach(item => {
        if (!item.notes) {
            const ticketItem = state.ticket.items.find(i => i.id === item.id && i.name === item.name);
            if (ticketItem && ticketItem.note) {
                item.notes = ticketItem.note;
            }
        }
    });
    _origPrintKitchenTickets(order);
};

// ==========================================
// Inventory / Stock Tracking
// ==========================================
const inventory = {};

// Initialize inventory from menu items
Object.values(MENU).forEach(catItems => {
    catItems.forEach(item => {
        if (!inventory[item.id]) {
            inventory[item.id] = {
                name: item.name,
                stock: 50,     // default starting stock
                low: 5,        // low stock threshold
                par: 20,       // par level for reorder
                unit: 'each'
            };
        }
    });
});

function checkInventory(itemId) {
    const inv = inventory[itemId];
    if (!inv) return true; // unknown items are always available
    if (inv.stock <= 0) return false;
    return true;
}

function deductInventory(itemId, qty) {
    const inv = inventory[itemId];
    if (!inv) return;
    inv.stock = Math.max(0, inv.stock - qty);

    if (inv.stock <= 0) {
        eightySixed.add(itemId);
        showToast(`${inv.name} is now 86'd (out of stock)`, 'warning');
        populateMenu();
    } else if (inv.stock <= inv.low) {
        showToast(`Low stock: ${inv.name} (${inv.stock} remaining)`, 'warning');
    }
}

function setStock(itemId, newStock) {
    const inv = inventory[itemId];
    if (!inv) return;
    inv.stock = Math.max(0, newStock);
    if (inv.stock > 0 && eightySixed.has(itemId)) {
        eightySixed.delete(itemId);
        showToast(`${inv.name} back in stock`);
    }
    populateMenu();
}
window.setStock = setStock;

// Deduct inventory when sending to kitchen
const _origSendToKitchenInv = document.getElementById('btn-send').onclick;
document.getElementById('btn-send').addEventListener('click', () => {
    state.ticket.items.forEach(item => {
        deductInventory(item.id, item.qty);
    });
}, true); // use capture to run before the main handler

// ==========================================
// Multi-Language Support (i18n)
// ==========================================
const LANG = {
    en: {
        newOrder: 'New Order',
        tables: 'Tables',
        kitchen: 'Kitchen',
        tickets: 'Tickets',
        reports: 'Reports',
        dineIn: 'Dine-In',
        takeout: 'Takeout',
        delivery: 'Delivery',
        barTab: 'Bar Tab',
        subtotal: 'Subtotal',
        tax: 'Tax',
        total: 'Total',
        cash: 'Cash',
        card: 'Card',
        discount: 'Discount',
        hold: 'Hold',
        split: 'Split',
        notes: 'Notes',
        sendKitchen: 'Send to Kitchen',
        clockIn: 'Clock In',
        clockOut: 'Clock Out',
        search: 'Search menu items...',
        payment: 'Payment',
        processPayment: 'Process Payment',
        tipAdjust: 'Tip Adjustment',
        noItems: 'Tap menu items to add to order',
        settleDesc: 'Settle Batch',
        printReport: 'Print Report',
        closeDay: 'Close Day (EOD)',
        fire: 'FIRE',
        bump: 'BUMP',
        rush: 'RUSH',
        allergy: 'ALLERGY',
        new_: 'NEW'
    },
    es: {
        newOrder: 'Nuevo Pedido',
        tables: 'Mesas',
        kitchen: 'Cocina',
        tickets: 'Tickets',
        reports: 'Reportes',
        dineIn: 'En Mesa',
        takeout: 'Para Llevar',
        delivery: 'Entrega',
        barTab: 'Cuenta Barra',
        subtotal: 'Subtotal',
        tax: 'Impuesto',
        total: 'Total',
        cash: 'Efectivo',
        card: 'Tarjeta',
        discount: 'Descuento',
        hold: 'Retener',
        split: 'Dividir',
        notes: 'Notas',
        sendKitchen: 'Enviar a Cocina',
        clockIn: 'Marcar Entrada',
        clockOut: 'Marcar Salida',
        search: 'Buscar artículos...',
        payment: 'Pago',
        processPayment: 'Procesar Pago',
        tipAdjust: 'Ajuste de Propina',
        noItems: 'Toque los artículos del menú para agregar',
        settleDesc: 'Cerrar Lote',
        printReport: 'Imprimir Reporte',
        closeDay: 'Cierre del Día',
        fire: 'FUEGO',
        bump: 'LISTO',
        rush: 'URGENTE',
        allergy: 'ALERGIA',
        new_: 'NUEVO'
    }
};

let currentLang = 'en';

function setLanguage(lang) {
    if (!LANG[lang]) return;
    currentLang = lang;
    const t = LANG[lang];

    // Update tab buttons
    const tabLabels = { order: t.newOrder, tables: t.tables, kitchen: t.kitchen, tickets: t.tickets, reports: t.reports };
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const view = btn.dataset.view;
        if (tabLabels[view]) btn.textContent = tabLabels[view];
    });

    // Update action buttons
    const btnMap = {
        'btn-discount': t.discount,
        'btn-hold': t.hold,
        'btn-split': t.split,
        'btn-notes': t.notes,
        'btn-send': t.sendKitchen,
        'btn-settle-batch': t.settleDesc,
        'btn-print-report': t.printReport,
        'btn-eod': t.closeDay,
        'btn-process-payment': t.processPayment
    };

    Object.entries(btnMap).forEach(([id, label]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = label;
    });

    // Update search placeholder
    const searchEl = document.getElementById('menu-search');
    if (searchEl) searchEl.placeholder = t.search;

    // Update summary labels
    const subEl = document.querySelector('.summary-row:first-child span');
    if (subEl) subEl.textContent = t.subtotal;

    showToast(`Language: ${lang === 'en' ? 'English' : 'Español'}`);
}
window.setLanguage = setLanguage;

// ==========================================
// Quick Service / Counter Mode
// ==========================================
let quickServiceMode = false;

function toggleQuickService() {
    quickServiceMode = !quickServiceMode;
    document.body.classList.toggle('quick-service-mode', quickServiceMode);

    if (quickServiceMode) {
        showToast('Quick Service mode ON - streamlined for counter');
    } else {
        showToast('Quick Service mode OFF');
    }
}
window.toggleQuickService = toggleQuickService;

// ==========================================
// Customer Loyalty Points Program
// ==========================================
const LOYALTY = {
    enabled: true,
    pointsPerDollar: 1,        // 1 point per dollar spent
    redeemThreshold: 100,      // Points needed before redemption
    redeemValue: 5.00,         // Dollar value of redeemThreshold points
    bonusMultiplier: {
        birthday: 2,
        happyHour: 1.5
    }
};

const loyaltyDB = {};

function getLoyaltyMember(phone) {
    return loyaltyDB[phone] || null;
}

function registerLoyaltyMember(name, phone) {
    if (loyaltyDB[phone]) return loyaltyDB[phone];
    loyaltyDB[phone] = {
        name,
        phone,
        points: 0,
        totalSpent: 0,
        visits: 0,
        joinedAt: new Date().toISOString(),
        tier: 'bronze', // bronze, silver, gold, platinum
        birthday: null,
        rewardsRedeemed: 0
    };
    return loyaltyDB[phone];
}

function earnLoyaltyPoints(phone, amount) {
    const member = loyaltyDB[phone];
    if (!member) return 0;

    let multiplier = LOYALTY.pointsPerDollar;
    if (typeof getActiveHappyHour === 'function' && getActiveHappyHour()) {
        multiplier *= LOYALTY.bonusMultiplier.happyHour;
    }

    const points = Math.floor(amount * multiplier);
    member.points += points;
    member.totalSpent += amount;
    member.visits++;

    // Update tier
    if (member.totalSpent >= 2000) member.tier = 'platinum';
    else if (member.totalSpent >= 1000) member.tier = 'gold';
    else if (member.totalSpent >= 500) member.tier = 'silver';
    else member.tier = 'bronze';

    return points;
}

function redeemLoyaltyPoints(phone) {
    const member = loyaltyDB[phone];
    if (!member || member.points < LOYALTY.redeemThreshold) return 0;

    const redeemSets = Math.floor(member.points / LOYALTY.redeemThreshold);
    const discount = redeemSets * LOYALTY.redeemValue;
    member.points -= redeemSets * LOYALTY.redeemThreshold;
    member.rewardsRedeemed += redeemSets;

    return discount;
}

function openLoyaltyModal() {
    let modal = document.getElementById('loyalty-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loyalty-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: min(500px, 92vw); max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>Loyalty Program</h3>
                    <button class="modal-close" id="close-loyalty">&times;</button>
                </div>
                <div style="padding: 16px;">
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="tel" id="loyalty-phone" placeholder="Phone number" style="flex:1; padding:8px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.9rem; background:var(--bg-primary); color:var(--text-primary);">
                        <button class="btn-confirm" id="loyalty-lookup" style="white-space:nowrap;">Look Up</button>
                    </div>
                    <div id="loyalty-result" style="display:none;">
                        <div id="loyalty-member-card" style="padding:16px; background:var(--bg-tertiary); border-radius:var(--radius-md); margin-bottom:12px;">
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-confirm" id="loyalty-earn" style="flex:1;">Earn Points</button>
                            <button class="btn-cancel" id="loyalty-redeem" style="flex:1;">Redeem Points</button>
                        </div>
                    </div>
                    <div id="loyalty-register" style="display:none; margin-top:12px; padding:12px; border:1px dashed var(--border-color); border-radius:var(--radius-sm);">
                        <p style="margin-bottom:8px; font-size:0.85rem; color:var(--text-secondary);">Not found. Register new member:</p>
                        <input type="text" id="loyalty-new-name" placeholder="Member name" style="width:100%; padding:8px; margin-bottom:8px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.9rem; background:var(--bg-primary); color:var(--text-primary);">
                        <button class="btn-confirm" id="loyalty-reg-btn" style="width:100%;">Register</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('close-loyalty').addEventListener('click', () => modal.classList.remove('active'));

        document.getElementById('loyalty-lookup').addEventListener('click', () => {
            const phone = document.getElementById('loyalty-phone').value.replace(/\D/g, '');
            if (phone.length < 7) { showToast('Enter a valid phone number', 'error'); return; }
            const member = getLoyaltyMember(phone);
            if (member) {
                showLoyaltyMember(member);
            } else {
                document.getElementById('loyalty-result').style.display = 'none';
                document.getElementById('loyalty-register').style.display = 'block';
            }
        });

        document.getElementById('loyalty-reg-btn').addEventListener('click', () => {
            const phone = document.getElementById('loyalty-phone').value.replace(/\D/g, '');
            const name = document.getElementById('loyalty-new-name').value.trim();
            if (!name) { showToast('Enter a name', 'error'); return; }
            const member = registerLoyaltyMember(name, phone);
            showLoyaltyMember(member);
            document.getElementById('loyalty-register').style.display = 'none';
            showToast(`${name} registered for loyalty program!`);
        });

        document.getElementById('loyalty-earn').addEventListener('click', () => {
            const phone = document.getElementById('loyalty-phone').value.replace(/\D/g, '');
            const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
            if (subtotal <= 0) { showToast('No items on ticket to earn points for', 'error'); return; }
            const pts = earnLoyaltyPoints(phone, subtotal);
            showLoyaltyMember(getLoyaltyMember(phone));
            showToast(`Earned ${pts} points!`);
        });

        document.getElementById('loyalty-redeem').addEventListener('click', () => {
            const phone = document.getElementById('loyalty-phone').value.replace(/\D/g, '');
            const member = getLoyaltyMember(phone);
            if (!member || member.points < LOYALTY.redeemThreshold) {
                showToast(`Need ${LOYALTY.redeemThreshold} points to redeem (has ${member ? member.points : 0})`, 'error');
                return;
            }
            const discount = redeemLoyaltyPoints(phone);
            state.ticket.discount = { type: 'loyalty', label: 'Loyalty Reward', amount: discount };
            updateTicketDisplay();
            showLoyaltyMember(getLoyaltyMember(phone));
            showToast(`Redeemed ${formatCurrency(discount)} loyalty reward!`);
            modal.classList.remove('active');
        });
    }

    document.getElementById('loyalty-phone').value = '';
    document.getElementById('loyalty-result').style.display = 'none';
    document.getElementById('loyalty-register').style.display = 'none';
    modal.classList.add('active');
}

function showLoyaltyMember(member) {
    const tierColors = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', platinum: '#e5e4e2' };
    document.getElementById('loyalty-result').style.display = 'block';
    document.getElementById('loyalty-member-card').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
                <div style="font-weight:700; font-size:1.1rem;">${member.name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${member.phone}</div>
            </div>
            <span style="padding:4px 12px; border-radius:12px; background:${tierColors[member.tier]}; color:#333; font-weight:700; font-size:0.75rem; text-transform:uppercase;">${member.tier}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
            <div style="padding:8px; background:var(--bg-primary); border-radius:var(--radius-sm);">
                <div style="font-size:1.2rem; font-weight:700; color:var(--accent);">${member.points}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">Points</div>
            </div>
            <div style="padding:8px; background:var(--bg-primary); border-radius:var(--radius-sm);">
                <div style="font-size:1.2rem; font-weight:700;">${member.visits}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">Visits</div>
            </div>
            <div style="padding:8px; background:var(--bg-primary); border-radius:var(--radius-sm);">
                <div style="font-size:1.2rem; font-weight:700;">${formatCurrency(member.totalSpent)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">Total Spent</div>
            </div>
        </div>
        ${member.points >= LOYALTY.redeemThreshold ? '<div style="margin-top:8px; padding:6px; background:var(--success-bg); border-radius:var(--radius-sm); text-align:center; font-size:0.8rem; color:var(--success); font-weight:600;">Eligible for ' + formatCurrency(Math.floor(member.points / LOYALTY.redeemThreshold) * LOYALTY.redeemValue) + ' reward!</div>' : '<div style="margin-top:8px; font-size:0.75rem; color:var(--text-muted); text-align:center;">' + (LOYALTY.redeemThreshold - member.points) + ' more points to next reward</div>'}
    `;
}

// ==========================================
// Combo / Meal Deal Builder
// ==========================================
const COMBOS = [
    {
        id: 'combo1',
        name: 'Burger Combo',
        price: 16.99,
        savings: 4.98,
        items: [
            { category: 'popular', choices: [1, 6], label: 'Burger or Club Sandwich' },
            { category: 'sides', choices: [30, 34, 31], label: 'Fries, Onion Rings, or Coleslaw' },
            { category: 'drinks', choices: [40, 41, 44], label: 'Soda, Iced Tea, or Lemonade' }
        ]
    },
    {
        id: 'combo2',
        name: 'Steak Dinner',
        price: 34.99,
        savings: 7.47,
        items: [
            { category: 'entrees', choices: [20, 25], label: 'NY Strip or Lamb Chops' },
            { category: 'appetizers', choices: [13, 14], label: 'Soup or Bruschetta' },
            { category: 'sides', choices: [35, 37, 36], label: 'Baked Potato, Veggies, or Rice' }
        ]
    },
    {
        id: 'combo3',
        name: 'Family Feast',
        price: 49.99,
        savings: 12.96,
        items: [
            { category: 'popular', choices: [5, 3, 8], label: 'Pizza, Chicken, or Pasta' },
            { category: 'appetizers', choices: [10, 11, 12], label: 'Mozz Sticks, Wings, or Nachos' },
            { category: 'sides', choices: [30, 32, 34], label: 'Fries, Mac & Cheese, or Onion Rings' },
            { category: 'drinks', choices: [40, 41, 44, 43], label: 'Any Beverage' }
        ]
    },
    {
        id: 'combo4',
        name: 'Lunch Express',
        price: 11.99,
        savings: 3.47,
        items: [
            { category: 'popular', choices: [2, 6], label: 'Caesar Salad or Club Sandwich' },
            { category: 'drinks', choices: [40, 41, 42], label: 'Soda, Iced Tea, or Coffee' }
        ]
    }
];

function openComboModal() {
    let modal = document.getElementById('combo-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'combo-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: min(520px, 92vw); max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>Meal Combos</h3>
                    <button class="modal-close" id="close-combo">&times;</button>
                </div>
                <div id="combo-list" style="padding: 16px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-combo').addEventListener('click', () => modal.classList.remove('active'));
    }

    const list = document.getElementById('combo-list');
    list.innerHTML = COMBOS.map(combo => `
        <div class="combo-card" style="padding:14px; border:1px solid var(--border-color); border-radius:var(--radius-md); margin-bottom:10px; cursor:pointer;" data-combo-id="${combo.id}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-weight:700; font-size:1rem;">${combo.name}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.75rem; padding:2px 8px; border-radius:10px; background:var(--success-bg); color:var(--success); font-weight:600;">Save ${formatCurrency(combo.savings)}</span>
                    <span style="font-weight:700; font-size:1.1rem; color:var(--accent);">${formatCurrency(combo.price)}</span>
                </div>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">
                ${combo.items.map(slot => '<div style="margin:2px 0;">&bull; ' + slot.label + '</div>').join('')}
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.combo-card').forEach(card => {
        card.addEventListener('click', () => {
            const comboId = card.dataset.comboId;
            openComboBuilder(comboId);
        });
    });

    modal.classList.add('active');
}

function openComboBuilder(comboId) {
    const combo = COMBOS.find(c => c.id === comboId);
    if (!combo) return;

    let builder = document.getElementById('combo-builder-modal');
    if (!builder) {
        builder = document.createElement('div');
        builder.id = 'combo-builder-modal';
        builder.className = 'modal';
        builder.innerHTML = `
            <div class="modal-content" style="width: min(440px, 92vw); max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3 id="combo-builder-title">Build Your Combo</h3>
                    <button class="modal-close" id="close-combo-builder">&times;</button>
                </div>
                <div id="combo-builder-body" style="padding: 16px;"></div>
                <div style="padding: 12px 16px; border-top:1px solid var(--border-light);">
                    <button class="btn-confirm" id="combo-add-btn" style="width:100%;">Add to Order</button>
                </div>
            </div>
        `;
        document.body.appendChild(builder);
        document.getElementById('close-combo-builder').addEventListener('click', () => builder.classList.remove('active'));
    }

    document.getElementById('combo-builder-title').textContent = combo.name + ' - ' + formatCurrency(combo.price);
    const body = document.getElementById('combo-builder-body');
    body.innerHTML = combo.items.map((slot, idx) => {
        const items = slot.choices.map(itemId => {
            for (const [cat, items] of Object.entries(MENU)) {
                const found = items.find(i => i.id === itemId);
                if (found) return found;
            }
            return null;
        }).filter(Boolean);

        return `
            <div style="margin-bottom:12px;">
                <div style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">${slot.label}</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;" data-slot="${idx}">
                    ${items.map((item, iIdx) => `
                        <button class="combo-choice-btn ${iIdx === 0 ? 'combo-selected' : ''}" data-item-id="${item.id}" style="padding:6px 14px; border:2px solid ${iIdx === 0 ? 'var(--accent)' : 'var(--border-color)'}; border-radius:var(--radius-sm); background:${iIdx === 0 ? 'var(--accent-light)' : 'var(--bg-secondary)'}; color:var(--text-primary); font-size:0.85rem; cursor:pointer;">
                            ${item.name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    // Selection logic
    body.querySelectorAll('[data-slot]').forEach(slotEl => {
        slotEl.querySelectorAll('.combo-choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                slotEl.querySelectorAll('.combo-choice-btn').forEach(b => {
                    b.classList.remove('combo-selected');
                    b.style.borderColor = 'var(--border-color)';
                    b.style.background = 'var(--bg-secondary)';
                });
                btn.classList.add('combo-selected');
                btn.style.borderColor = 'var(--accent)';
                btn.style.background = 'var(--accent-light)';
            });
        });
    });

    // Add combo to ticket
    document.getElementById('combo-add-btn').onclick = () => {
        const selections = [];
        body.querySelectorAll('[data-slot]').forEach(slotEl => {
            const selected = slotEl.querySelector('.combo-selected');
            if (selected) selections.push(parseInt(selected.dataset.itemId));
        });

        if (selections.length !== combo.items.length) {
            showToast('Please select an item for each slot', 'error');
            return;
        }

        // Add combo as a single line item with sub-items
        const comboNames = selections.map(id => {
            for (const items of Object.values(MENU)) {
                const found = items.find(i => i.id === id);
                if (found) return found.name;
            }
            return '';
        });

        state.ticket.items.push({
            id: 'combo-' + combo.id + '-' + Date.now(),
            name: combo.name,
            price: combo.price,
            qty: 1,
            mods: comboNames,
            isCombo: true,
            station: 'grill'
        });

        updateTicketDisplay();
        builder.classList.remove('active');
        document.getElementById('combo-modal').classList.remove('active');
        showToast(combo.name + ' added to order');
    };

    // Close combo list, show builder
    document.getElementById('combo-modal').classList.remove('active');
    builder.classList.add('active');
}

// ==========================================
// Training Mode
// ==========================================
let trainingMode = false;

function toggleTrainingMode() {
    if (state.currentRole !== 'manager') {
        showToast('Only managers can toggle training mode', 'error');
        return;
    }

    trainingMode = !trainingMode;

    if (trainingMode) {
        document.body.classList.add('training-mode');
        showToast('TRAINING MODE ON - No orders will be processed', 'warning');
    } else {
        document.body.classList.remove('training-mode');
        showToast('Training mode disabled');
    }
}

// Intercept completePayment in training mode
const _origCompletePaymentTrain = completePayment;
completePayment = function(total, method) {
    if (trainingMode) {
        showToast('TRAINING: Payment of ' + formatCurrency(total) + ' via ' + method + ' (not processed)', 'warning');
        $('#payment-modal').classList.remove('active');
        newTicket();
        return;
    }
    _origCompletePaymentTrain(total, method);
};

// ==========================================
// Audit Log
// ==========================================
const auditLog = [];

function logAudit(action, details) {
    auditLog.push({
        timestamp: new Date().toISOString(),
        user: state.currentUser || 'system',
        role: state.currentRole,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details)
    });

    // Keep last 500 entries
    if (auditLog.length > 500) auditLog.shift();
}

// Instrument key actions
const _origAddItemDirectlyAudit = addItemDirectly;
addItemDirectly = function(menuItem, selectedMods) {
    logAudit('ADD_ITEM', menuItem.name + ' x1' + (selectedMods.length > 0 ? ' [' + selectedMods.map(m => m.name).join(', ') + ']' : ''));
    _origAddItemDirectlyAudit(menuItem, selectedMods);
};

const _origCompletePaymentAudit = completePayment;
completePayment = function(total, method) {
    logAudit('PAYMENT', 'Ticket #' + state.ticket.id + ' - ' + formatCurrency(total) + ' via ' + method);
    _origCompletePaymentAudit(total, method);
};

const _origProcessRefundAudit = typeof processRefund === 'function' ? processRefund : null;
if (_origProcessRefundAudit) {
    processRefund = function(ticketId, amount) {
        logAudit('REFUND', 'Ticket #' + ticketId + ' - ' + formatCurrency(amount));
        _origProcessRefundAudit(ticketId, amount);
    };
}

function openAuditLogModal() {
    let modal = document.getElementById('audit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'audit-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: min(600px, 95vw); max-height: 85vh;">
                <div class="modal-header">
                    <h3>Audit Log</h3>
                    <button class="modal-close" id="close-audit">&times;</button>
                </div>
                <div style="padding: 8px 16px; border-bottom: 1px solid var(--border-light); display: flex; gap: 8px;">
                    <select id="audit-filter-action" style="padding:6px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.8rem; background:var(--bg-primary); color:var(--text-primary);">
                        <option value="">All Actions</option>
                        <option value="ADD_ITEM">Add Item</option>
                        <option value="PAYMENT">Payment</option>
                        <option value="REFUND">Refund</option>
                        <option value="VOID">Void</option>
                        <option value="DISCOUNT">Discount</option>
                        <option value="LOGIN">Login</option>
                        <option value="DRAWER">Drawer</option>
                    </select>
                    <select id="audit-filter-user" style="padding:6px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.8rem; background:var(--bg-primary); color:var(--text-primary);">
                        <option value="">All Users</option>
                    </select>
                </div>
                <div id="audit-log-body" style="padding: 0; overflow-y: auto; max-height: calc(85vh - 120px);"></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-audit').addEventListener('click', () => modal.classList.remove('active'));

        document.getElementById('audit-filter-action').addEventListener('change', renderAuditLog);
        document.getElementById('audit-filter-user').addEventListener('change', renderAuditLog);
    }

    // Populate user filter
    const users = [...new Set(auditLog.map(e => e.user))];
    const userSelect = document.getElementById('audit-filter-user');
    userSelect.innerHTML = '<option value="">All Users</option>' + users.map(u => `<option value="${u}">${u}</option>`).join('');

    renderAuditLog();
    modal.classList.add('active');
}

function renderAuditLog() {
    const actionFilter = document.getElementById('audit-filter-action').value;
    const userFilter = document.getElementById('audit-filter-user').value;
    const body = document.getElementById('audit-log-body');

    let entries = [...auditLog].reverse();
    if (actionFilter) entries = entries.filter(e => e.action === actionFilter);
    if (userFilter) entries = entries.filter(e => e.user === userFilter);

    if (entries.length === 0) {
        body.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.9rem;">No audit entries found</div>';
        return;
    }

    const actionColors = {
        ADD_ITEM: 'var(--accent)',
        PAYMENT: 'var(--success)',
        REFUND: 'var(--danger)',
        VOID: 'var(--danger)',
        DISCOUNT: 'var(--warning)',
        LOGIN: '#9b59b6',
        DRAWER: '#e67e22'
    };

    body.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
            <thead>
                <tr style="background:var(--bg-tertiary); position:sticky; top:0;">
                    <th style="padding:8px; text-align:left; font-weight:600;">Time</th>
                    <th style="padding:8px; text-align:left; font-weight:600;">User</th>
                    <th style="padding:8px; text-align:left; font-weight:600;">Action</th>
                    <th style="padding:8px; text-align:left; font-weight:600;">Details</th>
                </tr>
            </thead>
            <tbody>
                ${entries.slice(0, 100).map(e => {
                    const t = new Date(e.timestamp);
                    const timeStr = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return `
                        <tr style="border-bottom:1px solid var(--border-light);">
                            <td style="padding:6px 8px; white-space:nowrap;">${timeStr}</td>
                            <td style="padding:6px 8px;">${e.user}</td>
                            <td style="padding:6px 8px;"><span style="padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:600; background:${actionColors[e.action] || 'var(--text-muted)'}22; color:${actionColors[e.action] || 'var(--text-muted)'};">${e.action}</span></td>
                            <td style="padding:6px 8px; color:var(--text-secondary);">${e.details}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Log login events
const _origLoginAudit = typeof handleLogin === 'function' ? handleLogin : null;
if (_origLoginAudit) {
    const origHandleLogin = handleLogin;
    handleLogin = function() {
        origHandleLogin.apply(this, arguments);
        if (state.currentUser) {
            logAudit('LOGIN', 'User ' + state.currentUser + ' logged in as ' + state.currentRole);
        }
    };
}

// ==========================================
// Table Merge & Transfer
// ==========================================
let pendingTransfer = null;

function startTableTransfer(sourceTable) {
    pendingTransfer = sourceTable;
    showToast('Select destination table to transfer to', 'warning');

    // Temporarily override table click to handle transfer
    document.querySelectorAll('.table-visual').forEach(el => {
        el.classList.add('transfer-target');
    });
}

function startTableMerge(sourceTable) {
    pendingTransfer = { source: sourceTable, merge: true };
    showToast('Select table to merge with', 'warning');

    document.querySelectorAll('.table-visual').forEach(el => {
        el.classList.add('transfer-target');
    });
}

// Enhance table detail modal to include merge and transfer
const _origOpenTableDetail = openTableDetailModal;
openTableDetailModal = function(tbl, data) {
    // Check if this is a transfer destination
    if (pendingTransfer) {
        const destTableNum = tbl.number;

        if (pendingTransfer.merge) {
            // Merge tables
            const srcNum = pendingTransfer.source;
            const srcData = getTableData(srcNum);
            const srcTbl = TABLES.find(t => t.number === srcNum);
            const destTbl = TABLES.find(t => t.number === destTableNum);

            if (destTbl) {
                // Combine amounts
                destTbl.amount = (destTbl.amount || 0) + (srcTbl ? srcTbl.amount || 0 : 0);
                destTbl.mergedWith = destTbl.mergedWith || [];
                destTbl.mergedWith.push(srcNum);
            }

            // Free source table
            if (srcTbl) {
                srcTbl.status = 'available';
                srcTbl.server = null;
                srcTbl.startTime = null;
                srcTbl.amount = null;
            }

            logAudit('TABLE_MERGE', `Table ${srcNum} merged into Table ${destTableNum}`);
            showToast(`Table ${srcNum} merged into Table ${destTableNum}`);

        } else {
            // Transfer table
            const srcNum = pendingTransfer;
            const srcTbl = TABLES.find(t => t.number === srcNum);
            const destTbl = TABLES.find(t => t.number === destTableNum);

            if (srcTbl && destTbl) {
                // Move occupancy data to destination
                destTbl.status = 'occupied';
                destTbl.server = srcTbl.server;
                destTbl.startTime = srcTbl.startTime;
                destTbl.amount = srcTbl.amount;

                // Clear source
                srcTbl.status = 'dirty';
                srcTbl.server = null;
                srcTbl.startTime = null;
                srcTbl.amount = null;
            }

            logAudit('TABLE_TRANSFER', `Table ${srcNum} transferred to Table ${destTableNum}`);
            showToast(`Table ${srcNum} transferred to Table ${destTableNum}`);
        }

        pendingTransfer = null;
        document.querySelectorAll('.table-visual').forEach(el => el.classList.remove('transfer-target'));
        populateTables();
        return;
    }

    // Build enhanced detail modal
    _origOpenTableDetail(tbl, data);

    // Enhance the button area
    setTimeout(() => {
        const modalContent = document.querySelector('#table-detail-modal .modal-content');
        if (!modalContent) return;

        const btnArea = modalContent.querySelector('div:last-child');
        if (btnArea && !btnArea.querySelector('.table-merge-btn')) {
            const mergeBtn = document.createElement('button');
            mergeBtn.className = 'btn-cancel table-merge-btn';
            mergeBtn.style.flex = '1';
            mergeBtn.textContent = 'Merge';
            mergeBtn.addEventListener('click', () => {
                document.getElementById('table-detail-modal').classList.remove('active');
                startTableMerge(tbl.number);
            });
            btnArea.insertBefore(mergeBtn, btnArea.querySelector('#table-detail-close'));

            // Fix the transfer button
            const transferBtn = document.getElementById('table-detail-transfer');
            if (transferBtn) {
                transferBtn.replaceWith(transferBtn.cloneNode(true));
                document.getElementById('table-detail-transfer').addEventListener('click', () => {
                    document.getElementById('table-detail-modal').classList.remove('active');
                    startTableTransfer(tbl.number);
                });
            }
        }
    }, 0);
};

// ==========================================
// Side Menu Additions (Loyalty, Combos, Training, Audit)
// ==========================================
(function addSideMenuLinks() {
    const divider = document.querySelector('.side-menu-divider');
    if (!divider) return;

    const links = [
        { id: 'menu-loyalty', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>', label: 'Loyalty Program', action: openLoyaltyModal },
        { id: 'menu-combos', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>', label: 'Meal Combos', action: openComboModal },
        { id: 'menu-training', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>', label: 'Training Mode', action: toggleTrainingMode },
        { id: 'menu-audit', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>', label: 'Audit Log', action: openAuditLogModal }
    ];

    links.forEach(link => {
        const el = document.createElement('div');
        el.className = 'side-menu-link';
        el.id = link.id;
        el.innerHTML = link.icon + ' ' + link.label;
        el.addEventListener('click', () => {
            link.action();
            document.querySelector('.side-menu').classList.remove('open');
        });
        divider.parentNode.insertBefore(el, divider);
    });
})();

// ==========================================
// Happy Hour / Scheduled Pricing
// ==========================================
const HAPPY_HOUR = {
    enabled: true,
    schedules: [
        { name: 'Happy Hour', days: [1, 2, 3, 4, 5], startHour: 16, startMin: 0, endHour: 18, endMin: 0, discountPct: 25, categories: ['drinks', 'appetizers'] },
        { name: 'Late Night', days: [4, 5, 6], startHour: 21, startMin: 0, endHour: 23, endMin: 0, discountPct: 15, categories: ['drinks'] },
        { name: 'Lunch Special', days: [1, 2, 3, 4, 5], startHour: 11, startMin: 0, endHour: 14, endMin: 0, discountPct: 10, categories: ['entrees'] }
    ]
};

function getActiveHappyHour() {
    if (!HAPPY_HOUR.enabled) return null;
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const currentMins = now.getHours() * 60 + now.getMinutes();

    for (const schedule of HAPPY_HOUR.schedules) {
        if (!schedule.days.includes(day)) continue;
        const startMins = schedule.startHour * 60 + schedule.startMin;
        const endMins = schedule.endHour * 60 + schedule.endMin;
        if (currentMins >= startMins && currentMins < endMins) {
            return schedule;
        }
    }
    return null;
}

function getHappyHourPrice(item, category) {
    const hh = getActiveHappyHour();
    if (!hh) return item.price;
    if (hh.categories.includes(category)) {
        return Math.round(item.price * (1 - hh.discountPct / 100) * 100) / 100;
    }
    return item.price;
}

function updateHappyHourBanner() {
    const banner = document.getElementById('happy-hour-banner');
    if (!banner) return;

    const hh = getActiveHappyHour();
    if (hh) {
        banner.style.display = 'flex';
        document.getElementById('hh-banner-text').textContent = `${hh.name} - ${hh.discountPct}% off ${hh.categories.join(', ')}`;
        const endStr = String(hh.endHour % 12 || 12) + ':' + String(hh.endMin).padStart(2, '0') + (hh.endHour >= 12 ? 'PM' : 'AM');
        document.getElementById('hh-banner-time').textContent = `Ends at ${endStr}`;
    } else {
        banner.style.display = 'none';
    }
}

// Check happy hour status every minute
setInterval(updateHappyHourBanner, 60000);

// ==========================================
// Course Firing for Kitchen
// ==========================================
const COURSES = ['appetizer', 'main', 'dessert'];

function assignCourses(items) {
    return items.map(item => {
        if (item.course) return item;
        // Auto-assign course based on category
        const catName = findItemCategory(item.id);
        if (catName === 'appetizers' || catName === 'sides') {
            item.course = 'appetizer';
        } else if (catName === 'desserts') {
            item.course = 'dessert';
        } else if (catName === 'drinks') {
            item.course = 'appetizer'; // drinks go with first course
        } else {
            item.course = 'main';
        }
        return item;
    });
}

function findItemCategory(itemId) {
    for (const [cat, items] of Object.entries(MENU)) {
        if (items.find(i => i.id === itemId)) return cat;
    }
    return 'entrees';
}

// Patch kitchen to show courses with fire buttons
const _origPopulateKitchenCourse = populateKitchen;
populateKitchen = function() {
    const container = $('#kds-tickets');
    container.innerHTML = '';

    let activeCount = 0;
    let totalTime = 0;

    state.kitchenOrders.forEach(order => {
        const elapsed = Math.floor((new Date() - order.time) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = minutes + ':' + String(seconds).padStart(2, '0');

        let timeClass = 'green';
        if (minutes >= 10) timeClass = 'red';
        else if (minutes >= 5) timeClass = 'yellow';

        const isUrgent = minutes >= 10;
        activeCount++;
        totalTime += elapsed;

        // Group items by course
        const items = assignCourses([...order.items]);
        const courseGroups = {};
        items.forEach(item => {
            const c = item.course || 'main';
            if (!courseGroups[c]) courseGroups[c] = [];
            courseGroups[c].push(item);
        });

        const el = document.createElement('div');
        el.className = 'kds-ticket' + (isUrgent ? ' urgent' : '');

        let coursesHtml = '';
        COURSES.forEach(course => {
            if (!courseGroups[course]) return;
            const fired = order.firedCourses && order.firedCourses.includes(course);
            coursesHtml += `
                <div class="kds-course ${fired ? 'kds-course-fired' : ''}">
                    <div class="kds-course-header">
                        <span class="kds-course-name">${course.toUpperCase()}</span>
                        ${!fired ? `<button class="kds-fire-btn" data-order-id="${order.id}" data-course="${course}">FIRE</button>` : '<span class="kds-fired-label">FIRED</span>'}
                    </div>
                    ${courseGroups[course].map(item => `
                        <div class="kds-item">
                            <span class="kds-item-name">${item.name}</span>
                            <span class="kds-item-qty">x${item.qty}</span>
                            ${item.note ? '<div class="kds-item-note">' + item.note + '</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        });

        el.innerHTML = `
            <div class="kds-ticket-header">
                <span>#${order.id} - ${order.type}</span>
                <span class="kds-ticket-time ${timeClass}">${timeStr}</span>
            </div>
            ${order.server ? '<div class="kds-ticket-server">Server: ' + order.server + (order.table ? ' | T' + order.table : '') + '</div>' : ''}
            <div class="kds-ticket-courses">${coursesHtml}</div>
            <div class="kds-ticket-footer">
                <button class="kds-reprint-btn" data-order-id="${order.id}">REPRINT</button>
                <button class="kds-bump-btn" data-order-id="${order.id}">BUMP ALL</button>
            </div>
        `;

        // Fire course buttons
        el.querySelectorAll('.kds-fire-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = parseInt(btn.dataset.orderId);
                const course = btn.dataset.course;
                const o = state.kitchenOrders.find(ko => ko.id === orderId);
                if (o) {
                    if (!o.firedCourses) o.firedCourses = [];
                    o.firedCourses.push(course);
                    showToast(`Course "${course}" fired for #${orderId}`);
                    populateKitchen();
                }
            });
        });

        // Reprint button
        const reprintBtn = el.querySelector('.kds-reprint-btn');
        if (reprintBtn) {
            reprintBtn.addEventListener('click', () => {
                if (typeof printKitchenOrder === 'function') {
                    printKitchenOrder(parseInt(reprintBtn.dataset.orderId));
                }
            });
        }

        // Bump button
        el.querySelector('.kds-bump-btn').addEventListener('click', () => {
            state.kitchenOrders = state.kitchenOrders.filter(o => o.id !== order.id);
            showToast('Order #' + order.id + ' bumped');
            populateKitchen();
        });

        container.appendChild(el);
    });

    $('#kds-active').textContent = activeCount;
    const avgSeconds = activeCount > 0 ? Math.floor(totalTime / activeCount) : 0;
    $('#kds-avg-time').textContent = Math.floor(avgSeconds / 60) + ':' + String(avgSeconds % 60).padStart(2, '0');
};

// ==========================================
// Receipt Reprint from Ticket History
// ==========================================
const _origPopulateTicketsReprint = populateTicketsList;
populateTicketsList = function() {
    _origPopulateTicketsReprint();

    const container = document.getElementById('tickets-list');
    if (!container) return;

    container.querySelectorAll('.ticket-card').forEach((el, idx) => {
        const ticket = state.allTickets[idx];
        if (!ticket) return;

        // Add action buttons row
        const actionsRow = document.createElement('div');
        actionsRow.className = 'ticket-card-actions-row';

        if (ticket.paid) {
            actionsRow.innerHTML += `<button class="ticket-action-sm" onclick="reprintReceipt(${ticket.id})">Reprint</button>`;
        }
        if (ticket.status === 'open') {
            actionsRow.innerHTML += `<button class="ticket-action-sm ticket-action-recall" onclick="recallTicket(${ticket.id})">Recall</button>`;
        }

        el.appendChild(actionsRow);
    });
};

function reprintReceipt(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket) {
        showToast('Ticket not found', 'error');
        return;
    }
    printReceipt(ticket);
    showToast('Receipt reprinted for #' + ticketId);
}
window.reprintReceipt = reprintReceipt;

function recallTicket(ticketId) {
    const ticket = state.allTickets.find(t => t.id === ticketId);
    if (!ticket || ticket.status !== 'open') {
        showToast('Cannot recall this ticket', 'error');
        return;
    }
    // Load it into the current ticket
    state.ticket = {
        id: ticket.id,
        type: ticket.type,
        items: [...ticket.items],
        table: ticket.table,
        server: ticket.server,
        discount: ticket.discount,
        note: ticket.note
    };
    updateTicketDisplay();
    switchToView('order');
    showToast('Ticket #' + ticketId + ' recalled');
}
window.recallTicket = recallTicket;

// ==========================================
// Table Reservation System
// ==========================================
const reservations = [];
const reservationModal = document.getElementById('reservation-modal');

document.getElementById('close-reservation').addEventListener('click', () => {
    reservationModal.classList.remove('active');
});

document.getElementById('btn-reservations').addEventListener('click', () => {
    openReservationModal();
});

function openReservationModal() {
    reservationModal.classList.add('active');

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('res-date').value = today;

    // Populate table dropdown
    const tableSelect = document.getElementById('res-table');
    tableSelect.innerHTML = '<option value="">Auto-assign</option>';
    TABLES.forEach(t => {
        tableSelect.innerHTML += `<option value="${t.number}">Table ${t.number} (${t.seats} seats)</option>`;
    });

    refreshReservationList();
}

function refreshReservationList() {
    const today = new Date().toDateString();
    const todayRes = reservations.filter(r => new Date(r.date + 'T' + r.time).toDateString() === today && r.status !== 'cancelled');
    const upcoming = reservations.filter(r => {
        const d = new Date(r.date + 'T' + r.time);
        return d > new Date() && d.toDateString() !== today && r.status !== 'cancelled';
    });

    // Today's list
    const listEl = document.getElementById('res-list');
    if (todayRes.length === 0) {
        listEl.innerHTML = '<p class="res-empty">No reservations today</p>';
    } else {
        listEl.innerHTML = todayRes.sort((a, b) => a.time.localeCompare(b.time)).map((r, idx) => {
            const timeStr = formatResTime(r.time);
            return `
                <div class="res-card ${r.status}">
                    <div class="res-card-header">
                        <strong>${r.name}</strong>
                        <span class="res-time">${timeStr}</span>
                    </div>
                    <div class="res-card-details">
                        <span>Party of ${r.partySize}</span>
                        ${r.table ? '<span>Table ' + r.table + '</span>' : ''}
                        ${r.phone ? '<span>' + r.phone + '</span>' : ''}
                    </div>
                    ${r.notes ? '<div class="res-card-notes">' + r.notes + '</div>' : ''}
                    <div class="res-card-actions">
                        <button class="res-btn-sm" onclick="seatReservation(${reservations.indexOf(r)})">Seat</button>
                        <button class="res-btn-sm res-btn-noshow" onclick="noShowReservation(${reservations.indexOf(r)})">No Show</button>
                        <button class="res-btn-sm res-btn-cancel" onclick="cancelReservation(${reservations.indexOf(r)})">Cancel</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Upcoming list
    const upEl = document.getElementById('res-upcoming');
    if (upcoming.length === 0) {
        upEl.innerHTML = '<p class="res-empty">No upcoming reservations</p>';
    } else {
        upEl.innerHTML = upcoming.slice(0, 10).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(r => {
            const dateStr = new Date(r.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `
                <div class="res-upcoming-row">
                    <span>${dateStr} ${formatResTime(r.time)}</span>
                    <span>${r.name} (${r.partySize})</span>
                </div>
            `;
        }).join('');
    }
}

function formatResTime(time) {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

document.getElementById('res-save-btn').addEventListener('click', () => {
    const name = document.getElementById('res-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    const res = {
        name,
        partySize: parseInt(document.getElementById('res-party-size').value) || 2,
        date: document.getElementById('res-date').value,
        time: document.getElementById('res-time').value,
        phone: document.getElementById('res-phone').value.trim(),
        table: document.getElementById('res-table').value || null,
        notes: document.getElementById('res-notes').value.trim(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        createdBy: state.currentUser
    };

    reservations.push(res);

    // If table assigned, mark it as reserved
    if (res.table) {
        const tbl = TABLES.find(t => t.number === parseInt(res.table));
        if (tbl) tbl.status = 'reserved';
        populateTables();
    }

    // Clear form
    document.getElementById('res-name').value = '';
    document.getElementById('res-phone').value = '';
    document.getElementById('res-notes').value = '';
    document.getElementById('res-party-size').value = '2';
    document.getElementById('res-table').value = '';

    refreshReservationList();
    showToast(`Reservation for ${name} at ${formatResTime(res.time)}`);
});

function seatReservation(idx) {
    const res = reservations[idx];
    if (!res) return;
    res.status = 'seated';

    // Find a table
    let table = res.table ? TABLES.find(t => t.number === parseInt(res.table)) : null;
    if (!table) {
        table = TABLES.find(t => t.status === 'available' && t.seats >= res.partySize);
    }

    if (table) {
        table.status = 'occupied';
        table.server = state.currentUser;
        table.startTime = new Date().toISOString();
        state.ticket.table = table.number;
        populateTables();
    }

    refreshReservationList();
    showToast(`${res.name} seated${table ? ' at Table ' + table.number : ''}`);
}
window.seatReservation = seatReservation;

function noShowReservation(idx) {
    const res = reservations[idx];
    if (!res) return;
    res.status = 'noshow';
    if (res.table) {
        const tbl = TABLES.find(t => t.number === parseInt(res.table));
        if (tbl && tbl.status === 'reserved') tbl.status = 'available';
        populateTables();
    }
    refreshReservationList();
    showToast(`${res.name} marked as no-show`);
}
window.noShowReservation = noShowReservation;

function cancelReservation(idx) {
    const res = reservations[idx];
    if (!res) return;
    res.status = 'cancelled';
    if (res.table) {
        const tbl = TABLES.find(t => t.number === parseInt(res.table));
        if (tbl && tbl.status === 'reserved') tbl.status = 'available';
        populateTables();
    }
    refreshReservationList();
    showToast(`Reservation for ${res.name} cancelled`);
}
window.cancelReservation = cancelReservation;

// ==========================================
// Accessibility (ARIA)
// ==========================================
function enhanceAccessibility() {
    // Add ARIA roles to main navigation
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.setAttribute('role', 'navigation');

    const tabCenter = document.querySelector('.top-bar-center');
    if (tabCenter) {
        tabCenter.setAttribute('role', 'tablist');
        tabCenter.querySelectorAll('.tab-btn').forEach(btn => {
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', btn.classList.contains('active'));
        });
    }

    // Add ARIA to views
    document.querySelectorAll('.main-view').forEach(view => {
        view.setAttribute('role', 'tabpanel');
        view.setAttribute('aria-hidden', !view.classList.contains('active'));
    });

    // Add ARIA to modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        const header = modal.querySelector('.modal-header h3');
        if (header) {
            const id = modal.id + '-title';
            header.id = id;
            modal.setAttribute('aria-labelledby', id);
        }
    });

    // Add ARIA to menu grid
    const menuGrid = document.getElementById('menu-grid');
    if (menuGrid) {
        menuGrid.setAttribute('role', 'grid');
        menuGrid.setAttribute('aria-label', 'Menu items');
    }

    // Category tabs
    const catTabs = document.getElementById('category-tabs');
    if (catTabs) {
        catTabs.setAttribute('role', 'tablist');
        catTabs.querySelectorAll('.category-tab').forEach(tab => {
            tab.setAttribute('role', 'tab');
        });
    }

    // Ticket items
    const ticketItems = document.getElementById('ticket-items');
    if (ticketItems) {
        ticketItems.setAttribute('role', 'list');
        ticketItems.setAttribute('aria-label', 'Order items');
    }

    // Live region for toasts
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.setAttribute('role', 'status');
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
    }

    // Add labels to icon buttons
    const iconLabels = {
        'btn-theme': 'Toggle dark mode',
        'btn-fullscreen': 'Toggle fullscreen',
        'btn-logout': 'Logout',
        'btn-menu': 'Open side menu'
    };

    Object.entries(iconLabels).forEach(([id, label]) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('aria-label', label);
    });

    // Add skip link
    const skipLink = document.createElement('a');
    skipLink.href = '#order-view';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    document.body.prepend(skipLink);
}

// Update ARIA on view switch
const _origSwitchToViewAria = switchToView;
switchToView = function(viewName) {
    _origSwitchToViewAria(viewName);

    // Update ARIA states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.setAttribute('aria-selected', btn.classList.contains('active'));
    });
    document.querySelectorAll('.main-view').forEach(view => {
        view.setAttribute('aria-hidden', !view.classList.contains('active'));
    });
};

// ==========================================
// Service Worker Registration
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            // SW registered successfully
        }).catch(() => {
            // SW registration failed - app still works without it
        });
    });
}

// ==========================================
// Initialize
// ==========================================
loadState();
populateMenu();
updateHappyHourBanner();
enhanceAccessibility();
