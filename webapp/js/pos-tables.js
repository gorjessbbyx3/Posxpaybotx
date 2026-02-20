/**
 * POS Tables - Table Management, Reservations, Merge & Transfer
 *
 * Depends on: pos-core.js (TABLES, state, $, $$, showToast, formatCurrency)
 * Must be loaded AFTER pos-core.js
 */

// ==========================================
// Table Layout Configuration
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

// ==========================================
// Table Rendering
// ==========================================
function populateTables() {
    const grid = $('#table-grid');
    grid.innerHTML = '';

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
            ${data.server ? '<span class="table-vis-server">' + escapeHtml(data.server) + '</span>' : ''}
            ${timeStr ? '<span class="table-vis-time">' + timeStr + '</span>' : ''}
        `;

        el.addEventListener('click', () => handleTableClick(tbl, data));
        grid.appendChild(el);
    });

    updateTableSummary();
}

function handleTableClick(tbl, data) {
    // Handle pending transfer/merge
    if (pendingTransfer) {
        completeTableTransfer(tbl, data);
        return;
    }

    if (data.status === 'available') {
        data.status = 'occupied';
        data.server = state.currentUser;
        data.startTime = new Date().toISOString();
        state.ticket.table = tbl.number;

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
                    <button class="btn-confirm" id="table-detail-merge" style="flex:1; background:var(--warning);">Merge</button>
                    <button class="btn-cancel" id="table-detail-close" style="flex:1">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('close-table-detail').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('table-detail-close').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('table-detail-transfer').addEventListener('click', () => {
            modal.classList.remove('active');
            startTableTransfer(tbl.number);
        });
        document.getElementById('table-detail-merge').addEventListener('click', () => {
            modal.classList.remove('active');
            startTableMerge(tbl.number);
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
                <div style="font-weight: 600;">${escapeHtml(data.server || 'Unassigned')}</div>
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
// Table Merge & Transfer
// ==========================================
let pendingTransfer = null;

function startTableTransfer(sourceTable) {
    pendingTransfer = { source: sourceTable, merge: false };
    showToast('Select destination table to transfer to', 'warning');
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

function completeTableTransfer(destTbl, destData) {
    if (!pendingTransfer) return;

    const sourceData = TABLES.find(t => t.number === pendingTransfer.source);
    if (!sourceData) {
        cancelTransfer();
        return;
    }

    if (pendingTransfer.merge) {
        // Merge: combine both tables' orders
        if (destData.status !== 'occupied') {
            showToast('Can only merge with an occupied table', 'error');
            cancelTransfer();
            return;
        }
        // Find tickets for both tables and merge them
        const sourceTickets = state.allTickets.filter(t => t.table === pendingTransfer.source && t.status === 'open');
        sourceTickets.forEach(t => { t.table = destTbl.number; });
        sourceData.status = 'dirty';
        sourceData.server = null;
        showToast(`Table ${pendingTransfer.source} merged into Table ${destTbl.number}`);
    } else {
        // Transfer: move order from source to dest
        if (destData.status !== 'available') {
            showToast('Can only transfer to an available table', 'error');
            cancelTransfer();
            return;
        }
        const destEntry = TABLES.find(t => t.number === destTbl.number);
        if (destEntry) {
            destEntry.status = 'occupied';
            destEntry.server = sourceData.server;
            destEntry.startTime = sourceData.startTime;
            destEntry.amount = sourceData.amount;
        }
        // Update tickets
        state.allTickets.filter(t => t.table === pendingTransfer.source && t.status === 'open')
            .forEach(t => { t.table = destTbl.number; });
        if (state.ticket.table === pendingTransfer.source) {
            state.ticket.table = destTbl.number;
        }
        sourceData.status = 'available';
        sourceData.server = null;
        sourceData.startTime = null;
        sourceData.amount = null;
        showToast(`Table ${pendingTransfer.source} transferred to Table ${destTbl.number}`);
    }

    cancelTransfer();
    populateTables();
}

function cancelTransfer() {
    pendingTransfer = null;
    document.querySelectorAll('.table-visual').forEach(el => {
        el.classList.remove('transfer-target');
    });
}

// ==========================================
// Table Reservation System
// ==========================================
const reservations = [];

(function initReservations() {
    const reservationModal = document.getElementById('reservation-modal');
    if (!reservationModal) return;

    const closeBtn = document.getElementById('close-reservation');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            reservationModal.classList.remove('active');
        });
    }

    const resBtn = document.getElementById('btn-reservations');
    if (resBtn) {
        resBtn.addEventListener('click', () => {
            openReservationModal();
        });
    }

    const saveBtn = document.getElementById('res-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
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

            // Sync to API backend
            if (typeof APIClient !== 'undefined') {
                APIClient.createReservation(res).catch(() => {});
            }

            if (res.table) {
                const tbl = TABLES.find(t => t.number === parseInt(res.table));
                if (tbl) tbl.status = 'reserved';
                populateTables();
            }

            document.getElementById('res-name').value = '';
            document.getElementById('res-phone').value = '';
            document.getElementById('res-notes').value = '';
            document.getElementById('res-party-size').value = '2';
            document.getElementById('res-table').value = '';

            refreshReservationList();
            showToast(`Reservation for ${name} at ${formatResTime(res.time)}`);
        });
    }
})();

function openReservationModal() {
    const reservationModal = document.getElementById('reservation-modal');
    if (!reservationModal) return;
    reservationModal.classList.add('active');

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('res-date').value = today;

    const tableSelect = document.getElementById('res-table');
    tableSelect.innerHTML = '<option value="">Auto-assign</option>';
    TABLES.forEach(t => {
        tableSelect.innerHTML += `<option value="${escapeHtml(String(t.number))}">Table ${escapeHtml(String(t.number))} (${parseInt(t.seats) || 0} seats)</option>`;
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

    const listEl = document.getElementById('res-list');
    if (!listEl) return;

    if (todayRes.length === 0) {
        listEl.innerHTML = '<p class="res-empty">No reservations today</p>';
    } else {
        listEl.innerHTML = todayRes.sort((a, b) => a.time.localeCompare(b.time)).map((r, idx) => {
            const timeStr = formatResTime(r.time);
            return `
                <div class="res-card ${r.status}">
                    <div class="res-card-header">
                        <strong>${escapeHtml(r.name)}</strong>
                        <span class="res-time">${timeStr}</span>
                    </div>
                    <div class="res-card-details">
                        <span>Party of ${parseInt(r.partySize) || 0}</span>
                        ${r.table ? '<span>Table ' + escapeHtml(String(r.table)) + '</span>' : ''}
                        ${r.phone ? '<span>' + escapeHtml(r.phone) + '</span>' : ''}
                    </div>
                    ${r.notes ? '<div class="res-card-notes">' + escapeHtml(r.notes) + '</div>' : ''}
                    <div class="res-card-actions">
                        <button class="res-btn-sm" onclick="seatReservation(${reservations.indexOf(r)})">Seat</button>
                        <button class="res-btn-sm res-btn-noshow" onclick="noShowReservation(${reservations.indexOf(r)})">No Show</button>
                        <button class="res-btn-sm res-btn-cancel" onclick="cancelReservation(${reservations.indexOf(r)})">Cancel</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    const upEl = document.getElementById('res-upcoming');
    if (!upEl) return;

    if (upcoming.length === 0) {
        upEl.innerHTML = '<p class="res-empty">No upcoming reservations</p>';
    } else {
        upEl.innerHTML = upcoming.slice(0, 10).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(r => {
            const dateStr = new Date(r.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `
                <div class="res-upcoming-row">
                    <span>${dateStr} ${formatResTime(r.time)}</span>
                    <span>${escapeHtml(r.name)} (${parseInt(r.partySize) || 0})</span>
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

function seatReservation(idx) {
    const res = reservations[idx];
    if (!res) return;
    res.status = 'seated';

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
