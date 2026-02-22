/**
 * POS Extras - Waitlist, Auto-Gratuity, Allergens, Void Reasons
 *
 * Depends on: pos-core.js, calculations.js, pos.js
 * Must be loaded AFTER pos.js
 */

// ==========================================
// 1. WAITLIST MANAGEMENT SYSTEM
// ==========================================
const waitlist = [];
let waitlistCounter = 1;

function openWaitlistModal() {
    const modal = $('#waitlist-modal');
    if (!modal) return;
    refreshWaitlist();
    modal.classList.add('active');
}

function addToWaitlist() {
    const name = $('#wl-name').value.trim();
    const partySize = parseInt($('#wl-party-size').value) || 2;
    const phone = $('#wl-phone').value.trim();
    const notes = $('#wl-notes').value.trim();

    if (!name) {
        showToast('Please enter guest name', 'warning');
        return;
    }

    const entry = {
        id: waitlistCounter++,
        name,
        partySize,
        phone,
        notes,
        addedAt: new Date(),
        status: 'waiting', // waiting, notified, seated, left
        estimatedWait: estimateWaitTime(partySize),
        notifiedAt: null
    };

    waitlist.push(entry);

    // Sync to API backend
    if (typeof APIClient !== 'undefined') {
        APIClient.addToWaitlist(entry).catch(() => {});
    }

    showToast(name + ' added to waitlist (' + entry.estimatedWait + ' min est.)');
    refreshWaitlist();

    // Clear form
    $('#wl-name').value = '';
    $('#wl-party-size').value = '2';
    $('#wl-phone').value = '';
    $('#wl-notes').value = '';
}

function estimateWaitTime(partySize) {
    // Estimate based on occupied tables and party size
    const occupiedCount = TABLES.filter(t => t.status === 'occupied').length;
    const totalTables = TABLES.length;
    const occupancyRate = occupiedCount / totalTables;

    let baseWait = 15; // minutes
    if (occupancyRate > 0.8) baseWait = 30;
    else if (occupancyRate > 0.5) baseWait = 20;

    // Larger parties wait longer (harder to find tables)
    if (partySize >= 6) baseWait += 15;
    else if (partySize >= 4) baseWait += 5;

    return baseWait;
}

