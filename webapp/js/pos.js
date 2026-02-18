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
// Application State
// ==========================================
const state = {
    currentUser: null,
    currentRole: 'server',
    pin: '',
    currentCategory: 'popular',
    currentView: 'order',
    ticket: {
        id: null,
        type: 'dine-in',
        items: [],
        table: null
    },
    ticketCounter: 1001,
    kitchenOrders: [],
    paymentMethod: 'cash',
    tenderedAmount: '',
    allTickets: []
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
        state.currentRole = btn.dataset.user;
        state.currentUser = btn.dataset.user.charAt(0).toUpperCase() + btn.dataset.user.slice(1);
        doLogin('quick');
    });
});

function updatePinDots() {
    const dots = $$('.pin-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < state.pin.length);
    });
}

function doLogin(pin) {
    if (!state.currentUser) {
        state.currentUser = 'User';
        state.currentRole = 'server';
    }
    $('#current-user').textContent = state.currentUser;
    $('#login-screen').classList.remove('active');
    $('#pos-screen').classList.add('active');
    newTicket();
    showToast('Welcome, ' + state.currentUser + '!');
    populateMenu();
    populateTables();
    populateKitchen();
}

$('#btn-logout').addEventListener('click', () => {
    state.currentUser = null;
    state.pin = '';
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
        populateMenu();
    });
});

function populateMenu() {
    const grid = $('#menu-grid');
    const items = MENU[state.currentCategory] || [];
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
        table: null
    };
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

    state.allTickets.push({
        id: state.ticket.id,
        server: state.currentUser,
        type: state.ticket.type,
        items: [...state.ticket.items],
        subtotal, tax, total,
        status: 'open',
        paid: false,
        time: new Date()
    });

    showToast('Order #' + state.ticket.id + ' sent to kitchen');
    newTicket();
    populateKitchen();
});

$('#btn-hold').addEventListener('click', () => {
    if (state.ticket.items.length === 0) return;
    showToast('Order #' + state.ticket.id + ' held');
    newTicket();
});

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
        state.allTickets[ticketIndex].status = 'paid';
        state.allTickets[ticketIndex].paid = true;
        state.allTickets[ticketIndex].paymentMethod = method;
    }

    $('#payment-modal').classList.remove('active');
    showToast('Payment received - Ticket #' + state.ticket.id + ' (' + method + ')');
    newTicket();
}

// ==========================================
// Table Management
// ==========================================
function populateTables() {
    const grid = $('#table-grid');
    grid.innerHTML = '';

    TABLES.forEach(table => {
        const el = document.createElement('button');
        el.className = 'table-card ' + table.status;
        el.innerHTML = `
            <span class="table-number">${table.number}</span>
            <span class="table-seats">${table.seats} seats</span>
            ${table.amount ? '<span class="table-amount">' + formatCurrency(table.amount) + '</span>' : ''}
        `;
        el.addEventListener('click', () => {
            if (table.status === 'available') {
                table.status = 'occupied';
                state.ticket.table = table.number;
                showToast('Table ' + table.number + ' assigned');
            } else if (table.status === 'occupied') {
                showToast('Table ' + table.number + ' - Open ticket', 'warning');
            }
            populateTables();
        });
        grid.appendChild(el);
    });
}

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
// Enhanced Ticket Filters
// ==========================================
let activeTicketFilter = 'open';

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

        el.innerHTML = `
            <div class="ticket-card-header">
                <span class="ticket-card-id">#${ticket.id}</span>
                <span class="ticket-card-status ${ticket.status}">${ticket.status}</span>
            </div>
            <div class="ticket-card-details">
                ${ticket.server} &bull; ${ticket.type} &bull; ${ticket.items.length} items &bull; ${timeStr}
            </div>
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
                <button class="ticket-action-btn reprint" onclick="reprintTicket(${ticket.id})">Reprint</button>
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

function reprintTicket(ticketId) {
    showToast('Reprinting ticket #' + ticketId + '...', 'warning');
}
window.reprintTicket = reprintTicket;

// ==========================================
// Enhanced Reports with Tips Tracking
// ==========================================
const _origPopulateReports = populateReports;
populateReports = function() {
    const today = new Date().toISOString().split('T')[0];
    $('#report-date').value = today;

    let totalSales = 0;
    let totalTax = 0;
    let totalTips = 0;
    let totalDiscounts = 0;
    let cashSales = 0;
    let cardSales = 0;
    let ticketCount = state.allTickets.length;
    const rate = CONFIG.cashDiscount.rate / 100;

    state.allTickets.forEach(t => {
        totalSales += t.total;
        totalTax += t.tax;
        if (t.tip) totalTips += t.tip;
        if (t.paymentMethod === 'cash') {
            cashSales += t.total;
            if (CONFIG.cashDiscount.enabled && CONFIG.cashDiscount.mode === 'CASH_DISCOUNT') {
                totalDiscounts += t.total * rate;
            }
        } else {
            cardSales += t.total;
            if (CONFIG.cashDiscount.enabled && CONFIG.cashDiscount.mode === 'CARD_SURCHARGE') {
                totalDiscounts -= t.total * rate; // surcharge is negative discount
            }
        }
    });

    const avgTicket = ticketCount > 0 ? totalSales / ticketCount : 0;

    $('#report-total-sales').textContent = formatCurrency(totalSales);
    $('#report-ticket-count').textContent = ticketCount;
    $('#report-avg-ticket').textContent = formatCurrency(avgTicket);
    $('#report-cash-sales').textContent = formatCurrency(cashSales);
    $('#report-card-sales').textContent = formatCurrency(cardSales);
    $('#report-tax').textContent = formatCurrency(totalTax);
    $('#report-discounts').textContent = formatCurrency(Math.abs(totalDiscounts));
    $('#report-tips').textContent = formatCurrency(totalTips);
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

// Clock in/out
document.getElementById('menu-clock-in').addEventListener('click', () => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    showToast('Clock in recorded at ' + now);
    $('#side-menu').classList.remove('open');
    document.querySelector('.side-menu-overlay').classList.remove('active');
});

// Open cash drawer
document.getElementById('menu-open-drawer').addEventListener('click', () => {
    showToast('Cash drawer opened');
    $('#side-menu').classList.remove('open');
    document.querySelector('.side-menu-overlay').classList.remove('active');
});

// ==========================================
// Initialize
// ==========================================
populateMenu();
