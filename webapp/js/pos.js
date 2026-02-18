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
    const existing = state.ticket.items.find(i => i.id === menuItem.id);
    if (existing) {
        existing.qty++;
    } else {
        state.ticket.items.push({
            ...menuItem,
            qty: 1,
            mods: []
        });
    }
    updateTicketDisplay();
}

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

    const tax = subtotal * (CONFIG.taxRate / 100);
    const total = subtotal + tax;
    updateTotals(subtotal, tax, total);
}

// Make functions global for onclick handlers
window.updateItemQty = updateItemQty;
window.removeFromTicket = removeFromTicket;

function updateTotals(subtotal, tax, total) {
    $('#subtotal').textContent = formatCurrency(subtotal);
    $('#tax-amount').textContent = formatCurrency(tax);
    $('#total-amount').textContent = formatCurrency(total);

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
// Order Type
// ==========================================
$('#order-type-select').addEventListener('change', (e) => {
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
    showToast('Discount dialog', 'warning');
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
// Initialize
// ==========================================
populateMenu();