function refreshWaitlist() {
    const list = $('#wl-list');
    if (!list) return;

    const activeEntries = waitlist.filter(e => e.status === 'waiting' || e.status === 'notified');
    if (activeEntries.length === 0) {
        list.innerHTML = '<p class="res-empty">Waitlist is empty</p>';
        updateWaitlistCount();
        return;
    }

    list.innerHTML = activeEntries.map(entry => {
        const elapsed = Math.floor((new Date() - entry.addedAt) / 60000);
        const isOverdue = elapsed > entry.estimatedWait;
        const statusClass = entry.status === 'notified' ? 'wl-notified' : (isOverdue ? 'wl-overdue' : '');

        return `
            <div class="wl-entry ${statusClass}" data-id="${entry.id}">
                <div class="wl-entry-info">
                    <strong>${escapeHtml(entry.name)}</strong>
                    <span class="wl-party">Party of ${parseInt(entry.partySize) || 0}</span>
                    ${entry.phone ? '<span class="wl-phone">' + escapeHtml(entry.phone) + '</span>' : ''}
                    ${entry.notes ? '<span class="wl-note">' + escapeHtml(entry.notes) + '</span>' : ''}
                </div>
                <div class="wl-entry-time">
                    <span class="wl-elapsed ${isOverdue ? 'overdue' : ''}">${elapsed}m wait</span>
                    <span class="wl-est">Est: ${entry.estimatedWait}m</span>
                </div>
                <div class="wl-entry-actions">
                    ${entry.status !== 'notified' ? '<button class="wl-btn wl-notify-btn" onclick="notifyWaitlistGuest(' + entry.id + ')">Notify</button>' : '<span class="wl-notified-label">Notified</span>'}
                    <button class="wl-btn wl-seat-btn" onclick="seatWaitlistGuest(${entry.id})">Seat</button>
                    <button class="wl-btn wl-remove-btn" onclick="removeFromWaitlist(${entry.id})">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    updateWaitlistCount();
}

function updateWaitlistCount() {
    const badge = $('#wl-count-badge');
    if (!badge) return;
    const count = waitlist.filter(e => e.status === 'waiting' || e.status === 'notified').length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function notifyWaitlistGuest(id) {
    const entry = waitlist.find(e => e.id === id);
    if (!entry) return;
    entry.status = 'notified';
    entry.notifiedAt = new Date();
    showToast(entry.name + ' has been notified - table ready');
    refreshWaitlist();
}

function seatWaitlistGuest(id) {
    const entry = waitlist.find(e => e.id === id);
    if (!entry) return;

    // Find a suitable available table
    const suitableTable = TABLES.find(t => t.status === 'available' && t.seats >= entry.partySize);
    if (suitableTable) {
        suitableTable.status = 'occupied';
        suitableTable.amount = '0.00';
        entry.status = 'seated';
        entry.seatedAt = new Date();

        // Sync to API backend
        if (typeof APIClient !== 'undefined') {
            APIClient.updateWaitlistEntry(id, { status: 'seated' }).catch(() => {});
        }

        showToast(entry.name + ' seated at Table ' + suitableTable.number);
        if (typeof populateTables === 'function') populateTables();
    } else {
        showToast('No suitable table available for party of ' + entry.partySize, 'warning');
    }
    refreshWaitlist();
}

function removeFromWaitlist(id) {
    const entry = waitlist.find(e => e.id === id);
    if (!entry) return;
    entry.status = 'left';
    showToast(entry.name + ' removed from waitlist');
    refreshWaitlist();
}

// Expose to window for onclick handlers
window.notifyWaitlistGuest = notifyWaitlistGuest;
window.seatWaitlistGuest = seatWaitlistGuest;
window.removeFromWaitlist = removeFromWaitlist;

// Wire waitlist button
const btnWaitlist = $('#btn-waitlist');
if (btnWaitlist) {
    btnWaitlist.addEventListener('click', openWaitlistModal);
}

// ==========================================
// 2. AUTO-GRATUITY FOR LARGE PARTIES
// ==========================================
const AUTO_GRATUITY_CONFIG = {
    enabled: true,
    minPartySize: 6,
    percentage: 18
};

// Monkey-patch openPayment to inject auto-gratuity for large parties
const _origOpenPayment = typeof openPayment === 'function' ? openPayment : null;

if (_origOpenPayment) {
    openPayment = function(method) {
        // Check if auto-gratuity applies
        const partySize = getTicketPartySize();

        if (AUTO_GRATUITY_CONFIG.enabled && partySize >= AUTO_GRATUITY_CONFIG.minPartySize) {
            // Calculate on post-discount subtotal (gratuity should not include discounted amount)
            const subtotal = state.ticket.items.reduce((s, i) => s + Math.round(i.price * i.qty * 100) / 100, 0);
            const discountAmt = state.ticket.discount ? (state.ticket.discount.amount || 0) : 0;
            const afterDiscount = Math.round(Math.max(0, subtotal - discountAmt) * 100) / 100;
            let gratAmount = 0;

            if (typeof Calculations !== 'undefined' && typeof Calculations.autoGratuity === 'function') {
                gratAmount = Calculations.autoGratuity(afterDiscount, partySize, AUTO_GRATUITY_CONFIG);
            } else {
                gratAmount = Math.round(afterDiscount * (AUTO_GRATUITY_CONFIG.percentage / 100) * 100) / 100;
            }

            if (gratAmount > 0) {
                state.ticket.autoGratuity = gratAmount;
                state.ticket.autoGratuityRate = AUTO_GRATUITY_CONFIG.percentage;
            }
        } else {
            state.ticket.autoGratuity = 0;
        }

        // Call original
        _origOpenPayment(method);

        // Show auto-gratuity notice in payment modal
        showAutoGratuityNotice();
    };
}

function getTicketPartySize() {
    // Only use explicitly set party size - never infer from table seats
    // (table seats != actual party size; a 2-person party at a 6-seat table shouldn't trigger auto-gratuity)
    return state.ticket.partySize || 0;
}

function showAutoGratuityNotice() {
    // Remove any existing notice
    const existing = document.querySelector('.auto-grat-notice');
    if (existing) existing.remove();

    if (!state.ticket.autoGratuity || state.ticket.autoGratuity <= 0) return;

    const notice = document.createElement('div');
    notice.className = 'auto-grat-notice';
    notice.innerHTML = `
        <div class="auto-grat-icon">&#x1F464;</div>
        <div class="auto-grat-text">
            <strong>${AUTO_GRATUITY_CONFIG.percentage}% Auto-Gratuity Applied</strong>
            <span>Party of ${getTicketPartySize()} (min ${AUTO_GRATUITY_CONFIG.minPartySize})</span>
        </div>
        <div class="auto-grat-amount">${formatCurrency(state.ticket.autoGratuity)}</div>
    `;

    const paymentSummary = document.querySelector('.payment-summary-panel');
    if (paymentSummary) {
        paymentSummary.appendChild(notice);
    }
}

// Register auto-gratuity as a beforeComplete hook (adjusts total before payment)
registerHook('beforeComplete', function(total, method) {
    if (state.ticket.autoGratuity && state.ticket.autoGratuity > 0) {
        const adjustedTotal = total + state.ticket.autoGratuity;
        // Store on ticket for receipt
        const t = state.allTickets.find(t => t.id === state.ticket.id);
        if (t) {
            t.autoGratuity = state.ticket.autoGratuity;
            t.autoGratuityRate = state.ticket.autoGratuityRate;
            t.tip = (t.tip || 0) + state.ticket.autoGratuity;
        }
        return adjustedTotal;
    }
    return total;
});

// Allow setting party size on a ticket
function setTicketPartySize(size) {
    state.ticket.partySize = size;
    if (size >= AUTO_GRATUITY_CONFIG.minPartySize) {
        showToast('Auto-gratuity (' + AUTO_GRATUITY_CONFIG.percentage + '%) will apply for party of ' + size, 'warning');
    }
}
window.setTicketPartySize = setTicketPartySize;

// ==========================================
// 3. ALLERGEN / DIETARY TRACKING
// ==========================================
const ALLERGENS = {
    gluten: { label: 'Gluten', icon: 'G', color: '#e6a817' },
    dairy: { label: 'Dairy', icon: 'D', color: '#4a90d9' },
    nuts: { label: 'Tree Nuts', icon: 'N', color: '#8b4513' },
    peanuts: { label: 'Peanuts', icon: 'P', color: '#c98a5e' },
    shellfish: { label: 'Shellfish', icon: 'SF', color: '#e74c3c' },
    soy: { label: 'Soy', icon: 'S', color: '#7eb44d' },
    eggs: { label: 'Eggs', icon: 'E', color: '#f0c040' },
    fish: { label: 'Fish', icon: 'F', color: '#2196f3' }
};

const DIETARY_FLAGS = {
    vegetarian: { label: 'Vegetarian', icon: 'V', color: '#27ae60' },
    vegan: { label: 'Vegan', icon: 'VG', color: '#2ecc71' },
    gf: { label: 'Gluten-Free', icon: 'GF', color: '#e67e22' },
    spicy: { label: 'Spicy', icon: '!', color: '#e74c3c' }
};

// Allergen data for menu items (by item ID)
const ITEM_ALLERGENS = {
    1: { allergens: ['gluten', 'dairy'], dietary: [] },           // Cheeseburger
    2: { allergens: ['dairy', 'eggs'], dietary: [] },              // Caesar Salad
    3: { allergens: [], dietary: [] },                              // Grilled Chicken
    4: { allergens: ['gluten', 'fish'], dietary: [] },             // Fish & Chips
    5: { allergens: ['gluten', 'dairy'], dietary: ['vegetarian'] }, // Margherita Pizza
    6: { allergens: ['gluten', 'dairy', 'eggs'], dietary: [] },    // Club Sandwich
    7: { allergens: [], dietary: [] },                              // Steak Frites
    8: { allergens: ['gluten', 'dairy', 'eggs'], dietary: ['vegetarian'] }, // Pasta Alfredo
    10: { allergens: ['gluten', 'dairy'], dietary: ['vegetarian'] }, // Mozzarella Sticks
    11: { allergens: ['gluten'], dietary: [] },                     // Wings
    12: { allergens: ['dairy'], dietary: [] },                      // Nachos
    13: { allergens: [], dietary: ['vegetarian'] },                 // Soup
    14: { allergens: ['gluten'], dietary: ['vegan'] },              // Bruschetta
    15: { allergens: ['gluten', 'shellfish'], dietary: [] },        // Calamari
    16: { allergens: ['gluten', 'soy'], dietary: ['vegan'] },       // Spring Rolls
    17: { allergens: ['gluten', 'dairy'], dietary: ['vegetarian'] }, // Garlic Bread
    20: { allergens: [], dietary: [] },                              // NY Strip
    21: { allergens: ['fish'], dietary: [] },                        // Grilled Salmon
    22: { allergens: ['gluten', 'dairy', 'eggs'], dietary: [] },    // Chicken Parm
    23: { allergens: [], dietary: [] },                              // BBQ Ribs
    24: { allergens: ['shellfish'], dietary: [] },                   // Lobster
    25: { allergens: [], dietary: [] },                              // Lamb Chops
    26: { allergens: [], dietary: [] },                              // Pork Tenderloin
    27: { allergens: ['shellfish', 'fish', 'gluten'], dietary: [] }, // Seafood Platter
    30: { allergens: ['gluten'], dietary: ['vegan'] },               // French Fries
    31: { allergens: ['eggs'], dietary: ['vegetarian'] },            // Coleslaw
    32: { allergens: ['gluten', 'dairy'], dietary: ['vegetarian'] }, // Mac & Cheese
    33: { allergens: [], dietary: ['vegan', 'gf'] },                 // Side Salad
    34: { allergens: ['gluten'], dietary: ['vegan'] },               // Onion Rings
    35: { allergens: [], dietary: ['vegan', 'gf'] },                 // Baked Potato
    36: { allergens: [], dietary: ['vegan', 'gf'] },                 // Rice Pilaf
    37: { allergens: [], dietary: ['vegan', 'gf'] },                 // Steamed Veggies
    50: { allergens: ['gluten', 'dairy', 'eggs'], dietary: ['vegetarian'] }, // Cheesecake
    51: { allergens: ['gluten', 'dairy', 'eggs'], dietary: ['vegetarian'] }, // Chocolate Cake
    52: { allergens: ['dairy'], dietary: ['vegetarian', 'gf'] },             // Ice Cream
    53: { allergens: ['gluten', 'dairy', 'eggs'], dietary: ['vegetarian'] }, // Apple Pie
    54: { allergens: ['dairy', 'eggs', 'gluten'], dietary: ['vegetarian'] }, // Tiramisu
    55: { allergens: ['dairy', 'eggs'], dietary: ['vegetarian', 'gf'] }      // Creme Brulee
};

// Enhanced populateMenu to show allergen badges
const _origPopulateMenu = typeof populateMenu === 'function' ? populateMenu : null;
if (_origPopulateMenu) {
    populateMenu = function() {
        _origPopulateMenu();

        // Add allergen badges to menu items
        const menuItems = $$('.menu-item');
        menuItems.forEach(el => {
            // Find which item this button corresponds to
            const itemName = el.querySelector('.menu-item-name');
            if (!itemName) return;

            const name = itemName.textContent;
            const item = findMenuItemByName(name);
            if (!item) return;

            const allergenData = ITEM_ALLERGENS[item.id];
            if (!allergenData) return;

            const badges = [];

            // Dietary flags first
            allergenData.dietary.forEach(flag => {
                const df = DIETARY_FLAGS[flag];
                if (df) {
                    badges.push('<span class="allergen-badge dietary" style="background:' + df.color + '" title="' + df.label + '">' + df.icon + '</span>');
                }
            });

            // Allergen indicators
            if (allergenData.allergens.length > 0) {
                const allergenIcons = allergenData.allergens.map(a => {
                    const al = ALLERGENS[a];
                    return al ? '<span class="allergen-badge" style="background:' + al.color + '" title="' + al.label + '">' + al.icon + '</span>' : '';
                }).join('');
                badges.push(allergenIcons);
            }

            if (badges.length > 0) {
                const badgeContainer = document.createElement('div');
                badgeContainer.className = 'allergen-badges';
                badgeContainer.innerHTML = badges.join('');
                el.appendChild(badgeContainer);
            }
        });
    };

    // Re-run to apply badges
    populateMenu();
}

function findMenuItemByName(name) {
    for (const cat of Object.values(MENU)) {
        const item = cat.find(i => i.name === name);
        if (item) return item;
    }
    return null;
}

// Allergen filter for menu
let activeAllergenFilters = new Set();

function toggleAllergenFilter(allergen) {
    if (activeAllergenFilters.has(allergen)) {
        activeAllergenFilters.delete(allergen);
    } else {
        activeAllergenFilters.add(allergen);
    }
    applyAllergenFilters();
    updateAllergenFilterButtons();
}
window.toggleAllergenFilter = toggleAllergenFilter;

function applyAllergenFilters() {
    if (activeAllergenFilters.size === 0) {
        // Show all items
        $$('.menu-item').forEach(el => el.style.display = '');
        return;
    }

    $$('.menu-item').forEach(el => {
        const itemName = el.querySelector('.menu-item-name');
        if (!itemName) return;

        const item = findMenuItemByName(itemName.textContent);
        if (!item) return;

        const allergenData = ITEM_ALLERGENS[item.id];
        if (!allergenData) {
            el.style.display = '';
            return;
        }

        // Hide items that contain any of the filtered allergens
        const hasFiltered = allergenData.allergens.some(a => activeAllergenFilters.has(a));
        el.style.display = hasFiltered ? 'none' : '';
    });
}

function updateAllergenFilterButtons() {
    $$('.allergen-filter-btn').forEach(btn => {
        const allergen = btn.dataset.allergen;
        btn.classList.toggle('active', activeAllergenFilters.has(allergen));
    });
}

// Inject allergen filter bar into menu area
function injectAllergenFilterBar() {
    const menuHeader = document.querySelector('.menu-header') || document.querySelector('.category-tabs');
    if (!menuHeader) return;

    // Check if already injected
    if (document.querySelector('.allergen-filter-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'allergen-filter-bar';
    bar.innerHTML = '<span class="af-label">Exclude:</span>' +
        Object.entries(ALLERGENS).map(([key, a]) =>
            '<button class="allergen-filter-btn" data-allergen="' + key + '" onclick="toggleAllergenFilter(\'' + key + '\')" title="Hide items with ' + a.label + '">' +
            '<span class="af-icon" style="background:' + a.color + '">' + a.icon + '</span>' +
            '<span class="af-name">' + a.label + '</span></button>'
        ).join('');

    menuHeader.parentNode.insertBefore(bar, menuHeader.nextSibling);
}

// Inject on first load after DOM is ready
setTimeout(injectAllergenFilterBar, 100);

// ==========================================
// 4. VOID REASON TRACKING WITH MANAGER APPROVAL
// ==========================================
const voidLog = [];

// Override voidTicket to require reason + manager approval
const _origVoidTicket = typeof voidTicket === 'function' ? voidTicket : null;

if (_origVoidTicket) {
    voidTicket = function(ticketId) {
        // Check if current role can void
        const perms = ROLE_PERMISSIONS[state.currentRole];
        if (!perms || !perms.voidTicket) {
            showVoidApprovalModal(ticketId);
            return;
        }

        // Manager/admin can void directly but still needs reason
        showVoidReasonModal(ticketId, state.currentUser);
    };
    window.voidTicket = voidTicket;
}

function showVoidReasonModal(ticketId, approvedBy) {
    const modal = $('#void-reason-modal');
    if (!modal) return;

    $('#void-ticket-id').textContent = '#' + ticketId;
    $('#void-reason-select').value = '';
    $('#void-reason-notes').value = '';

    // Remove old listeners by cloning
    const confirmBtn = $('#void-reason-confirm');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
        const reason = $('#void-reason-select').value;
        const notes = $('#void-reason-notes').value.trim();

        if (!reason) {
            showToast('Please select a void reason', 'warning');
            return;
        }

        // Log the void
        const logEntry = {
            ticketId,
            reason,
            notes,
            approvedBy,
            voidedBy: state.currentUser,
            timestamp: new Date().toISOString()
        };
        voidLog.push(logEntry);

        // Perform the actual void
        const idx = state.allTickets.findIndex(t => t.id === ticketId);
        if (idx >= 0) {
            state.allTickets[idx].status = 'voided';
            state.allTickets[idx].voidReason = reason;
            state.allTickets[idx].voidNotes = notes;
            state.allTickets[idx].voidApprovedBy = approvedBy;
            state.allTickets[idx].voidedAt = logEntry.timestamp;

            // Sync to API
            if (typeof APIClient !== 'undefined') {
                APIClient.voidTicket(ticketId, approvedBy, reason + (notes ? ': ' + notes : '')).catch(() => {});
            }

            showToast('Ticket #' + ticketId + ' voided (' + reason + ')');
            if (typeof populateTicketsList === 'function') populateTicketsList();
        }

        modal.classList.remove('active');
    });

    modal.classList.add('active');
}

function showVoidApprovalModal(ticketId) {
    const modal = $('#void-approval-modal');
    if (!modal) return;

    $('#void-approval-ticket-id').textContent = '#' + ticketId;
    $('#void-approval-pin').value = '';
    $('#void-approval-error').textContent = '';

    // Remove old listeners
    const confirmBtn = $('#void-approval-confirm');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
        const pin = $('#void-approval-pin').value;
        const staff = lookupStaffByPin(pin);

        if (!staff) {
            $('#void-approval-error').textContent = 'Invalid PIN';
            return;
        }

        const perms = ROLE_PERMISSIONS[staff.role];
        if (!perms || !perms.voidTicket) {
            $('#void-approval-error').textContent = staff.name + ' does not have void permissions';
            return;
        }

        // Manager approved - proceed to reason
        modal.classList.remove('active');
        showVoidReasonModal(ticketId, staff.name);
    });

    modal.classList.add('active');
}

// Close modal handlers
const closeVoidReason = $('#close-void-reason');
if (closeVoidReason) {
    closeVoidReason.addEventListener('click', () => {
        $('#void-reason-modal').classList.remove('active');
    });
}

const closeVoidApproval = $('#close-void-approval');
if (closeVoidApproval) {
    closeVoidApproval.addEventListener('click', () => {
        $('#void-approval-modal').classList.remove('active');
    });
}

// Close waitlist modal
const closeWaitlist = $('#close-waitlist');
if (closeWaitlist) {
    closeWaitlist.addEventListener('click', () => {
        $('#waitlist-modal').classList.remove('active');
    });
}

const wlAddBtn = $('#wl-add-btn');
if (wlAddBtn) {
    wlAddBtn.addEventListener('click', addToWaitlist);
}

// Refresh waitlist every 30 seconds
setInterval(() => {
    if ($('#waitlist-modal') && $('#waitlist-modal').classList.contains('active')) {
        refreshWaitlist();
    }
    updateWaitlistCount();
}, 30000);

// ==========================================
// API Wiring Phase 2: Advanced Features
// ==========================================

// --- Helper: generic modal open/close ---
function openModalById(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
}
function closeModalById(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

// Close buttons for new modals
['void-manager', 'qr-orders', 'online-orders', 'delivery', 'giftcard-manager',
 'saved-payments', 'stock-alerts', 'live-feed', 'diagnostics'].forEach(function(name) {
    var btn = document.getElementById('close-' + name);
    if (btn) btn.addEventListener('click', function() { closeModalById(name + '-modal'); });
});

// Side menu links -> open modals
var sideMenuMap = {
    'menu-void-manager': 'void-manager-modal',
    'menu-qr-orders': 'qr-orders-modal',
    'menu-online-orders': 'online-orders-modal',
    'menu-delivery-orders': 'delivery-modal',
    'menu-giftcard-manager': 'giftcard-manager-modal',
    'menu-saved-payments': 'saved-payments-modal',
    'menu-stock-alerts': 'stock-alerts-modal',
    'menu-live-feed': 'live-feed-modal',
    'menu-diagnostics': 'diagnostics-modal'
};

Object.keys(sideMenuMap).forEach(function(menuId) {
    var el = document.getElementById(menuId);
    if (el) {
        el.addEventListener('click', function() {
            openModalById(sideMenuMap[menuId]);
            var sideMenu = document.getElementById('side-menu');
            if (sideMenu) sideMenu.classList.remove('open');
            // Auto-load data when modal opens
            var loader = modalLoaders[sideMenuMap[menuId]];
            if (loader) loader();
        });
    }
});

// ==========================================
// Void Request Manager
// ==========================================
var modalLoaders = {};

modalLoaders['void-manager-modal'] = function loadVoidManager(filter) {
    filter = filter || 'pending';
    if (typeof APIClient === 'undefined') return;
    APIClient.getVoidRequests().then(function(data) {
        var requests = data.requests || data || [];
        if (filter !== 'all') {
            requests = requests.filter(function(r) { return (r.status || 'pending') === filter; });
        }
        var list = document.getElementById('void-request-list');
        if (!list) return;
        if (requests.length === 0) {
            list.innerHTML = '<p class="tc-empty">No ' + filter + ' void requests</p>';
            return;
        }
        list.innerHTML = requests.map(function(r) {
            var statusClass = r.status || 'pending';
            return '<div class="void-request-card">' +
                '<div class="void-info">' +
                '<div><strong>Ticket #' + (r.ticketId || r.id || '--') + '</strong> &mdash; $' + ((r.amount || 0).toFixed(2)) + '</div>' +
                '<div style="font-size:0.8rem;color:var(--text-secondary);">' + (r.reason || 'No reason') + ' &bull; ' + (r.requestedBy || 'Unknown') + '</div>' +
                '</div>' +
                '<div class="void-actions">' +
                '<span class="void-status ' + statusClass + '">' + statusClass.toUpperCase() + '</span>' +
                (statusClass === 'pending' ?
                    '<button class="btn-accept-order" onclick="handleVoidAction(\'' + r.id + '\',\'approve\')">Approve</button>' +
                    '<button class="action-btn" style="padding:6px 10px;font-size:0.8rem;" onclick="handleVoidAction(\'' + r.id + '\',\'reject\')">Reject</button>'
                    : '') +
                '</div></div>';
        }).join('');
    }).catch(function() {
        var list = document.getElementById('void-request-list');
        if (list) list.innerHTML = '<p class="tc-empty">Failed to load void requests</p>';
    });
};

window.handleVoidAction = function(id, action) {
    if (typeof APIClient === 'undefined') return;
    var fn = action === 'approve' ? APIClient.approveVoidRequest : APIClient.rejectVoidRequest;
    fn(id).then(function() {
        if (typeof showToast === 'function') showToast('Void ' + action + 'd', 'success');
        modalLoaders['void-manager-modal']();
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Failed to ' + action + ' void', 'error');
    });
};

// Void filter tabs
document.querySelectorAll('[data-void-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-void-filter]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        modalLoaders['void-manager-modal'](btn.dataset.voidFilter);
    });
});

// ==========================================
// QR Orders
// ==========================================
modalLoaders['qr-orders-modal'] = function loadQROrders(filter) {
    filter = filter || 'pending';
    if (typeof APIClient === 'undefined') return;
    APIClient.getQROrders().then(function(data) {
        var orders = data.orders || data || [];
        if (filter !== 'all') {
            orders = orders.filter(function(o) { return (o.status || 'pending') === filter; });
        }
        var list = document.getElementById('qr-order-list');
        if (!list) return;
        if (orders.length === 0) {
            list.innerHTML = '<p class="tc-empty">No ' + filter + ' QR orders</p>';
            return;
        }
        list.innerHTML = orders.map(function(o) {
            return '<div class="order-card">' +
                '<div class="order-card-header">' +
                '<span class="order-id">QR #' + (o.id || '--') + '</span>' +
                '<span class="order-source">Table ' + (o.table || '?') + '</span>' +
                '</div>' +
                '<div class="order-items">' + (o.items || []).map(function(i) { return i.name + ' x' + (i.qty || 1); }).join(', ') + '</div>' +
                '<div class="order-footer">' +
                '<span class="order-total">$' + ((o.total || 0).toFixed(2)) + '</span>' +
                '<span class="order-time">' + new Date(o.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
                (o.status === 'pending' ? '<button class="btn-accept-order" onclick="acceptQR(\'' + o.id + '\')">Accept</button>' : '') +
                '</div></div>';
        }).join('');
    }).catch(function() {
        var list = document.getElementById('qr-order-list');
        if (list) list.innerHTML = '<p class="tc-empty">Failed to load QR orders</p>';
    });
};

window.acceptQR = function(id) {
    if (typeof APIClient === 'undefined') return;
    APIClient.acceptQROrder(id).then(function() {
        if (typeof showToast === 'function') showToast('QR order accepted', 'success');
        modalLoaders['qr-orders-modal']();
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Failed to accept QR order', 'error');
    });
};

document.querySelectorAll('[data-qr-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-qr-filter]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        modalLoaders['qr-orders-modal'](btn.dataset.qrFilter);
    });
});

// ==========================================
// Online Orders
// ==========================================
modalLoaders['online-orders-modal'] = function loadOnlineOrders(filter) {
    filter = filter || 'pending';
    if (typeof APIClient === 'undefined') return;
    APIClient.getOnlineOrders().then(function(data) {
        var orders = data.orders || data || [];
        if (filter !== 'all') {
            orders = orders.filter(function(o) { return (o.status || 'pending') === filter; });
        }
        var list = document.getElementById('online-order-list');
        if (!list) return;
        if (orders.length === 0) {
            list.innerHTML = '<p class="tc-empty">No ' + filter + ' online orders</p>';
            return;
        }
        list.innerHTML = orders.map(function(o) {
            return '<div class="order-card">' +
                '<div class="order-card-header">' +
                '<span class="order-id">Online #' + (o.id || '--') + '</span>' +
                '<span class="order-source">' + (o.type || 'Pickup') + '</span>' +
                '</div>' +
                '<div class="order-items">' + (o.items || []).map(function(i) { return i.name + ' x' + (i.qty || 1); }).join(', ') + '</div>' +
                '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">Customer: ' + (o.customerName || 'Guest') + '</div>' +
                '<div class="order-footer">' +
                '<span class="order-total">$' + ((o.total || 0).toFixed(2)) + '</span>' +
                '<span class="order-time">' + new Date(o.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
                (o.status === 'pending' ? '<button class="btn-accept-order" onclick="acceptOnline(\'' + o.id + '\')">Accept</button>' : '') +
                '</div></div>';
        }).join('');
    }).catch(function() {});
};

window.acceptOnline = function(id) {
    if (typeof APIClient === 'undefined') return;
    APIClient.acceptOnlineOrder(id).then(function() {
        if (typeof showToast === 'function') showToast('Online order accepted', 'success');
        modalLoaders['online-orders-modal']();
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Failed to accept order', 'error');
    });
};

document.querySelectorAll('[data-online-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-online-filter]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        modalLoaders['online-orders-modal'](btn.dataset.onlineFilter);
    });
});

// ==========================================
// Delivery Orders
// ==========================================
modalLoaders['delivery-modal'] = function loadDeliveryOrders(source) {
    source = source || 'all';
    if (typeof APIClient === 'undefined') return;
    APIClient.getDeliveryIntegrations().then(function(data) {
        var orders = data.orders || data || [];
        if (source !== 'all') {
            orders = orders.filter(function(o) { return (o.platform || '').toLowerCase() === source; });
        }
        var list = document.getElementById('delivery-order-list');
        if (!list) return;
        if (orders.length === 0) {
            list.innerHTML = '<p class="tc-empty">No delivery orders' + (source !== 'all' ? ' from ' + source : '') + '</p>';
            return;
        }
        list.innerHTML = orders.map(function(o) {
            var platformColors = { doordash: '#ff3008', ubereats: '#06c167', grubhub: '#f63440' };
            var color = platformColors[(o.platform || '').toLowerCase()] || 'var(--primary)';
            return '<div class="order-card">' +
                '<div class="order-card-header">' +
                '<span class="order-id">#' + (o.id || '--') + '</span>' +
                '<span class="order-source" style="background:' + color + ';color:white;">' + (o.platform || 'Delivery') + '</span>' +
                '</div>' +
                '<div class="order-items">' + (o.items || []).map(function(i) { return i.name; }).join(', ') + '</div>' +
                '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">ETA: ' + (o.eta || '--') + ' &bull; ' + (o.customerName || 'Guest') + '</div>' +
                '<div class="order-footer">' +
                '<span class="order-total">$' + ((o.total || 0).toFixed(2)) + '</span>' +
                '<span class="order-time">' + (o.status || 'New') + '</span>' +
                '</div></div>';
        }).join('');
    }).catch(function() {});
};

document.querySelectorAll('[data-delivery-src]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-delivery-src]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        modalLoaders['delivery-modal'](btn.dataset.deliverySrc);
    });
});

// ==========================================
// Gift Card Manager
// ==========================================
modalLoaders['giftcard-manager-modal'] = function loadGiftCards() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getGiftCards().then(function(data) {
        var cards = data.cards || data || [];
        var list = document.getElementById('giftcard-list');
        if (!list) return;
        if (cards.length === 0) {
            list.innerHTML = '<p class="tc-empty">No gift cards found</p>';
            return;
        }
        list.innerHTML = cards.slice(0, 20).map(function(c) {
            return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:0.85rem;">' +
                '<span>' + (c.number || c.id || '--') + '</span>' +
                '<span class="' + (c.active !== false ? 'gc-active' : 'gc-inactive') + '">$' + ((c.balance || 0).toFixed(2)) + '</span>' +
                '</div>';
        }).join('');
    }).catch(function() {});
};

// Gift card lookup
var gcLookupBtn = document.getElementById('giftcard-lookup-btn');
if (gcLookupBtn) {
    gcLookupBtn.addEventListener('click', function() {
        var num = (document.getElementById('giftcard-lookup') || {}).value;
        if (!num || typeof APIClient === 'undefined') return;
        APIClient.getGiftCard(num).then(function(card) {
            var detail = document.getElementById('giftcard-detail');
            if (!detail) return;
            detail.style.display = 'block';
            document.getElementById('gc-card-number').textContent = '#' + (card.number || card.id || num);
            document.getElementById('gc-balance').textContent = '$' + ((card.balance || 0).toFixed(2));
            document.getElementById('gc-status').textContent = card.active !== false ? 'Active' : 'Inactive';
            document.getElementById('gc-status').className = card.active !== false ? 'gc-active' : 'gc-inactive';
            detail._cardId = card.id || num;
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Gift card not found', 'error');
        });
    });
}

// Gift card reload
var gcReloadBtn = document.getElementById('gc-reload-btn');
if (gcReloadBtn) {
    gcReloadBtn.addEventListener('click', function() {
        var detail = document.getElementById('giftcard-detail');
        var amount = parseFloat((document.getElementById('gc-reload-amount') || {}).value);
        if (!detail || !detail._cardId || !amount || typeof APIClient === 'undefined') return;
        APIClient.reloadGiftCard(detail._cardId, amount).then(function(res) {
            document.getElementById('gc-balance').textContent = '$' + ((res.balance || amount).toFixed(2));
            document.getElementById('gc-reload-amount').value = '';
            if (typeof showToast === 'function') showToast('Gift card reloaded', 'success');
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Reload failed', 'error');
        });
    });
}

// Gift card charge
var gcChargeBtn = document.getElementById('gc-charge-btn');
if (gcChargeBtn) {
    gcChargeBtn.addEventListener('click', function() {
        var detail = document.getElementById('giftcard-detail');
        var amount = parseFloat((document.getElementById('gc-reload-amount') || {}).value);
        if (!detail || !detail._cardId || !amount || typeof APIClient === 'undefined') return;
        APIClient.chargeGiftCard(detail._cardId, amount).then(function(res) {
            document.getElementById('gc-balance').textContent = '$' + ((res.balance || 0).toFixed(2));
            document.getElementById('gc-reload-amount').value = '';
            if (typeof showToast === 'function') showToast('Gift card charged $' + amount.toFixed(2), 'success');
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Charge failed', 'error');
        });
    });
}

// Issue new gift card
var gcCreateBtn = document.getElementById('gc-create-btn');
if (gcCreateBtn) {
    gcCreateBtn.addEventListener('click', function() {
        if (typeof APIClient === 'undefined') return;
        var amount = prompt('Initial balance ($):');
        if (!amount) return;
        APIClient.createGiftCard({ balance: parseFloat(amount) }).then(function(card) {
            if (typeof showToast === 'function') showToast('Gift card #' + (card.number || card.id) + ' created', 'success');
            modalLoaders['giftcard-manager-modal']();
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Failed to create gift card', 'error');
        });
    });
}

// ==========================================
// Saved Payment Methods
// ==========================================
modalLoaders['saved-payments-modal'] = function loadSavedPayments() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getSavedPaymentMethods().then(function(data) {
        var methods = data.methods || data || [];
        var list = document.getElementById('saved-payments-list');
        if (!list) return;
        if (methods.length === 0) {
            list.innerHTML = '<p class="tc-empty">No saved payment methods</p>';
            return;
        }
        list.innerHTML = methods.map(function(m) {
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light);">' +
                '<div>' +
                '<div style="font-weight:600;">' + (m.customerName || 'Unknown') + '</div>' +
                '<div style="font-size:0.8rem;color:var(--text-secondary);">' + (m.type || 'Card') + ' &bull; ****' + (m.last4 || '0000') + '</div>' +
                '</div>' +
                '<div style="font-size:0.75rem;color:var(--text-secondary);">Exp ' + (m.expiry || '--') + '</div>' +
                '</div>';
        }).join('');
    }).catch(function() {});
};

// ==========================================
// Low Stock Alerts
// ==========================================
modalLoaders['stock-alerts-modal'] = function loadStockAlerts() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getLowStockAlerts().then(function(data) {
        var alerts = data.alerts || data || [];
        var list = document.getElementById('stock-alert-list');
        if (!list) return;
        if (alerts.length === 0) {
            list.innerHTML = '<p class="tc-empty">All stock levels OK</p>';
            return;
        }
        list.innerHTML = alerts.map(function(a) {
            var pct = a.threshold ? Math.round((a.current / a.threshold) * 100) : 0;
            var color = pct < 25 ? '#ff3b30' : pct < 50 ? '#ff9500' : '#ffcc00';
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light);">' +
                '<div>' +
                '<div style="font-weight:600;">' + (a.name || 'Unknown') + '</div>' +
                '<div style="font-size:0.8rem;color:var(--text-secondary);">Current: ' + (a.current || 0) + ' ' + (a.unit || '') + ' / Min: ' + (a.threshold || 0) + '</div>' +
                '</div>' +
                '<div style="width:60px;height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden;">' +
                '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px;"></div>' +
                '</div></div>';
        }).join('');

        // Update floating badge
        var badge = document.getElementById('stock-alert-badge');
        var countEl = document.getElementById('stock-alert-count');
        if (badge && countEl) {
            if (alerts.length > 0) {
                badge.style.display = 'block';
                countEl.textContent = alerts.length;
            } else {
                badge.style.display = 'none';
            }
        }
    }).catch(function() {});
};

// Stock alert badge click opens modal
var stockBadge = document.getElementById('stock-alert-badge');
if (stockBadge) {
    stockBadge.addEventListener('click', function() {
        openModalById('stock-alerts-modal');
        modalLoaders['stock-alerts-modal']();
    });
}

// Check stock alerts periodically (every 5 min)
setInterval(function() {
    if (typeof APIClient !== 'undefined') {
        APIClient.getLowStockAlerts().then(function(data) {
            var alerts = data.alerts || data || [];
            var badge = document.getElementById('stock-alert-badge');
            var countEl = document.getElementById('stock-alert-count');
            if (badge && countEl) {
                if (alerts.length > 0) {
                    badge.style.display = 'block';
                    countEl.textContent = alerts.length;
                } else {
                    badge.style.display = 'none';
                }
            }
        }).catch(function() {});
    }
}, 300000);

// ==========================================
// Live Activity Feed
// ==========================================
modalLoaders['live-feed-modal'] = function loadLiveFeed() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getLiveFeed().then(function(data) {
        var entries = data.entries || data || [];
        var list = document.getElementById('live-feed-list');
        if (!list) return;
        if (entries.length === 0) {
            list.innerHTML = '<p class="tc-empty">No recent activity</p>';
            return;
        }
        list.innerHTML = entries.slice(0, 50).map(function(e) {
            var iconClass = 'sale';
            if (e.type === 'void' || e.type === 'refund') iconClass = 'void';
            else if (e.type === 'clock') iconClass = 'clock';
            else if (e.type === 'alert') iconClass = 'alert';
            var iconSymbol = { sale: '$', void: 'X', clock: '&#x1F550;', alert: '!' }[iconClass] || '&bull;';
            return '<div class="feed-entry">' +
                '<span class="feed-time">' + new Date(e.timestamp || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
                '<span class="feed-icon ' + iconClass + '">' + iconSymbol + '</span>' +
                '<span class="feed-text">' + (e.message || e.description || '') + '</span>' +
                '</div>';
        }).join('');
    }).catch(function() {});
};

// ==========================================
// System Diagnostics
// ==========================================
modalLoaders['diagnostics-modal'] = function loadDiagnostics() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getSystemDiagnostics().then(function(data) {
        var d = data || {};
        var setStatus = function(id, status) {
            var el = document.getElementById(id);
            if (!el) return;
            el.textContent = status || 'Unknown';
            var card = el.closest('.diag-card');
            if (card) {
                card.classList.remove('ok', 'error', 'warning');
                if (status === 'OK' || status === 'Connected') card.classList.add('ok');
                else if (status === 'Error' || status === 'Down') card.classList.add('error');
                else card.classList.add('warning');
            }
        };
        setStatus('diag-api-status', d.apiServer || d.api || 'OK');
        setStatus('diag-db-status', d.database || d.db || 'Unknown');
        setStatus('diag-payment-status', d.paymentGateway || d.payment || 'Unknown');
        setStatus('diag-printer-status', d.printer || 'Unknown');

        var details = document.getElementById('diag-details');
        if (details) {
            var info = d.details || d;
            details.textContent = typeof info === 'string' ? info : JSON.stringify(info, null, 2);
        }
    }).catch(function(err) {
        var details = document.getElementById('diag-details');
        if (details) details.textContent = 'Failed to load diagnostics: ' + (err.message || err);
    });

    // Also fetch payment health
    APIClient.getPaymentHealth().then(function(data) {
        var el = document.getElementById('diag-payment-status');
        if (el && data) {
            el.textContent = data.status || data.healthy ? 'Connected' : 'Error';
        }
    }).catch(function() {});
};

// Diagnostics action buttons
var diagRefresh = document.getElementById('diag-refresh-btn');
if (diagRefresh) {
    diagRefresh.addEventListener('click', function() { modalLoaders['diagnostics-modal'](); });
}

var diagSync = document.getElementById('diag-sync-btn');
if (diagSync) {
    diagSync.addEventListener('click', function() {
        if (typeof APIClient === 'undefined') return;
        APIClient.syncResync().then(function() {
            if (typeof showToast === 'function') showToast('Sync triggered', 'success');
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Sync failed', 'error');
        });
    });
}

var diagFlush = document.getElementById('diag-flush-btn');
if (diagFlush) {
    diagFlush.addEventListener('click', function() {
        if (typeof APIClient === 'undefined') return;
        APIClient.flushOfflineQueue().then(function() {
            if (typeof showToast === 'function') showToast('Queue flushed', 'success');
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Flush failed', 'error');
        });
    });
}

// ==========================================
// Advanced Reports Wiring
// ==========================================

// Heatmap report
function loadHeatmapReport() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getHourlyHeatmap().then(function(data) {
        var hours = data.hours || data || [];
        var grid = document.getElementById('heatmap-grid');
        if (!grid) return;
        if (hours.length === 0) {
            grid.innerHTML = '<p class="tc-empty" style="grid-column:1/-1;">No heatmap data available</p>';
            return;
        }
        var max = Math.max.apply(null, hours.map(function(h) { return h.sales || h.count || 0; }));
        grid.innerHTML = hours.map(function(h, i) {
            var val = h.sales || h.count || 0;
            var intensity = max > 0 ? val / max : 0;
            var r = Math.round(255 * intensity);
            var g = Math.round(100 * (1 - intensity));
            var b = 60;
            return '<div class="heatmap-cell" style="background:rgba(' + r + ',' + g + ',' + b + ',' + (0.3 + intensity * 0.7) + ');" title="' + (h.hour || i) + ':00 - $' + val.toFixed(0) + '">' +
                '<span class="heatmap-hour">' + (h.hour || i) + 'h</span>' +
                '$' + val.toFixed(0) + '</div>';
        }).join('') +
        '<div class="heatmap-label" style="grid-column:1/-1;">Sales by hour &mdash; darker = higher</div>';
    }).catch(function() {});
}

// Category Margins report
function loadMarginsReport() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getCategoryMarginReport().then(function(data) {
        var cats = data.categories || data || [];
        var body = document.getElementById('margins-body');
        if (!body) return;
        body.innerHTML = cats.map(function(c) {
            var margin = (c.revenue || 0) - (c.cost || 0);
            var pct = c.revenue > 0 ? ((margin / c.revenue) * 100).toFixed(1) : '0.0';
            return '<tr><td>' + (c.name || '--') + '</td><td>$' + (c.revenue || 0).toFixed(2) + '</td>' +
                '<td>$' + (c.cost || 0).toFixed(2) + '</td><td>$' + margin.toFixed(2) + '</td>' +
                '<td>' + pct + '%</td></tr>';
        }).join('');
    }).catch(function() {});
}

// Payment Breakdown report
function loadPaymentBreakdownReport() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getPaymentBreakdownReport().then(function(data) {
        var breakdown = data.breakdown || data || {};
        var grid = document.getElementById('payment-breakdown-grid');
        if (!grid) return;
        var types = breakdown.types || Object.keys(breakdown).filter(function(k) { return typeof breakdown[k] === 'number'; });
        if (Array.isArray(types) && types.length > 0) {
            grid.innerHTML = types.map(function(t) {
                var val = typeof t === 'object' ? t : { name: t, amount: breakdown[t] || 0 };
                return '<div class="report-card"><span class="report-card-label">' + (val.name || val.type || t) +
                    '</span><span class="report-card-value">$' + ((val.amount || val.total || 0).toFixed(2)) +
                    '</span></div>';
            }).join('');
        } else {
            grid.innerHTML = '<p class="tc-empty" style="grid-column:1/-1;">No payment data</p>';
        }
    }).catch(function() {});
}

// Food Cost report
function loadFoodCostReport() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getFoodCostReport().then(function(data) {
        var items = data.items || data || [];
        var body = document.getElementById('foodcost-body');
        if (!body) return;
        body.innerHTML = items.map(function(i) {
            var costPct = i.revenue > 0 ? ((i.cost / i.revenue) * 100).toFixed(1) : '0.0';
            return '<tr><td>' + (i.name || '--') + '</td><td>' + (i.portions || i.qty || 0) + '</td>' +
                '<td>$' + (i.cost || 0).toFixed(2) + '</td><td>$' + (i.revenue || 0).toFixed(2) + '</td>' +
                '<td>' + costPct + '%</td></tr>';
        }).join('');
    }).catch(function() {});
}

// Server Performance report
function loadServerPerformanceReport() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getServerPerformanceReport().then(function(data) {
        var servers = data.servers || data || [];
        var body = document.getElementById('servers-body');
        if (!body) return;
        body.innerHTML = servers.map(function(s) {
            var avg = s.tickets > 0 ? (s.revenue / s.tickets) : 0;
            var tipPct = s.revenue > 0 ? ((s.tips / s.revenue) * 100).toFixed(1) : '0.0';
            return '<tr><td>' + (s.name || '--') + '</td><td>' + (s.tickets || 0) + '</td>' +
                '<td>$' + (s.revenue || 0).toFixed(2) + '</td><td>$' + avg.toFixed(2) + '</td>' +
                '<td>$' + (s.tips || 0).toFixed(2) + '</td><td>' + tipPct + '%</td></tr>';
        }).join('');
    }).catch(function() {});
}

// Wire report tabs to load data
var reportTabHandlers = {
    heatmap: loadHeatmapReport,
    margins: loadMarginsReport,
    payments: loadPaymentBreakdownReport,
    foodcost: loadFoodCostReport,
    servers: loadServerPerformanceReport
};

document.querySelectorAll('.report-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
        var report = tab.dataset.report;
        // Show correct panel
        document.querySelectorAll('.report-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = document.getElementById('report-' + report) || document.getElementById('report-' + report + '-panel');
        if (panel) panel.classList.add('active');
        // Load data for advanced reports
        if (reportTabHandlers[report]) reportTabHandlers[report]();
    });
});

// ==========================================
// Barcode Scan Indicator Enhancement
// ==========================================
(function enhanceBarcodeIndicator() {
    var indicator = document.getElementById('barcode-indicator');
    var indicatorText = document.getElementById('barcode-indicator-text');
    if (!indicator) return;

    // Listen for barcode scan events from pos.js
    document.addEventListener('barcode-scan-start', function() {
        indicator.style.display = 'block';
        if (indicatorText) indicatorText.textContent = 'Scanning...';
    });

    document.addEventListener('barcode-scan-complete', function(e) {
        if (indicatorText) indicatorText.textContent = 'Scanned: ' + (e.detail || '');
        setTimeout(function() { indicator.style.display = 'none'; }, 1500);
    });

    document.addEventListener('barcode-scan-error', function() {
        if (indicatorText) indicatorText.textContent = 'Scan failed';
        indicator.style.background = '#ff3b30';
        setTimeout(function() {
            indicator.style.display = 'none';
            indicator.style.background = '';
        }, 1500);
    });
})();

// ==========================================
// Health Status Indicator Enhancement
// ==========================================
(function enhanceHealthIndicator() {
    var dot = document.getElementById('status-dot');
    var status = document.getElementById('server-status');
    if (!dot || !status) return;

    function updateHealthDot(isOnline, detail) {
        dot.classList.remove('online', 'offline', 'degraded');
        if (isOnline === true) {
            dot.classList.add('online');
            status.title = 'Server: Connected' + (detail ? ' (' + detail + ')' : '');
        } else if (isOnline === false) {
            dot.classList.add('offline');
            status.title = 'Server: Disconnected';
        } else {
            dot.classList.add('degraded');
            status.title = 'Server: Degraded' + (detail ? ' (' + detail + ')' : '');
        }
    }

    // Poll health every 30s
    function checkHealth() {
        if (typeof APIClient === 'undefined') {
            updateHealthDot(false);
            return;
        }
        APIClient.healthCheck().then(function(data) {
            if (data && (data.status === 'ok' || data.healthy)) {
                updateHealthDot(true, data.version || '');
            } else {
                updateHealthDot('degraded', data.status || '');
            }
        }).catch(function() {
            updateHealthDot(false);
        });
    }

    checkHealth();
    setInterval(checkHealth, 30000);

    // Click to show diagnostics
    status.addEventListener('click', function() {
        openModalById('diagnostics-modal');
        modalLoaders['diagnostics-modal']();
    });
})();

// ==========================================
// Partial Payment Display
// ==========================================
(function wirePartialPaymentDisplay() {
    // Observe ticket changes to show partial payment info
    var observer = new MutationObserver(function() {
        var ticket = typeof currentTicket !== 'undefined' ? currentTicket : null;
        if (!ticket) return;
        var paidRow = document.getElementById('partial-paid-row');
        var remainRow = document.getElementById('remaining-row');
        var paidAmt = document.getElementById('partial-paid-amount');
        var remainAmt = document.getElementById('remaining-amount');

        if (ticket.partialPayments && ticket.partialPayments.length > 0) {
            var totalPaid = ticket.partialPayments.reduce(function(sum, p) { return sum + (p.amount || 0); }, 0);
            var total = ticket.total || 0;
            var remaining = Math.max(0, total - totalPaid);

            if (paidRow) paidRow.style.display = '';
            if (remainRow) remainRow.style.display = '';
            if (paidAmt) paidAmt.textContent = '$' + totalPaid.toFixed(2);
            if (remainAmt) remainAmt.innerHTML = '<strong>$' + remaining.toFixed(2) + '</strong>';
        } else {
            if (paidRow) paidRow.style.display = 'none';
            if (remainRow) remainRow.style.display = 'none';
        }
    });

    var ticketItems = document.getElementById('ticket-items');
    if (ticketItems) {
        observer.observe(ticketItems, { childList: true, subtree: true });
    }
})();

// ==========================================
// Wire remaining APIClient methods
// ==========================================

// Payment type report (for reports view)
function loadPaymentTypeReport() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getPaymentTypeReport().then(function(data) {
        var types = data.types || data || [];
        // Merge into payment breakdown grid if visible
        var grid = document.getElementById('payment-breakdown-grid');
        if (grid && types.length > 0) {
            grid.innerHTML += types.map(function(t) {
                return '<div class="report-card"><span class="report-card-label">' + (t.type || t.name || '--') +
                    '</span><span class="report-card-value">' + (t.count || 0) + ' txns / $' + ((t.total || 0).toFixed(2)) +
                    '</span></div>';
            }).join('');
        }
    }).catch(function() {});
}

// Surcharge report
function loadSurchargeReport() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getSurchargeReport();
}

// Labor cost report (enhanced)
function loadLaborCostReport() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getLaborCostReport();
}

// Ingredient management
function loadIngredients() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getIngredients();
}

function adjustIngredient(id, qty) {
    if (typeof APIClient === 'undefined') return;
    return APIClient.adjustIngredient(id, qty);
}

// Inventory movements
function loadInventoryMovements() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getInventoryMovements();
}

// Kitchen alert
window.sendKitchenAlert = function(message) {
    if (typeof APIClient === 'undefined') return;
    APIClient.kitchenAlert(message || 'Attention needed').then(function() {
        if (typeof showToast === 'function') showToast('Kitchen alerted', 'success');
    }).catch(function() {});
};

// Tables API sync
function syncTablesFromAPI() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getTables().then(function(data) {
        // Merge table data into local state if tables view exists
        if (typeof window.updateTableStatuses === 'function') {
            window.updateTableStatuses(data.tables || data || []);
        }
    }).catch(function() {});
}

// Payment by ticket lookup
window.getPaymentsByTicket = function(ticketId) {
    if (typeof APIClient === 'undefined') return Promise.resolve([]);
    return APIClient.getPaymentsByTicket(ticketId);
};

// Happy Hour management (POS-side toggle)
window.checkHappyHour = function() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getHappyHour().then(function(data) {
        var banner = document.getElementById('happy-hour-banner');
        var text = document.getElementById('hh-banner-text');
        var time = document.getElementById('hh-banner-time');
        if (!banner) return;
        if (data && data.active) {
            banner.style.display = 'flex';
            if (text) text.textContent = data.name || 'Happy Hour Active';
            if (time) time.textContent = (data.start || '') + ' - ' + (data.end || '');
        } else {
            banner.style.display = 'none';
        }
    }).catch(function() {});
};

// Check happy hour on load and every minute
if (typeof APIClient !== 'undefined') {
    setTimeout(function() { if (typeof checkHappyHour === 'function') checkHappyHour(); }, 2000);
    setInterval(function() { if (typeof checkHappyHour === 'function') checkHappyHour(); }, 60000);
}

// State compliance rules
window.loadStateRules = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getStateRules();
};

// Surcharge cap config
window.loadSurchargeCapConfig = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getSurchargeCapConfig();
};

// Owner analytics
window.loadOwnerAnalytics = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getOwnerAnalytics();
};

// Mobile dashboard
window.loadMobileDashboard = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getMobileDashboard();
};

// Admin summary
window.loadAdminSummary = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getAdminSummary();
};

// Cloud reports
window.loadCloudReports = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getCloudReports();
};

// Export to QuickBooks
window.exportToQuickBooks = function() {
    if (typeof APIClient === 'undefined') return;
    APIClient.getExportQuickbooks().then(function(data) {
        if (typeof showToast === 'function') showToast('QuickBooks export ready', 'success');
        if (data && data.downloadUrl) window.open(data.downloadUrl, '_blank');
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Export failed', 'error');
    });
};

// Sync engine
window.triggerSync = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.syncPush();
};

window.getSyncSnapshot = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getSyncSnapshot();
};

// Offline queue management
window.getOfflineQueueLength = function() {
    if (typeof APIClient === 'undefined') return Promise.resolve(0);
    return APIClient.getQueueLength();
};

// Update config
window.saveConfig = function(config) {
    if (typeof APIClient === 'undefined') return;
    return APIClient.updateConfig(config);
};

// Modifier profitability
window.loadModifierProfitability = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getModifierProfitabilityReport();
};

// Inventory depletion report
window.loadInventoryDepletion = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getInventoryDepletionReport();
};

// Fraud alerts
window.loadFraudAlerts = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.getFraudAlerts();
};

// Open cash drawer via API
window.openDrawerViaAPI = function() {
    if (typeof APIClient === 'undefined') return;
    return APIClient.openCashDrawer();
};

console.log('[POS-Extras] Advanced feature wiring loaded');
