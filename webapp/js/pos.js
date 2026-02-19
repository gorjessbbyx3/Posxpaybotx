/**
 * POS Main - Core POS Operations
 *
 * This is the main POS module containing login, menu, ticket management,
 * payment, discounts, delivery, reports, and other core features.
 *
 * Dependencies (must be loaded before this file):
 *   - pos-core.js (CONFIG, MENU, state, utilities)
 *   - calculations.js (pure business logic)
 *   - api-client.js (API bridge)
 *
 * Loaded after this file:
 *   - pos-kitchen.js (KDS, course firing, kitchen printing)
 *   - pos-tables.js (table management, reservations, merge/transfer)
 *   - pos-loyalty.js (loyalty program, combos, training, audit log)
 */


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

    // Authenticate with API backend
    if (typeof APIClient !== 'undefined') {
        APIClient.login(pin).then(res => {
            if (res && res.token) APIClient.setToken(res.token);
        }).catch(() => {
            // API unavailable - continue with local-only mode
        });
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
    if (typeof populateTables === 'function') populateTables();
    if (typeof populateKitchen === 'function') populateKitchen();

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

    // Sync to API backend
    if (typeof APIClient !== 'undefined') {
        APIClient.clockIn(state.currentStaff.id, state.currentUser, state.currentRole).catch(() => {});
    }

    showToast('Clocked in at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
}

function clockOut() {
    if (!state.currentStaff) return;
    const record = timeClock.filter(r => r.empId === state.currentStaff.id && !r.clockOut).pop();
    if (record) {
        record.clockOut = new Date();
        const hours = ((record.clockOut - record.clockIn) / 3600000).toFixed(2);
        state.clockedIn = false;

        // Sync to API backend
        if (typeof APIClient !== 'undefined') {
            APIClient.clockOut(state.currentStaff.id).catch(() => {});
        }

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
    if (typeof printKitchenTickets === 'function') printKitchenTickets(kitchenOrder);

    // Sync to API backend
    if (typeof APIClient !== 'undefined') {
        APIClient.createTicket(state.allTickets[state.allTickets.length - 1]).catch(() => {});
        APIClient.sendToKitchen(kitchenOrder.id, kitchenOrder.items).catch(() => {});
    }

    showToast('Order #' + state.ticket.id + ' sent to kitchen');
    newTicket();
    if (typeof populateKitchen === 'function') populateKitchen();
});


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

        // Sync payment to API backend
        if (typeof APIClient !== 'undefined') {
            APIClient.payTicket(t.id, method, t.tip || 0).catch(() => {});
        }

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

        // Sync void to API backend
        if (typeof APIClient !== 'undefined') {
            APIClient.voidTicket(ticketId, state.currentUser, 'User void').catch(() => {});
        }

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

        // Sync refund to API backend
        if (typeof APIClient !== 'undefined') {
            APIClient.createRefund(ticket.id, refundAmount, reason, isPartial ? 'partial' : 'full', state.currentUser).catch(() => {});
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
