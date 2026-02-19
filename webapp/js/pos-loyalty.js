/**
 * POS Loyalty - Customer Loyalty, Combos, Training Mode & Audit Log
 *
 * Depends on: pos-core.js (state, $, $$, showToast, formatCurrency, MENU)
 * Must be loaded AFTER pos.js (needs updateTicketDisplay, newTicket, completePayment, addItemDirectly)
 */

// ==========================================
// Customer Loyalty Points Program
// ==========================================
const LOYALTY = {
    enabled: true,
    pointsPerDollar: 1,
    redeemThreshold: 100,
    redeemValue: 5.00,
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
        tier: 'bronze',
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
                        <div id="loyalty-member-card" style="padding:16px; background:var(--bg-tertiary); border-radius:var(--radius-md); margin-bottom:12px;"></div>
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
                <div style="font-weight:700; font-size:1.1rem;">${escapeHtml(member.name)}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(member.phone)}</div>
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
        id: 'combo1', name: 'Burger Combo', price: 16.99, savings: 4.98,
        items: [
            { category: 'popular', choices: [1, 6], label: 'Burger or Club Sandwich' },
            { category: 'sides', choices: [30, 34, 31], label: 'Fries, Onion Rings, or Coleslaw' },
            { category: 'drinks', choices: [40, 41, 44], label: 'Soda, Iced Tea, or Lemonade' }
        ]
    },
    {
        id: 'combo2', name: 'Steak Dinner', price: 34.99, savings: 7.47,
        items: [
            { category: 'entrees', choices: [20, 25], label: 'NY Strip or Lamb Chops' },
            { category: 'appetizers', choices: [13, 14], label: 'Soup or Bruschetta' },
            { category: 'sides', choices: [35, 37, 36], label: 'Baked Potato, Veggies, or Rice' }
        ]
    },
    {
        id: 'combo3', name: 'Family Feast', price: 49.99, savings: 12.96,
        items: [
            { category: 'popular', choices: [5, 3, 8], label: 'Pizza, Chicken, or Pasta' },
            { category: 'appetizers', choices: [10, 11, 12], label: 'Mozz Sticks, Wings, or Nachos' },
            { category: 'sides', choices: [30, 32, 34], label: 'Fries, Mac & Cheese, or Onion Rings' },
            { category: 'drinks', choices: [40, 41, 44, 43], label: 'Any Beverage' }
        ]
    },
    {
        id: 'combo4', name: 'Lunch Express', price: 11.99, savings: 3.47,
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
        card.addEventListener('click', () => openComboBuilder(card.dataset.comboId));
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
            for (const [cat, catItems] of Object.entries(MENU)) {
                const found = catItems.find(i => i.id === itemId);
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

        const comboNames = selections.map(id => {
            for (const catItems of Object.values(MENU)) {
                const found = catItems.find(i => i.id === id);
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

    document.getElementById('combo-modal').classList.remove('active');
    builder.classList.add('active');
}

// ==========================================
// Training Mode
// ==========================================
let trainingMode = false;

function toggleTrainingMode() {
    if (state.currentRole !== 'manager' && state.currentRole !== 'admin') {
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

// Register training mode as a beforeComplete hook (can cancel payment)
registerHook('beforeComplete', function(total, method) {
    if (trainingMode) {
        showToast('TRAINING: Payment of ' + formatCurrency(total) + ' via ' + method + ' (not processed)', 'warning');
        $('#payment-modal').classList.remove('active');
        newTicket();
        return false; // cancel the payment
    }
    return total;
});

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
    if (auditLog.length > 500) auditLog.shift();
}

// Instrument key actions
const _origAddItemDirectlyAudit = addItemDirectly;
addItemDirectly = function(menuItem, selectedMods) {
    logAudit('ADD_ITEM', menuItem.name + ' x1' + (selectedMods.length > 0 ? ' [' + selectedMods.map(m => m.name).join(', ') + ']' : ''));
    _origAddItemDirectlyAudit(menuItem, selectedMods);
};

// Register audit logging as an afterComplete hook
registerHook('afterComplete', function(total, method) {
    logAudit('PAYMENT', 'Ticket #' + state.ticket.id + ' - ' + formatCurrency(total) + ' via ' + method);
});

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

    const users = [...new Set(auditLog.map(e => e.user))];
    const userSelect = document.getElementById('audit-filter-user');
    userSelect.innerHTML = '<option value="">All Users</option>' + users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');

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
                            <td style="padding:6px 8px;">${escapeHtml(e.user)}</td>
                            <td style="padding:6px 8px;"><span style="padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:600; background:${actionColors[e.action] || 'var(--text-muted)'}22; color:${actionColors[e.action] || 'var(--text-muted)'};">${escapeHtml(e.action)}</span></td>
                            <td style="padding:6px 8px; color:var(--text-secondary);">${escapeHtml(e.details)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

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
