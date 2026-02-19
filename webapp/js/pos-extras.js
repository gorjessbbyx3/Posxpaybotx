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
            const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
            let gratAmount = 0;

            if (typeof Calculations !== 'undefined' && typeof Calculations.autoGratuity === 'function') {
                gratAmount = Calculations.autoGratuity(subtotal, partySize, AUTO_GRATUITY_CONFIG);
            } else {
                gratAmount = Math.round(subtotal * (AUTO_GRATUITY_CONFIG.percentage / 100) * 100) / 100;
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
    // Check if ticket has explicit party size
    if (state.ticket.partySize) return state.ticket.partySize;

    // Check table seats
    if (state.ticket.table) {
        const tbl = TABLES.find(t => t.number === state.ticket.table);
        if (tbl && tbl.seats >= AUTO_GRATUITY_CONFIG.minPartySize) return tbl.seats;
    }

    return 0;
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

// Monkey-patch completePayment to add gratuity to the total
const _origCompletePaymentGrat = typeof completePayment === 'function' ? completePayment : null;
if (_origCompletePaymentGrat) {
    completePayment = function(total, method) {
        let adjustedTotal = total;
        if (state.ticket.autoGratuity && state.ticket.autoGratuity > 0) {
            adjustedTotal += state.ticket.autoGratuity;
            // Store on ticket for receipt
            const t = state.allTickets.find(t => t.id === state.ticket.id);
            if (t) {
                t.autoGratuity = state.ticket.autoGratuity;
                t.autoGratuityRate = state.ticket.autoGratuityRate;
                t.tip = (t.tip || 0) + state.ticket.autoGratuity;
            }
        }
        _origCompletePaymentGrat(adjustedTotal, method);
    };
}

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
