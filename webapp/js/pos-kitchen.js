/**
 * POS Kitchen - Kitchen Display System, Course Firing & Printing
 *
 * Depends on: pos-core.js (CONFIG, state, $, $$, showToast, formatCurrency, MENU)
 * Must be loaded AFTER pos-core.js
 */

// ==========================================
// Kitchen Ticket Printing (Station Routing)
// ==========================================
function printKitchenTickets(order) {
    const stationGroups = {};
    order.items.forEach(item => {
        const station = item.station || 'expo';
        if (!stationGroups[station]) stationGroups[station] = [];
        stationGroups[station].push(item);
    });

    Object.entries(stationGroups).forEach(([station, items]) => {
        const ticketHtml = generateKitchenTicketHtml(order, station, items);
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
// Course Firing for Kitchen
// ==========================================
const COURSES = ['beverage', 'appetizer', 'main', 'dessert'];

function assignCourses(items) {
    return items.map(item => {
        if (item.course) return item;
        const catName = findItemCategory(item.id);
        if (catName === 'drinks') {
            item.course = 'beverage';
        } else if (catName === 'appetizers' || catName === 'sides') {
            item.course = 'appetizer';
        } else if (catName === 'desserts') {
            item.course = 'dessert';
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

// ==========================================
// Kitchen Display System (with Course Firing + Station Filtering)
// ==========================================
let activeStation = 'all';

function populateKitchen() {
    const container = $('#kds-tickets');
    container.innerHTML = '';

    let activeCount = 0;
    let totalTime = 0;

    let orders = state.kitchenOrders;
    if (activeStation !== 'all') {
        orders = orders.filter(o => o.items.some(i => (i.station || 'expo') === activeStation));
    }

    orders.forEach(order => {
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
                            ${item.note ? '<div class="kds-item-note">' + escapeHtml(item.note) + '</div>' : ''}
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
            ${order.server ? '<div class="kds-ticket-server">Server: ' + escapeHtml(order.server) + (order.table ? ' | T' + escapeHtml(String(order.table)) : '') + '</div>' : ''}
            <div class="kds-ticket-courses">${coursesHtml}</div>
            <div class="kds-ticket-footer">
                <button class="kds-reprint-btn" data-order-id="${order.id}">REPRINT</button>
                <button class="kds-pickup-btn" data-order-id="${order.id}">PICKUP</button>
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
                    // Sync to API
                    if (typeof APIClient !== 'undefined') {
                        APIClient.fireCourse(orderId, course).catch(() => {});
                    }
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

        // Pickup button
        const pickupBtn = el.querySelector('.kds-pickup-btn');
        if (pickupBtn) {
            pickupBtn.addEventListener('click', () => {
                const oid = parseInt(pickupBtn.dataset.orderId);
                if (typeof APIClient !== 'undefined') {
                    APIClient.pickupKitchenOrder(oid).catch(() => {});
                }
                state.kitchenOrders = state.kitchenOrders.filter(o => o.id !== oid);
                showToast('Order #' + oid + ' marked for pickup');
                populateKitchen();
            });
        }

        // Bump button
        el.querySelector('.kds-bump-btn').addEventListener('click', () => {
            const bumpedOrder = state.kitchenOrders.find(o => o.id === order.id);
            if (bumpedOrder) {
                // Notify API
                if (typeof APIClient !== 'undefined') {
                    APIClient.bumpKitchenOrder(order.id).catch(() => {});
                }
            }
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
        activeStation = btn.dataset.station || 'all';
        populateKitchen();
    });
});

// --- Wire Kitchen API: Load orders from backend ---
(function wireKitchenLoadAPI() {
    const origPopulate = populateKitchen;
    window.populateKitchen = function() {
        // Try loading from API first, fall back to local
        if (typeof APIClient !== 'undefined') {
            APIClient.getKitchenOrders(activeStation).then(data => {
                const orders = data.orders || data || [];
                if (orders.length > 0) {
                    // Merge API orders into local state
                    orders.forEach(apiOrder => {
                        const existing = state.kitchenOrders.find(o => o.id === apiOrder.id);
                        if (!existing) {
                            state.kitchenOrders.push(apiOrder);
                        }
                    });
                }
                origPopulate();
            }).catch(() => origPopulate());
        } else {
            origPopulate();
        }
    };
})();

// --- Kitchen Expo View ---
(function wireKitchenExpo() {
    const expoBtn = document.getElementById('btn-expo-view');
    if (expoBtn) {
        expoBtn.addEventListener('click', () => {
            if (typeof APIClient !== 'undefined') {
                APIClient.getKitchenExpo().then(data => {
                    const orders = data.orders || data || [];
                    const panel = document.getElementById('expo-panel');
                    if (!panel) return;
                    panel.innerHTML = orders.length === 0
                        ? '<p style="text-align:center;color:var(--text-muted);padding:16px;">No orders ready for expo</p>'
                        : orders.map(o =>
                            '<div style="padding:12px;background:var(--bg-elevated);border-radius:8px;margin-bottom:8px;">' +
                            '<div style="display:flex;justify-content:space-between;">' +
                            '<strong>Order #' + (o.ticketId || o.id || '') + '</strong>' +
                            '<span style="font-size:0.8rem;color:var(--text-dim);">' + (o.status || '') + '</span></div>' +
                            '<div style="font-size:0.85rem;margin-top:4px;">' +
                            (o.items || []).map(i => i.name + ' x' + (i.qty || 1)).join(', ') +
                            '</div></div>'
                        ).join('');
                }).catch(() => {});
            }
        });
    }
})();
