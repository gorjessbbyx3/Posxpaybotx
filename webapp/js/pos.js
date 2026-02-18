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
    showToast('Batch settlement initiated - sending to terminal...', 'warning');
    setTimeout(() => showToast('Batch settled successfully'), 2000);
});

$('#btn-print-report').addEventListener('click', () => {
    window.print();
});

$('#btn-eod').addEventListener('click', () => {
    if (confirm('Close the day? This will settle the batch and generate the EOD report.')) {
        state.allTickets.forEach(t => {
            t.status = 'closed';
        });
        populateReports();
        showToast('Day closed. EOD report generated.');
    }
});

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
