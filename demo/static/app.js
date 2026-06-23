// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

let currentSection = 'dashboard';
let queueData = { ekkremis: [], ready: [], completed: [] };
const DOC_TYPE_COLOR = '#8B95A5';
let showAllReady = false;
let readySearchTerm = '';
let completedSearchTerm = '';

// ═══════════════════════════════════════════════════════════════════════
// Accepted account ordering (user-customizable)
// ═══════════════════════════════════════════════════════════════════════

let savedAccountOrder = []; // Loaded from settings

function getOrderedAcceptedAccounts(accounts) {
    const uniq = Array.from(new Set(accounts || []));
    if (!savedAccountOrder || savedAccountOrder.length === 0) {
        // No custom order - fallback to alphabetical
        return uniq.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }
    // Sort by saved order; accounts not in saved list go at the end alphabetically
    const orderMap = {};
    savedAccountOrder.forEach((code, idx) => { orderMap[code] = idx; });
    return uniq.sort((a, b) => {
        const ia = orderMap[a] !== undefined ? orderMap[a] : 99999;
        const ib = orderMap[b] !== undefined ? orderMap[b] : 99999;
        if (ia !== ib) return ia - ib;
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
}

// How many Accepted-queue orders each ROC account currently owns
function _accountQueueCounts() {
    const counts = {};
    (queueData.ready || []).forEach(o => {
        const acc = (o.roc_account || '').trim();
        if (acc) counts[acc] = (counts[acc] || 0) + 1;
    });
    return counts;
}

function _roItem(account, count) {
    const c = count || 0;
    return `<div class="ro-item" draggable="true" data-account="${escapeHtml(account)}">
        <span class="ro-grip" aria-hidden="true"><i data-lucide="grip-vertical" class="icon"></i></span>
        <span class="ro-rank">1</span>
        <div class="ro-main">
            <div class="ro-name">${escapeHtml(account)}<span class="ro-first-tag"><i data-lucide="zap" style="width:10px;height:10px;"></i>First</span></div>
            <div class="ro-meta"><span class="mono">${c}</span> order${c === 1 ? '' : 's'} in queue</div>
        </div>
        <div class="ro-moves">
            <button type="button" onclick="moveAccountOrder(this, -1)" title="Move up" aria-label="Move ${escapeHtml(account)} up"><i data-lucide="chevron-up" class="icon"></i></button>
            <button type="button" onclick="moveAccountOrder(this, 1)" title="Move down" aria-label="Move ${escapeHtml(account)} down"><i data-lucide="chevron-down" class="icon"></i></button>
        </div>
    </div>`;
}

function showReorderAccountsModal() {
    const counts = _accountQueueCounts();
    const ordered = getOrderedAcceptedAccounts(Object.keys(counts));
    const list = document.getElementById('reorder-list');
    const countEl = document.getElementById('reorder-count');
    if (!list) return;

    if (ordered.length === 0) {
        list.innerHTML = `<div class="tl-empty"><i data-lucide="inbox" class="icon"></i><span>No accounts have orders in the Accepted queue yet.</span></div>`;
        if (countEl) countEl.textContent = '0 accounts';
    } else {
        list.innerHTML = ordered.map(acc => _roItem(acc, counts[acc])).join('');
        if (countEl) countEl.textContent = ordered.length + (ordered.length === 1 ? ' account' : ' accounts');
        _wireReorderDrag(list);
        updateReorderNumbers();
    }
    openDlg(document.getElementById('dlg-reorder'));
}

// Drag-to-rank with a glowing insertion line (drop-before / drop-after)
function _wireReorderDrag(list) {
    let dragSrc = null;
    const clearMarks = () => list.querySelectorAll('.ro-item').forEach(el => el.classList.remove('drop-before', 'drop-after'));
    list.querySelectorAll('.ro-item').forEach(item => {
        item.addEventListener('dragstart', (e) => { dragSrc = item; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        item.addEventListener('dragend', () => { item.classList.remove('dragging'); clearMarks(); updateReorderNumbers(); });
        item.addEventListener('dragover', (e) => {
            e.preventDefault(); e.dataTransfer.dropEffect = 'move';
            if (item === dragSrc) return;
            const r = item.getBoundingClientRect();
            const after = e.clientY > r.top + r.height / 2;
            clearMarks(); item.classList.add(after ? 'drop-after' : 'drop-before');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drop-before', 'drop-after'));
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!dragSrc || dragSrc === item) { clearMarks(); return; }
            const r = item.getBoundingClientRect();
            const after = e.clientY > r.top + r.height / 2;
            list.insertBefore(dragSrc, after ? item.nextSibling : item);
            clearMarks(); updateReorderNumbers();
        });
    });
}

function moveAccountOrder(btn, direction) {
    const item = btn.closest('.ro-item');
    const list = item.parentElement;
    const items = Array.from(list.children);
    const idx = items.indexOf(item);
    if (direction === -1 && idx > 0) list.insertBefore(item, items[idx - 1]);
    else if (direction === 1 && idx < items.length - 1) list.insertBefore(item, items[idx + 1].nextSibling);
    updateReorderNumbers();
    // Keep keyboard focus on the same row's control after it moves (a11y)
    const btns = item.querySelectorAll('.ro-moves button');
    const want = direction === -1 ? btns[0] : btns[1];
    if (want && !want.disabled) want.focus();
    else (item.querySelector('.ro-moves button:not(:disabled)') || item).focus();
}

function updateReorderNumbers() {
    const list = document.getElementById('reorder-list');
    if (!list) return;
    const items = list.querySelectorAll('.ro-item');
    items.forEach((item, idx) => {
        const rank = item.querySelector('.ro-rank');
        if (rank) rank.textContent = idx + 1;
        const btns = item.querySelectorAll('.ro-moves button');
        if (btns[0]) btns[0].disabled = (idx === 0);
        if (btns[1]) btns[1].disabled = (idx === items.length - 1);
    });
    refreshIcons();
}

function hideReorderAccountsModal() {
    closeDlg(document.getElementById('dlg-reorder'));
}

async function saveAccountOrder() {
    const list = document.getElementById('reorder-list');
    if (!list) return;
    const order = Array.from(list.querySelectorAll('.ro-item')).map(item => item.dataset.account);
    const result = await api('/settings/accepted-account-order', 'POST', { order });
    if (result?.success) {
        savedAccountOrder = order;
        hideReorderAccountsModal();
        showToast('Account order saved', 'success');
        renderReadyTable();
    }
}

let savedAgentAccountOrder = [];

// Generic drag-to-reorder: attaches drag events to all direct children of `list`.
// Calls `onDrop()` after a successful reorder with the new order of data-key values.
function setupDragReorder(list, onDrop) {
    let dragSrc = null;
    list.querySelectorAll(':scope > [draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragSrc = item;
            item.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            list.querySelectorAll(':scope > [draggable]').forEach(el => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            if (dragSrc && dragSrc !== item) {
                const items = Array.from(list.children);
                const fromIdx = items.indexOf(dragSrc);
                const toIdx = items.indexOf(item);
                if (fromIdx < toIdx) list.insertBefore(dragSrc, item.nextSibling);
                else list.insertBefore(dragSrc, item);
                if (onDrop) onDrop();
            }
        });
    });
}

function renderAccountsList(accounts, agentOrder) {
    const list = document.getElementById('accounts-list');
    if (!list) return;
    if (!accounts || accounts.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">No accounts configured yet.</p>';
        return;
    }
    // Sort accounts by saved agent processing order
    const orderMap = {};
    (agentOrder || []).forEach((code, idx) => { orderMap[code] = idx; });
    const sorted = [...accounts].sort((a, b) => {
        const ia = orderMap[a.code] !== undefined ? orderMap[a.code] : 99999;
        const ib = orderMap[b.code] !== undefined ? orderMap[b.code] : 99999;
        return ia !== ib ? ia - ib : (a.code || '').localeCompare(b.code || '', undefined, { sensitivity: 'base' });
    });

    list.innerHTML = sorted.map(acc => {
        const eName = escapeHtml(acc.username || acc.code);
        const eCode = escapeHtml(acc.code);
        const masterOff = !acc.enabled;
        const fOn = !masterOff && acc.finder_enabled !== false;
        const dOn = !masterOff && acc.downloader_enabled !== false;
        const pw = acc.has_password ? '••••••' : '<span class="badge badge-warning">No password</span>';
        const enabledBadge = acc.bad_password
            ? `<span class="badge badge-danger" style="cursor:pointer;" onclick="editAccount('${eCode}')" title="Click to fix password">Check Password</span>`
            : `<span class="badge ${acc.enabled ? 'badge-success' : 'badge-muted'}" style="cursor:pointer;" onclick="toggleAccountEnabled('${eCode}')">${acc.enabled ? 'Enabled' : 'Disabled'}</span>`;
        const agentChips = `<span class="agent-chip ${fOn ? 'active' : 'inactive'}${masterOff ? ' master-off' : ''}" title="${masterOff ? 'Account disabled' : (fOn ? 'Finder ON - click to disable' : 'Finder OFF - click to enable')}" onclick="${masterOff ? '' : `toggleAgentAccount('${eCode}','finder_enabled',${!fOn})`}">F</span>`
            + `<span class="agent-chip ${dOn ? 'active' : 'inactive'}${masterOff ? ' master-off' : ''}" title="${masterOff ? 'Account disabled' : (dOn ? 'Downloader ON - click to disable' : 'Downloader OFF - click to enable')}" onclick="${masterOff ? '' : `toggleAgentAccount('${eCode}','downloader_enabled',${!dOn})`}">D</span>`;
        return `<div class="accounts-drag-item${acc.bad_password ? ' bad-pw' : ''}" draggable="true" data-account="${eCode}">
            <div class="accounts-drag-handle"><i data-lucide="grip-vertical" class="icon"></i></div>
            <div class="accounts-drag-info">
                <div class="accounts-drag-name">${eName}</div>
                <div class="accounts-drag-meta">${pw} ${enabledBadge} ${agentChips}</div>
            </div>
            <div class="accounts-drag-actions">
                <button class="btn btn-sm btn-ghost" id="test-btn-${eCode}" onclick="testAccount('${eCode}')" title="Test"><i data-lucide="plug-zap" class="icon"></i></button>
                <button class="btn btn-sm btn-ghost" onclick="editAccount('${eCode}')" title="Edit"><i data-lucide="pencil" class="icon"></i></button>
                <button class="btn btn-sm btn-danger" onclick="removeAccount('${eCode}')" title="Remove"><i data-lucide="trash-2" class="icon"></i></button>
            </div>
        </div>`;
    }).join('');

    setupDragReorder(list, () => {
        const order = Array.from(list.querySelectorAll('.accounts-drag-item')).map(el => el.dataset.account);
        savedAgentAccountOrder = order;
        api('/settings/agent-account-order', 'POST', { order });
    });
    refreshIcons();
}

let downloaderNextRunMs = null;
let downloaderNextRunLabel = null;
let downloaderNextMode = 'manual'; // manual | auto
let downloaderUiState = 'stopped';  // stopped | idle | processing

function refreshIcons() {
    try {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (_) {}
}

function _staggerRows(tbody) {
    if (!tbody.hasAttribute('data-rendered')) {
        const rows = tbody.querySelectorAll('tr:not(.group-header-row)');
        const cap = 20;
        rows.forEach((row, i) => {
            if (i < cap) {
                row.style.animationDelay = `${i * 30}ms`;
            }
        });
        requestAnimationFrame(() => { tbody.setAttribute('data-rendered', '1'); });
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Custom Select Component
// Replaces native <select> with a styled dropdown that matches the design system.
// Usage: add class="custom-select-source" to a <select>, then call initCustomSelects().
// The original <select> is hidden and kept in sync as the data source.
// ═══════════════════════════════════════════════════════════════════════

const _csInstances = new Map(); // selectId → { wrapper, trigger, dropdown, ... }

function initCustomSelects() {
    document.querySelectorAll('select.custom-select-source').forEach(sel => {
        if (_csInstances.has(sel.id)) {
            // Already initialized - just refresh options
            _csRefreshOptions(sel.id);
            return;
        }
        _csCreate(sel);
    });
}

function _csCreate(sel) {
    const id = sel.id;
    const isCompact = sel.classList.contains('cs-compact');

    // Hide the native select
    sel.style.display = 'none';
    sel.setAttribute('tabindex', '-1');
    sel.setAttribute('aria-hidden', 'true');

    // Build wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select' + (isCompact ? ' cs-compact' : '');
    wrapper.dataset.for = id;
    sel.parentNode.insertBefore(wrapper, sel);

    // Trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-dropdown');
    trigger.innerHTML = `<span class="cs-label"></span><svg class="cs-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
    wrapper.appendChild(trigger);

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    dropdown.id = id + '-dropdown';
    dropdown.setAttribute('role', 'listbox');
    wrapper.appendChild(dropdown);

    const hasSearch = sel.options.length > 6;

    const inst = { wrapper, trigger, dropdown, sel, hasSearch, focusIdx: -1 };
    _csInstances.set(id, inst);

    // Build options
    _csRefreshOptions(id);

    // Event: toggle on trigger click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) {
            _csClose(id);
        } else {
            _csOpen(id);
        }
    });

    // Keyboard nav on trigger
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            _csOpen(id);
        } else if (e.key === 'Escape') {
            _csClose(id);
        }
    });
}

function _csRefreshOptions(id) {
    const inst = _csInstances.get(id);
    if (!inst) return;
    const { sel, dropdown, hasSearch } = inst;

    let html = '';
    if (hasSearch || sel.options.length > 6) {
        html += `<input type="text" class="custom-select-search" placeholder="Search..." aria-label="Search options">`;
        inst.hasSearch = true;
    }
    html += '<div class="cs-options-list">';
    for (let i = 0; i < sel.options.length; i++) {
        const opt = sel.options[i];
        const isSelected = opt.value === sel.value;
        const isSpecial = opt.value === '__custom__';
        html += `<div class="custom-select-option${isSelected ? ' selected' : ''}${isSpecial ? ' special' : ''}" data-value="${escapeHtml(opt.value)}" data-index="${i}" role="option" aria-selected="${isSelected}">${escapeHtml(opt.textContent)}</div>`;
    }
    html += '</div>';
    dropdown.innerHTML = html;

    // Update trigger label
    _csUpdateLabel(id);

    // Bind option clicks
    dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
        optEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = optEl.dataset.value;
            sel.value = val;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            _csClose(id);
            _csRefreshOptions(id);
        });
    });

    // Bind search input
    const searchInput = dropdown.querySelector('.custom-select-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            dropdown.querySelectorAll('.custom-select-option').forEach(optEl => {
                const text = optEl.textContent.toLowerCase();
                const val = optEl.dataset.value;
                // Always show "None" and special options when query is empty
                optEl.style.display = (text.includes(q) || val === '' || val === '__custom__') ? '' : 'none';
            });
            inst.focusIdx = -1;
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { _csClose(id); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                _csMoveFocus(id, e.key === 'ArrowDown' ? 1 : -1);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const focused = dropdown.querySelector('.custom-select-option.focused');
                if (focused) focused.click();
            }
        });
    }
}

function _csUpdateLabel(id) {
    const inst = _csInstances.get(id);
    if (!inst) return;
    const { sel, trigger } = inst;
    const labelEl = trigger.querySelector('.cs-label');
    const selectedOpt = sel.options[sel.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
        labelEl.textContent = selectedOpt.textContent;
        labelEl.classList.remove('cs-placeholder');
    } else if (selectedOpt) {
        labelEl.textContent = selectedOpt.textContent;
        labelEl.classList.add('cs-placeholder');
    }
}

function _csOpen(id) {
    // Close any other open selects first
    _csInstances.forEach((_, otherId) => { if (otherId !== id) _csClose(otherId); });

    const inst = _csInstances.get(id);
    if (!inst) return;
    const { wrapper, trigger, dropdown } = inst;

    // Flip detection: if dropdown would go below viewport, open upward
    const rect = wrapper.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    wrapper.classList.toggle('flip', spaceBelow < 240);

    wrapper.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    inst.focusIdx = -1;

    // Focus search input if present, otherwise focus the dropdown for key nav
    const searchInput = dropdown.querySelector('.custom-select-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        requestAnimationFrame(() => searchInput.focus());
    } else {
        requestAnimationFrame(() => trigger.focus());
    }

    // Close on outside click (one-time listener)
    setTimeout(() => {
        const handler = (e) => {
            if (!wrapper.contains(e.target)) {
                _csClose(id);
                document.removeEventListener('click', handler, true);
            }
        };
        document.addEventListener('click', handler, true);
        // Store so we can remove if closed another way
        inst._outsideHandler = handler;
    }, 0);
}

function _csClose(id) {
    const inst = _csInstances.get(id);
    if (!inst) return;
    const { wrapper, trigger } = inst;
    wrapper.classList.remove('open', 'flip');
    trigger.setAttribute('aria-expanded', 'false');
    inst.focusIdx = -1;
    if (inst._outsideHandler) {
        document.removeEventListener('click', inst._outsideHandler, true);
        inst._outsideHandler = null;
    }
}

function _csMoveFocus(id, dir) {
    const inst = _csInstances.get(id);
    if (!inst) return;
    const opts = Array.from(inst.dropdown.querySelectorAll('.custom-select-option:not([style*="display: none"])'));
    if (!opts.length) return;
    opts.forEach(o => o.classList.remove('focused'));
    inst.focusIdx += dir;
    if (inst.focusIdx < 0) inst.focusIdx = opts.length - 1;
    if (inst.focusIdx >= opts.length) inst.focusIdx = 0;
    opts[inst.focusIdx].classList.add('focused');
    opts[inst.focusIdx].scrollIntoView({ block: 'nearest' });
}

/** Programmatically set value and refresh the custom select UI */
function csSetValue(selectId, value) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.value = value;
    _csRefreshOptions(selectId);
}

/** Programmatically refresh options (call after dynamically changing <option> elements) */
function csRefresh(selectId) {
    _csRefreshOptions(selectId);
}

/** Destroy a custom select instance (for dynamically created ones) */
function csDestroy(selectId) {
    const inst = _csInstances.get(selectId);
    if (!inst) return;
    inst.wrapper.parentNode.insertBefore(inst.sel, inst.wrapper);
    inst.wrapper.remove();
    inst.sel.style.display = '';
    inst.sel.removeAttribute('aria-hidden');
    _csInstances.delete(selectId);
}

// Relative timestamp formatter for the activity log
function _relativeTime(timestamp) {
    if (!timestamp || timestamp === '--:--:--') return '--:--:--';
    try {
        // timestamp is HH:MM:SS - build a Date from today
        const parts = timestamp.split(':');
        if (parts.length < 3) return timestamp;
        const now = new Date();
        const then = new Date();
        then.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10), 0);
        // If the time is in the future (past midnight edge), show raw
        if (then > now) return timestamp;
        const diffS = Math.floor((now - then) / 1000);
        if (diffS < 10)   return 'just now';
        if (diffS < 60)   return `${diffS}s ago`;
        if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
        if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
        return timestamp;
    } catch (_) { return timestamp; }
}


function formatCountdown(msLeft) {
    if (msLeft <= 0) return '00:00';
    const totalSec = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtLocalTime(isoOrMs) {
    try {
        const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
        return null;
    }
}

function tickDownloaderCountdown() {
    const el = document.getElementById('agent-a-next');
    if (!el) return;

    if (downloaderUiState === 'processing') {
        el.textContent = 'Running…';
        return;
    }

    if (!downloaderNextRunMs) {
        el.textContent = downloaderNextMode === 'auto' ? '-' : 'Manual only';
        return;
    }

    const msLeft = downloaderNextRunMs - Date.now();
    const countdown = formatCountdown(msLeft);
    const timeLabel = downloaderNextRunLabel || fmtLocalTime(downloaderNextRunMs) || '';
    el.textContent = timeLabel ? `${timeLabel} • ${countdown}` : countdown;
}

// Live countdown
setInterval(tickDownloaderCountdown, 1000);

// (click-to-close handler is registered below)

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════

let _previousSection = 'dashboard';

// Top-nav pill click handlers
document.querySelectorAll('.top-nav-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        const section = pill.dataset.section;
        if (section) switchSection(section);
    });
});

// Arrow-key navigation within tablist (WAI-ARIA tabs pattern)
document.querySelector('.top-nav-pills')?.addEventListener('keydown', (e) => {
    const pills = [...document.querySelectorAll('.top-nav-pill')];
    const idx = pills.indexOf(document.activeElement);
    if (idx < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (idx + 1) % pills.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (idx - 1 + pills.length) % pills.length;
    } else if (e.key === 'Home') {
        next = 0;
    } else if (e.key === 'End') {
        next = pills.length - 1;
    }
    if (next >= 0) {
        e.preventDefault();
        pills[next].focus();
        switchSection(pills[next].dataset.section);
    }
});

function switchSection(section) {
    const prevSection = currentSection;       // captured before we mutate, for slide direction
    _previousSection = currentSection;
    currentSection = section;                 // set now so _afterSectionSwap()/refreshData() read the new section

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) {
        _applySectionSwap(section);
        _afterSectionSwap(section);
        return Promise.resolve();             // awaitable for callers that sequence on the switch (tour)
    }

    // Slide direction from the nav pills' DOM order (forward = moving right along the nav).
    const pills = [...document.querySelectorAll('.top-nav-pill')].map(p => p.dataset.section);
    document.documentElement.dataset.vtDir =
        pills.indexOf(section) >= pills.indexOf(prevSection) ? 'forward' : 'back';

    const vt = document.startViewTransition(() => _applySectionSwap(section));
    // A newer switch (rapid tab clicks) skips this transition, which rejects vt.ready with
    // "Transition was skipped" — expected; swallow it so it isn't an unhandled rejection.
    vt.ready.catch(() => {});
    const done = vt.finished.finally(() => { delete document.documentElement.dataset.vtDir; }).catch(() => {});
    _afterSectionSwap(section);               // data refresh runs outside the transition (never blocks the snapshot)
    return done;                              // resolves when the slide finishes (tour awaits this)
}

// The synchronous visual swap captured by the View Transition (pills, active section, cog, indicator).
function _applySectionSwap(section) {
    document.querySelectorAll('.top-nav-pill').forEach(pill => {
        const isActive = pill.dataset.section === section;
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
        pill.tabIndex = isActive ? 0 : -1;
    });
    updatePillIndicator();

    document.querySelectorAll('.section').forEach(s => {
        s.classList.toggle('active', s.id === `section-${section}`);
    });
    // Tab switches start at the top. The document itself is the scroller (the sticky
    // nav stays pinned), so reset the window scroll inside the swap — otherwise the new
    // tab inherits the old offset and the View Transition captures a mid-scroll jump.
    window.scrollTo(0, 0);
    const _scroller = document.querySelector('.main > .content');
    if (_scroller) _scroller.scrollTop = 0;   // belt-and-suspenders if a build makes .content the scroller

    // Toggle nav cog icon: settings → back arrow, otherwise → cog
    const cogBtn = document.getElementById('nav-cog-btn');
    if (cogBtn) {
        const inSettings = section === 'settings';
        cogBtn.classList.toggle('active', inSettings);
        cogBtn.innerHTML = `<i data-lucide="${inSettings ? 'arrow-left' : 'settings'}" class="icon"></i>`;
        cogBtn.title = inSettings ? 'Back' : 'Settings (Ctrl+,)';
        if (window.lucide) lucide.createIcons({ nodes: [cogBtn] });
    }
}

// Async/content work that should not be captured by (or block) the transition.
function _afterSectionSwap(section) {
    if (section === 'orders') {
        requestAnimationFrame(updateSegmentIndicator);
    }
    if (section === 'approvals') {
        loadNameCandidates();
    }
    refreshData();
}

// View Transitions own all section motion when available; flag <html> so the CSS fallback
// keyframe (.section -> sectionFadeIn) is disabled and never double-animates after a transition.
if (document.startViewTransition) document.documentElement.classList.add('has-vt');

function toggleSettings() {
    if (currentSection === 'settings') {
        switchSection(_previousSection === 'settings' ? 'dashboard' : _previousSection);
    } else {
        switchSection('settings');
    }
}

function goBackFromSettings() {
    switchSection(_previousSection === 'settings' ? 'dashboard' : _previousSection);
}

function goToOrders(segment) {
    switchSection('orders');
    if (segment) switchSegment(segment);
}

function reviewAttentionOrders() {
    switchSection('orders');
    switchSegment('ready');
    setTimeout(() => {
        const el = document.querySelector('.attention-header-row');
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('issue-target-flash');
        void el.offsetWidth;
        el.classList.add('issue-target-flash');
        setTimeout(() => el.classList.remove('issue-target-flash'), 2200);
    }, 200);
}

// Pill indicator positioning
function updatePillIndicator() {
    const container = document.querySelector('.top-nav-pills');
    const indicator = container?.querySelector('.pill-indicator');
    const activePill = container?.querySelector('.top-nav-pill.active');
    if (!indicator || !activePill || !container) return;

    const zoom = parseFloat(document.body.style.zoom) || 1;
    const containerRect = container.getBoundingClientRect();
    const pillRect = activePill.getBoundingClientRect();
    indicator.style.width = (pillRect.width / zoom) + 'px';
    indicator.style.transform = `translateX(${(pillRect.left - containerRect.left) / zoom}px)`;
}

// Initialize pill indicator position after icons render
requestAnimationFrame(() => requestAnimationFrame(updatePillIndicator));
window.addEventListener('resize', () => { updatePillIndicator(); updateSegmentIndicator(); });

// ═══════════════════════════════════════════════════════════════════════
// SEGMENT SWITCHER (Orders: Pending / Accepted / Completed)
// ═══════════════════════════════════════════════════════════════════════

let currentSegment = 'ekkremis';

document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSegment(btn.dataset.segment));
});

// Arrow-key nav within segment radiogroup
document.querySelector('.segment-switcher')?.addEventListener('keydown', (e) => {
    const btns = [...document.querySelectorAll('.segment-btn')];
    const idx = btns.indexOf(document.activeElement);
    if (idx < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % btns.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + btns.length) % btns.length;
    if (next >= 0) {
        e.preventDefault();
        btns[next].focus();
        switchSegment(btns[next].dataset.segment);
    }
});

function switchSegment(segment) {
    currentSegment = segment;

    document.querySelectorAll('.segment-btn').forEach(btn => {
        const isActive = btn.dataset.segment === segment;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        btn.tabIndex = isActive ? 0 : -1;
    });

    document.querySelectorAll('.orders-subsection').forEach(sub => {
        sub.classList.toggle('active', sub.id === `subsection-${segment}`);
    });

    updateSegmentIndicator();
}

function updateSegmentIndicator() {
    const container = document.querySelector('.segment-switcher');
    const indicator = container?.querySelector('.segment-indicator');
    const activeBtn = container?.querySelector('.segment-btn.active');
    if (!indicator || !activeBtn || !container) return;

    const zoom = parseFloat(document.body.style.zoom) || 1;
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    indicator.style.width = (btnRect.width / zoom) + 'px';
    indicator.style.transform = `translateX(${(btnRect.left - containerRect.left) / zoom}px)`;
}

// ═══════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════

async function api(endpoint, method = 'GET', data = null, opts = {}) {
    try {
        const options = { method };
        if (data) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(data);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 30000);
        options.signal = controller.signal;
        const response = await fetch(`/api${endpoint}`, options);
        clearTimeout(timeoutId);
        if (!response.ok) {
            let detail = '';
            let errBody = null;
            try {
                errBody = await response.json();
                detail = errBody.detail || errBody.error || '';
            } catch (_) { detail = response.statusText; }
            // License lapsed/expired mid-session → re-show the lock screen, not a toast.
            if (response.status === 403 && errBody && errBody.error === 'license_required') {
                if (typeof refreshLicenseStatus === 'function') refreshLicenseStatus();
                return null;
            }
            if (!opts.silent) showToast(`Request failed: ${detail || 'Server error'}`, 'error');
            console.error('API Error:', response.status, detail);
            return null;
        }
        return await response.json();
    } catch (e) {
        if (e.name === 'AbortError') {
            if (!opts.silent) showToast('Request timed out, backend may be busy', 'warning');
        } else {
            console.error('API Error:', e);
        }
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// DATA REFRESH
// ═══════════════════════════════════════════════════════════════════════

let _refreshCycle = 0; // Cycle counter for staggered refreshes
async function refreshData() {
    _refreshCycle++;
    // Core data: refresh every cycle (5s)
    const tasks = [refreshStatus(), refreshActivity()];
    // Queue: refresh every cycle (5s)
    tasks.push(refreshQueue());
    // Settings & blocklist: refresh every 6th cycle (30s) - they rarely change
    if (_refreshCycle % 6 === 0) {
        tasks.push(refreshSettings(), refreshBlocklist(), refreshTrelloStatus());
    }
    // License + sync check: every 12th cycle (60s)
    if (_refreshCycle % 12 === 0) {
        tasks.push(refreshLicenseStatus());
        tasks.push(refreshSyncStatus());
    }
    await Promise.all(tasks);
}

function updateGreeting() {
    const h = new Date().getHours();
    const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    const el = document.getElementById('dashboard-greeting');
    if (!el) return;
    const fullName = (_licenseData && _licenseData.customer_name)
        || (window.settingsData && window.settingsData.display_name)
        || '';
    const name = fullName.trim().split(/\s+/)[0] || '';
    el.textContent = name ? `Good ${period}, ${name}` : `Good ${period}`;
}

function refreshSetupNudge(status) {
    const el = document.getElementById('setup-nudge');
    if (!el) return;

    const checks = [
        {
            id: 'accounts',
            ok: (status.accounts || 0) > 0,
            text: 'Add your ROC accounts so agents can log in',
            panel: 'accounts',
        },
        {
            id: 'download',
            ok: !!(status.download_directory),
            text: 'Set a download folder for certificates',
            panel: 'download',
        },
    ];

    const missing = checks.filter(c => !c.ok);
    if (missing.length === 0) {
        el.style.display = 'none';
        return;
    }

    el.style.display = '';
    el.innerHTML =
        `<div class="setup-nudge__header"><i data-lucide="list-checks" class="icon"></i>Get started</div>` +
        `<div class="setup-nudge__list">` +
        checks.map(c =>
            `<div class="setup-nudge__item${c.ok ? ' done' : ''}">` +
            `<span class="setup-nudge__dot"></span>` +
            `<span>${c.text}</span>` +
            (c.ok ? '' : ` <a class="setup-nudge__link" onclick="switchSection('settings');switchSettingsPanel('${c.panel}')">Set up</a>`) +
            `</div>`
        ).join('') +
        `</div>`;
    refreshIcons();
}

async function refreshStatus() {
    const status = await api('/status');
    if (!status) return;
    updateGreeting();
    refreshSetupNudge(status);

    // Stats
    const ekkCount = status.queue?.in_ekkremis || 0;
    const rdyCount = status.queue?.ready_to_download || 0;
    const cmpCount = status.queue?.completed || 0;
    document.getElementById('stat-ekkremis').textContent = ekkCount;
    document.getElementById('stat-ready').textContent = rdyCount;
    document.getElementById('stat-completed').textContent = cmpCount;
    document.getElementById('stat-accounts').textContent = status.accounts || 0;
    const subEl = document.getElementById('dashboard-subtitle');
    if (subEl) {
        const total = ekkCount + rdyCount + cmpCount;
        subEl.textContent = total > 0 ? `${total} orders in the pipeline today.` : 'No orders in the pipeline yet.';
    }
    
    // Nav badge - combined order count
    const totalOrders = ekkCount + rdyCount;
    const ordersBadge = document.getElementById('nav-orders-count');
    if (ordersBadge) {
        ordersBadge.textContent = totalOrders;
        ordersBadge.style.display = totalOrders > 0 ? 'inline' : 'none';
    }
    // Segment count badges
    const segEk = document.getElementById('seg-ekkremis-count');
    const segRd = document.getElementById('seg-ready-count');
    const segCo = document.getElementById('seg-completed-count');
    if (segEk) segEk.textContent = ekkCount;
    if (segRd) segRd.textContent = rdyCount;
    if (segCo) segCo.textContent = cmpCount;
    
    // Finder
    const finderCard = document.getElementById('agent-b-card');
    const finderStatus = document.getElementById('agent-b-status');
    if (status.finder?.running || status.agent_b?.running) {
        finderCard.classList.add('running');
        const finderData = status.finder?.status || status.agent_b?.status;
        const finderPaused = finderData?.paused_reason;
        if (finderPaused === 'blocked') {
            finderStatus.className = 'agent-status status-tag';
            finderStatus.innerHTML = '<span class="dot"></span><span>Paused · ROC block</span>';
        } else if (finderPaused === 'off_hours') {
            finderStatus.className = 'agent-status status-tag idle';
            finderStatus.innerHTML = '<span class="dot"></span><span>Off hours</span>';
        } else if (finderPaused === 'no_accounts') {
            finderStatus.className = 'agent-status status-tag idle';
            finderStatus.innerHTML = '<span class="dot"></span><span>Paused · No accounts</span>';
        } else {
            finderStatus.className = 'agent-status status-tag live';
            finderStatus.innerHTML = '<span class="dot"></span><span>Live</span>';
        }
        document.getElementById('agent-b-accounts').textContent = finderData?.accounts_active || finderData?.accounts_logged_in || 0;
        document.getElementById('agent-b-scans').textContent = finderData?.scans_completed || 0;
        _showMissingAccountsBanner(
            !!finderData?.missing_accounts_alert,
            finderData?.missing_accounts || [],
            finderData?.accounts_active || 0,
            finderData?.accounts_expected || 0,
        );
    } else {
        finderCard.classList.remove('running');
        finderStatus.className = 'agent-status status-tag';
        finderStatus.innerHTML = '<span class="dot"></span><span>Stopped</span>';
        _showMissingAccountsBanner(false, [], 0, 0);
    }
    
    // Downloader
    const downloaderCard = document.getElementById('agent-a-card');
    const downloaderStatus = document.getElementById('agent-a-status');
    const downloaderState = status.downloader?.state || 'stopped';
    const schedulerEnabled = status.downloader?.scheduler_enabled || false;
    const intervalMinutes = status.downloader?.interval_minutes || 120;

    downloaderUiState = downloaderState;
    downloaderNextMode = schedulerEnabled ? 'auto' : 'manual';
    
    // Update state display
    if (downloaderState === 'processing') {
        downloaderCard.classList.add('running');
        downloaderStatus.className = 'agent-status status-tag live';
        downloaderStatus.innerHTML = '<span class="dot"></span><span>Working</span>';
        document.getElementById('agent-a-state').textContent = 'Working';
    } else if (downloaderState === 'idle') {
        downloaderCard.classList.add('running');
        downloaderStatus.className = 'agent-status status-tag idle';
        downloaderStatus.innerHTML = '<span class="dot"></span><span>Waiting</span>';
        document.getElementById('agent-a-state').textContent = 'Waiting';
    } else {
        downloaderCard.classList.remove('running');
        downloaderStatus.className = 'agent-status status-tag';
        downloaderStatus.innerHTML = '<span class="dot"></span><span>Ready</span>';
        document.getElementById('agent-a-state').textContent = 'Ready';
    }
    
    // Update auto-run display
    document.getElementById('agent-a-auto').textContent = schedulerEnabled ? 'ON' : 'OFF';
    document.getElementById('agent-a-auto').style.color = schedulerEnabled ? '#7bb449' : 'var(--text-muted)';
    
    const autoBtn = document.getElementById('btn-auto-toggle');
    if (autoBtn) {
        autoBtn.textContent = schedulerEnabled ? 'Auto: ON' : 'Auto: OFF';
        autoBtn.classList.toggle('btn-success', schedulerEnabled);
        autoBtn.classList.toggle('btn-ghost', !schedulerEnabled);
    }
    
    // Update interval input (only if not focused)
    const intervalInput = document.getElementById('downloader-interval');
    const unitSelect = document.getElementById('downloader-interval-unit');
    if (intervalInput && document.activeElement !== intervalInput) {
        if (intervalMinutes >= 60 && intervalMinutes % 60 === 0) {
            intervalInput.value = intervalMinutes / 60;
            unitSelect.value = 'hours';
        } else {
            intervalInput.value = intervalMinutes;
            unitSelect.value = 'minutes';
        }
    }

    // Next check: show schedule + live countdown
    if (downloaderState === 'idle' && schedulerEnabled && status.downloader?.next_run) {
        const t = Date.parse(status.downloader.next_run);
        downloaderNextRunMs = isNaN(t) ? null : t;
        downloaderNextRunLabel = fmtLocalTime(status.downloader.next_run);
    } else {
        downloaderNextRunMs = null;
        downloaderNextRunLabel = null;
    }
    tickDownloaderCountdown();
}

let _queueLastHash = '';
async function refreshQueue(force) {
    const data = await api('/queue');
    if (!data) return;

    if (!force) {
        const ek = data.ekkremis || [], rd = data.ready || [], cp = data.completed || [];
        const rdFp = rd.map(o => o.order_id + (o.status || '') + (o.last_error ? '1' : '0')).join('|');
        const hash = ek.length + ',' + rd.length + ',' + cp.length
            + (ek[0]?.order_id || '') + (cp[0]?.order_id || '')
            + rdFp;
        if (hash === _queueLastHash) return;
        _queueLastHash = hash;
    } else {
        _queueLastHash = ''; // Invalidate cache for next auto-refresh too
    }

    queueData = data;
    renderEkkremisTable();
    renderReadyTable();
    renderCompletedTable();
    renderOrderAttentionBanner();
}

let _logData = [];
let _logFilterAgent = 'all';
let _logLastHash = '';

// Log level icon mapping (kept for potential future use with icon badges)
function _logLevelIcon(level) {
    switch (level) {
        case 'SUCCESS': return 'check-circle';
        case 'WARNING': return 'alert-triangle';
        case 'ERROR':   return 'x-circle';
        default:        return 'info';
    }
}

// Agent tag from server-side classification (agent field in entry)
// Fallback regex for entries without agent field (backward compat)
const _AGENT_RE = /^(?:\[?(Finder|Downloader|System|Supervisor)\]?):?\s*/i;

function _agentLabel(agent) {
    return agent === 'finder' ? 'Finder' : agent === 'downloader' ? 'Downloader' : 'System';
}

function _getAgent(entry) {
    if (entry.agent) return entry.agent;
    const m = _AGENT_RE.exec(entry.message);
    if (m) { const a = m[1].toLowerCase(); return a === 'supervisor' ? 'system' : a; }
    return 'system';
}

// Composite queue keys are internal ("3100694_C1", "3100694_389619", "3100694_N1").
// Show them in the activity feed as a readable "order (company)" label instead of the
// raw underscore key. Derived from the key alone, so it works for historical events too.
function _prettyOrderRefs(text) {
    if (!text || text.indexOf('_') === -1) return text;
    return text.replace(/\b(\d{4,})_(C\d+|N\d+|\d+)\b/g, (_full, base, suffix) => {
        if (suffix[0] === 'C') return `${base} (new company)`;
        if (suffix[0] === 'N') return `${base} (name ${suffix.slice(1)})`;
        return `${base} (HE${suffix})`;
    });
}

function _cleanMessage(entry) {
    let msg = entry.message;
    // Strip agent prefix from display message (already shown in tag)
    const m = _AGENT_RE.exec(msg);
    if (m) msg = msg.slice(m[0].length);
    return _prettyOrderRefs(msg);
}

function _buildLogEntryHTML(entry, isNew) {
    const agent = _getAgent(entry);
    const cleanMsg = _cleanMessage(entry);
    const level = entry.level || 'INFO';
    const tagClass = agent === 'finder' ? 'finder' : agent === 'downloader' ? 'downloader' : 'system';
    const relTime = _relativeTime(entry.timestamp);
    const newCls = isNew ? ' log-new' : '';
    return `<div class="log-entry ${level}${newCls}" data-agent="${agent}"><div class="log-timeline"><div class="log-dot"></div></div><div class="log-body"><div class="log-body-top"><span class="log-agent-tag ${tagClass}">${escapeHtml(_agentLabel(agent))}</span><span class="log-time" title="${escapeHtml(entry.timestamp)}">${relTime}</span></div><div class="log-message">${escapeHtml(cleanMsg)}</div></div></div>`;
}

function _filterLogEntries(entries) {
    const searchTerm = (document.getElementById('log-search')?.value || '').toLowerCase();
    let filtered = entries;

    if (_logFilterAgent !== 'all') {
        filtered = filtered.filter(e => _getAgent(e) === _logFilterAgent);
    }
    if (searchTerm) {
        filtered = filtered.filter(e => e.message.toLowerCase().includes(searchTerm));
    }
    return filtered;
}

// Unique key for a log entry - used to detect which entries are already rendered
function _logKey(entry) {
    return entry.timestamp + '|' + entry.message;
}

// Set of keys currently in the DOM
let _renderedKeys = new Set();
// Track the filter/search state that produced the current DOM
let _renderedFilterState = '';

function _renderLogEntries(entries, forceRender) {
    const container = document.getElementById('activity-log');
    if (!container) return;

    const filtered = _filterLogEntries(entries);
    const filterState = _logFilterAgent + ':' + (document.getElementById('log-search')?.value || '');

    // Update count badge
    const countEl = document.getElementById('log-entry-count');
    if (countEl) {
        const total = entries.length;
        const shown = filtered.length;
        countEl.textContent = shown < total ? `${shown} / ${total}` : `${total} events`;
    }

    // The server returns a curated set (latest 50 plus always the last 5 Finder and
    // 5 Downloader entries), so we render exactly that set. Rebuild only when it
    // actually changes; animate entries that are genuinely new.
    const keys = filtered.map(_logKey);
    const sig = filterState + '|' + keys.join('~');
    if (!forceRender && sig === _logLastHash) return;
    const filterChanged = filterState !== _renderedFilterState;
    const animate = _renderedKeys.size > 0 && !filterChanged && !forceRender;
    const prevKeys = _renderedKeys;
    _logLastHash = sig;
    _renderedFilterState = filterState;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="log-entry INFO" data-agent="system"><div class="log-timeline"><div class="log-dot"></div></div><div class="log-body"><div class="log-body-top"><span class="log-time">--:--:--</span></div><div class="log-message">No matching events.</div></div></div>`;
        _renderedKeys = new Set();
        return;
    }

    const prevScroll = container.scrollTop;
    const parts = filtered.map((e, i) => _buildLogEntryHTML(e, animate && !prevKeys.has(keys[i])));
    container.innerHTML = parts.join('');
    container.scrollTop = prevScroll;
    _renderedKeys = new Set(keys);
}

function filterLog(agent) {
    if (agent && agent !== _logFilterAgent) {
        _logFilterAgent = agent;
    } else if (agent && agent === _logFilterAgent && agent !== 'all') {
        _logFilterAgent = 'all';
    }
    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.agent === _logFilterAgent);
    });
    _renderLogEntries(_logData, true);
}

let _activityVersion = 0;
async function refreshActivity() {
    const data = await api(`/activity?since_version=${_activityVersion}`);
    if (!data) return;
    if (data.version) _activityVersion = data.version;
    if (!data.log) return; // Server says no change - skip render entirely
    _logData = data.log;
    _renderLogEntries(_logData);
}

async function refreshSettings() {
    const data = await api('/settings');
    if (!data) return;
    
    // Store for other functions (like manual add form)
    window.settingsData = data;

    // Restore theme from server (source of truth for persistence)
    applyTheme(data.theme_mode || 'system');

    if (data.zoom_level) _applyZoom(data.zoom_level);

    // Load saved account order for Accepted dashboard
    savedAccountOrder = data.accepted_account_order || [];
    // Load saved agent processing order
    savedAgentAccountOrder = data.agent_account_order || [];
    
    document.getElementById('download-dir').value = data.download_directory || '';

    const notifChk = document.getElementById('notifications-enabled-chk');
    if (notifChk) notifChk.checked = data.notifications_enabled !== false;
    const nameInp = document.getElementById('display-name-input');
    if (nameInp) nameInp.value = data.display_name || '';
    
    // Update headless button states
    const agentAHeadless = data.agent_a_headless ?? false;
    const agentBHeadless = data.agent_b_headless ?? true;
    
    document.getElementById('agent-a-visible-btn').classList.toggle('btn-success', !agentAHeadless);
    document.getElementById('agent-a-headless-btn').classList.toggle('btn-primary', agentAHeadless);
    document.getElementById('agent-b-visible-btn').classList.toggle('btn-success', !agentBHeadless);
    document.getElementById('agent-b-headless-btn').classList.toggle('btn-primary', agentBHeadless);

    // Finder schedule (interval + active-hours window)
    const finderIntervalEl = document.getElementById('finder-interval');
    if (finderIntervalEl) finderIntervalEl.value = Math.max(5, Math.round((data.agent_b_interval_seconds ?? 420) / 60));
    const finderActiveChk = document.getElementById('finder-active-hours-chk');
    if (finderActiveChk) finderActiveChk.checked = data.finder_active_hours_enabled !== false;
    const fStart = document.getElementById('finder-start-hour');
    if (fStart) fStart.value = data.finder_active_start_hour ?? 8;
    const fEnd = document.getElementById('finder-end-hour');
    if (fEnd) fEnd.value = data.finder_active_end_hour ?? 19;
    _finderDays = Array.isArray(data.finder_active_days) ? data.finder_active_days.slice() : [0, 1, 2, 3, 4];
    _renderFinderDays();
    _updateFinderHoursVisibility();

    // Update download folder mode pill state
    const folderMode = data.download_folder_mode || 'organized';
    const orgBtn = document.getElementById('folder-mode-organized-btn');
    const flatBtn = document.getElementById('folder-mode-flat-btn');
    orgBtn.classList.toggle('active', folderMode === 'organized');
    flatBtn.classList.toggle('active', folderMode === 'flat');
    orgBtn.setAttribute('aria-checked', folderMode === 'organized' ? 'true' : 'false');
    flatBtn.setAttribute('aria-checked', folderMode === 'flat' ? 'true' : 'false');
    
    renderAccountsList(data.accounts, data.agent_account_order || []);
    updatePasswordBanner(data.accounts || []);

    // Render label presets
    renderLabelPresets(data.label_presets || []);
    // Render client presets (settings card only - does NOT touch form dropdowns)
    renderClientPresets(data.client_presets || []);
    // Trello integration UI
    refreshTrelloUI();

    // Auto-update settings
    const autoUpdateChk = document.getElementById('auto-update-chk');
    if (autoUpdateChk) autoUpdateChk.checked = data.auto_update_enabled !== false;
    const verLabel = document.getElementById('current-version-label');
    if (verLabel) verLabel.textContent = data.version || '?';
    _refreshTokenStatus(!!data.github_update_token);
    const skippedEl = document.getElementById('skipped-version-info');
    if (skippedEl) {
        if (data.skipped_version) {
            skippedEl.style.display = '';
            skippedEl.querySelector('span').textContent = `v${data.skipped_version} skipped`;
        } else {
            skippedEl.style.display = 'none';
        }
    }

    refreshIcons();
}

// Legacy per-banner functions are kept as no-ops so existing call sites don't
// break. All credential/config failures now flow through /api/health/issues
// and render in the #issues-stack via refreshIssues().
function _showMissingAccountsBanner() { /* handled by refreshIssues */ }
function _showBadPasswordBanner() { /* handled by refreshIssues */ }

// ═══════════════════════════════════════════════════════════════════════
// NEEDS-ATTENTION ISSUE STACK (UX5)
// ═══════════════════════════════════════════════════════════════════════

const _dismissedIssuesKey = 'roc_dismissed_issues_v1';

function _getDismissedIssues() {
    try {
        return new Set(JSON.parse(localStorage.getItem(_dismissedIssuesKey) || '[]'));
    } catch {
        return new Set();
    }
}

function _setDismissedIssues(set) {
    try {
        localStorage.setItem(_dismissedIssuesKey, JSON.stringify([...set]));
    } catch { /* localStorage unavailable */ }
}

function dismissIssue(id) {
    const dismissed = _getDismissedIssues();
    dismissed.add(id);
    _setDismissedIssues(dismissed);
    refreshIssues();
}

function issueAction(target) {
    switchSection('settings');
    // Defer scroll + flash until the Settings section has painted.
    setTimeout(() => {
        const el = document.querySelector(target);
        if (!el) return;
        // If the target lives inside a settings panel, open that panel first.
        const panel = el.closest('.settings-panel');
        if (panel && panel.id.startsWith('settings-')) {
            switchSettingsPanel(panel.id.slice('settings-'.length));
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('issue-target-flash');
        // Force reflow so the class re-adds triggers the animation.
        void el.offsetWidth;
        el.classList.add('issue-target-flash');
        setTimeout(() => el.classList.remove('issue-target-flash'), 2200);
    }, 150);
}

async function refreshIssues() {
    const stack = document.getElementById('issues-stack');
    if (!stack) return;
    let data;
    try {
        const res = await fetch('/api/health/issues', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        data = await res.json();
    } catch {
        return;
    }
    const issues = (data && data.issues) || [];
    const dismissed = _getDismissedIssues();
    const activeIds = new Set(issues.map(i => i.id));

    // Prune dismissals for issues that have since cleared (re-arm on reappearance).
    let pruned = false;
    for (const id of [...dismissed]) {
        if (!activeIds.has(id)) { dismissed.delete(id); pruned = true; }
    }
    if (pruned) _setDismissedIssues(dismissed);

    const visible = issues.filter(i => !dismissed.has(i.id));
    if (visible.length === 0) {
        stack.innerHTML = '';
        return;
    }
    stack.innerHTML = visible.map(issue => {
        const idAttr = escapeHtml(issue.id);

        if (issue.severity === 'update') {
            return _renderUpdateBanner(issue, idAttr);
        }

        const sev = ['error', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'warning';
        const title = escapeHtml(issue.title || '');
        const desc = escapeHtml(issue.desc || '');
        const actionLabel = escapeHtml(issue.action_label || 'Fix');
        const actionTarget = escapeHtml(issue.action_target || '');
        const sevIcon = sev === 'error' ? 'alert-octagon' : sev === 'warning' ? 'alert-triangle' : 'info';
        return `
        <div class="issue-banner issue-banner--${sev}" data-issue-id="${idAttr}" role="alert">
            <div class="issue-banner__icon-wrap">
                <i data-lucide="${sevIcon}" class="icon"></i>
            </div>
            <div class="issue-banner__content">
                <div class="issue-banner__heading">${title}</div>
                ${desc ? `<div class="issue-banner__desc">${desc}</div>` : ''}
            </div>
            <div class="issue-banner__buttons">
                <button class="btn btn-sm btn-ghost" onclick="dismissIssue('${idAttr}')">Dismiss</button>
                <button class="btn btn-sm btn-ghost" onclick="issueAction('${actionTarget}')">${actionLabel}</button>
            </div>
        </div>`;
    }).join('');
    refreshIcons();
}

// ═══════════════════════════════════════════════════════════════════════
// AUTO-UPDATE UI
// ═══════════════════════════════════════════════════════════════════════

let _updateDownloadPollTimer = null;
let _updateDownloadState = 'idle'; // idle|downloading|done|error

function _cleanChangelog(raw) {
    if (!raw) return '';
    return raw
        .replace(/^#{1,4}\s+/gm, '')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function _renderUpdateBanner(issue, idAttr) {
    const ver = escapeHtml(issue.version || '');
    const cleaned = _cleanChangelog(issue.changelog || '');
    const desc = cleaned
        ? escapeHtml(cleaned).replace(/\n/g, '. ').replace(/\. •/g, '. ')
        : '';

    let actionsHtml = '';
    let progressHtml = '';
    if (_updateDownloadState === 'downloading') {
        actionsHtml = `
            <button class="btn btn-sm btn-ghost" disabled style="opacity:0.6;">
                <i data-lucide="loader" class="icon" style="animation:spin 1s linear infinite;"></i> Downloading...
            </button>`;
        progressHtml = `
            <div class="update-banner__progress" id="update-progress" style="margin-top:8px;">
                <div class="update-banner__progress-bar">
                    <div class="update-banner__progress-fill" id="update-progress-fill" style="width:0%"></div>
                </div>
                <div class="update-banner__progress-text" id="update-progress-text">Downloading...</div>
            </div>`;
    } else if (_updateDownloadState === 'done') {
        actionsHtml = `
            <button class="btn btn-sm btn-primary" onclick="installUpdate()">
                <i data-lucide="rocket" class="icon"></i> Install Now
            </button>
            <span style="font-size:11px;color:var(--text-muted);">App will restart</span>`;
        progressHtml = `
            <div class="update-banner__progress" id="update-progress" style="margin-top:8px;">
                <div class="update-banner__progress-bar">
                    <div class="update-banner__progress-fill" id="update-progress-fill" style="width:100%"></div>
                </div>
                <div class="update-banner__progress-text" id="update-progress-text">Download complete</div>
            </div>`;
    } else {
        actionsHtml = `
            <button class="btn btn-sm btn-ghost" onclick="skipUpdateVersion()">Skip</button>
            <button class="btn btn-sm btn-primary" onclick="startUpdateDownload()">
                <i data-lucide="download" class="icon"></i> Update
            </button>`;
        progressHtml = `
            <div class="update-banner__progress" id="update-progress" style="display:none;margin-top:8px;">
                <div class="update-banner__progress-bar">
                    <div class="update-banner__progress-fill" id="update-progress-fill" style="width:0%"></div>
                </div>
                <div class="update-banner__progress-text" id="update-progress-text">Preparing...</div>
            </div>`;
    }

    return `
    <div class="issue-banner issue-banner--update" data-issue-id="${idAttr}" role="alert">
        <div class="issue-banner__icon-wrap">
            <i data-lucide="download" class="icon"></i>
        </div>
        <div class="issue-banner__content">
            <div class="issue-banner__heading">PandaRoc v${ver} is available</div>
            ${desc ? `<div class="issue-banner__desc">${desc}</div>` : ''}
            ${progressHtml}
        </div>
        <div class="issue-banner__buttons" id="update-actions">
            ${actionsHtml}
        </div>
    </div>`;
}

async function startUpdateDownload() {
    const result = await api('/update/download', 'POST');
    if (!result) return;

    _updateDownloadState = 'downloading';
    refreshIssues();
    _pollUpdateProgress();
}

function _pollUpdateProgress() {
    if (_updateDownloadPollTimer) clearInterval(_updateDownloadPollTimer);
    _updateDownloadPollTimer = setInterval(async () => {
        let data;
        try {
            const res = await fetch('/api/update/progress', { signal: AbortSignal.timeout(5000) });
            if (!res.ok) return;
            data = await res.json();
        } catch { return; }

        const fill = document.getElementById('update-progress-fill');
        const text = document.getElementById('update-progress-text');
        const actions = document.getElementById('update-actions');
        if (!fill || !text) return;

        if (data.state === 'downloading') {
            const pct = data.percent || 0;
            if (fill) fill.style.width = pct + '%';
            const mb = ((data.bytes || 0) / 1024 / 1024).toFixed(1);
            const totalMb = ((data.total || 0) / 1024 / 1024).toFixed(0);
            if (text) text.textContent = `${mb} / ${totalMb} MB (${pct}%)`;
        } else if (data.state === 'done') {
            clearInterval(_updateDownloadPollTimer);
            _updateDownloadPollTimer = null;
            _updateDownloadState = 'done';
            refreshIssues();
        } else if (data.state === 'error') {
            clearInterval(_updateDownloadPollTimer);
            _updateDownloadPollTimer = null;
            _updateDownloadState = 'idle';
            refreshIssues();
            showToast(data.error || 'Download failed', 'error');
        }
    }, 800);
}

async function installUpdate() {
    const actions = document.getElementById('update-actions');
    if (actions) {
        actions.innerHTML = `
            <span style="font-size:13px;color:var(--text-secondary);">
                <i data-lucide="loader" class="icon" style="width:14px;height:14px;animation:spin 1s linear infinite;vertical-align:middle;"></i>
                Launching installer...
            </span>`;
        refreshIcons();
    }
    await api('/update/install', 'POST');
}

async function skipUpdateVersion() {
    const result = await api('/update/skip', 'POST');
    if (result?.success) {
        showToast('Update skipped - you can check again in Settings', 'info');
        refreshIssues();
    }
}

async function checkForUpdates() {
    const btn = document.getElementById('check-updates-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="icon" style="animation:spin 1s linear infinite;"></i> Checking...';
        refreshIcons();
    }
    const result = await api('/update/check');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="refresh-cw" class="icon"></i> Check now';
        refreshIcons();
    }
    if (!result) return;
    if (result.available && !result.skipped) {
        showToast(`Update v${result.version} available!`, 'success');
        refreshIssues();
    } else if (result.available && result.skipped) {
        showToast(`v${result.version} available (skipped)`, 'info');
    } else {
        showToast('You\'re on the latest version', 'success');
    }
}

async function toggleAutoUpdate(enabled) {
    const result = await api('/settings/auto-update', 'POST', { enabled });
    if (result?.success) {
        showToast(`Auto-update ${enabled ? 'enabled' : 'disabled'}`, 'success');
    }
}

async function saveGithubToken() {
    const input = document.getElementById('github-token-input');
    if (!input) return;
    const token = input.value.trim();
    const result = await api('/settings/github-token', 'POST', { token });
    if (result?.success) {
        showToast(token ? 'GitHub token saved' : 'GitHub token cleared', 'success');
        input.value = '';
        _refreshTokenStatus(!!token);
    }
}

function _refreshTokenStatus(hasToken) {
    const badge = document.getElementById('github-token-status');
    if (!badge) return;
    if (hasToken) {
        badge.className = 'chip success';
        badge.innerHTML = '<i data-lucide="check" class="icon" style="width:12px;height:12px;"></i> Token configured';
    } else {
        badge.className = 'chip warn';
        badge.innerHTML = '<i data-lucide="alert-triangle" class="icon" style="width:12px;height:12px;"></i> No token set';
    }
    refreshIcons();
}

async function unskipUpdate() {
    const result = await api('/update/unskip', 'POST');
    if (result?.success) {
        showToast('Skipped version cleared', 'success');
        refreshIssues();
    }
}

const _dismissedAttentionKey = 'roc_dismissed_attention_v1';

function _getDismissedAttention() {
    try { return new Set(JSON.parse(localStorage.getItem(_dismissedAttentionKey) || '[]')); }
    catch { return new Set(); }
}

function dismissAttentionBanner() {
    const orders = (queueData.ready || []).filter(o => {
        const err = (o.last_error || '').toLowerCase();
        return o.last_error === 'NAME_REJECTED' || err.includes('returned') || err.includes('not found');
    });
    const key = orders.map(o => o.order_id).sort().join(',');
    const dismissed = _getDismissedAttention();
    dismissed.add(key);
    try { localStorage.setItem(_dismissedAttentionKey, JSON.stringify([...dismissed])); } catch {}
    renderOrderAttentionBanner();
}

function renderOrderAttentionBanner() {
    const container = document.getElementById('order-attention-banner');
    if (!container) return;
    const orders = (queueData.ready || []).filter(o => {
        const err = (o.last_error || '').toLowerCase();
        return o.last_error === 'NAME_REJECTED' || err.includes('returned') || err.includes('not found');
    });
    if (!orders.length) { container.innerHTML = ''; return; }

    const key = orders.map(o => o.order_id).sort().join(',');
    if (_getDismissedAttention().has(key)) { container.innerHTML = ''; return; }

    const count = orders.length;
    const title = `${count} order${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} attention`;
    const details = orders.slice(0, 3).map(o => {
        const name = escapeHtml(o.company_name || 'Unknown');
        const id = escapeHtml(displayOrderId(o.order_id || ''));
        const err = o.last_error || '';
        let reason = 'needs review';
        if (err === 'NAME_REJECTED') reason = 'name was rejected';
        else if (err.toLowerCase().includes('returned')) reason = 'was returned for corrections';
        else if (err.toLowerCase().includes('not found')) reason = 'was not found';
        return `${name} (#${id}) ${reason}`;
    }).join('. ');
    const suffix = count > 3 ? ` And ${count - 3} more.` : '';
    const desc = details + '.' + (suffix ? ' ' + suffix : '') + ' Review and resubmit.';

    container.innerHTML = `
        <div class="issue-banner issue-banner--attention" role="alert">
            <div class="issue-banner__icon-wrap">
                <i data-lucide="alert-triangle" class="icon issue-banner__icon"></i>
            </div>
            <div class="issue-banner__content">
                <div class="issue-banner__heading">${title}</div>
                <div class="issue-banner__desc">${desc}</div>
            </div>
            <div class="issue-banner__buttons">
                <button class="btn btn-sm btn-ghost" onclick="dismissAttentionBanner()">Dismiss</button>
                <button class="btn btn-sm btn-attention-review" onclick="reviewAttentionOrders()">Review</button>
            </div>
        </div>`;
    refreshIcons();
}

// ═══════════════════════════════════════════════════════════════════════
// TABLE RENDERING
// ═══════════════════════════════════════════════════════════════════════
function renderEkkremisTable() {
    const tbody = document.getElementById('ekkremis-table-body');
    const empty = document.getElementById('ekkremis-empty');
    const orders = queueData.ekkremis || [];

    if (orders.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    function renderEkkremisRow(order) {
        const isNA = order.service_type === 'name_approval';
        const noName = !order.company_name || order.company_name === 'Unknown Company' || (order.company_name || '').trim() === '';

        const labelHtml = `${getLabelBadge(order)}${getDocTypeBadge(order) ? ' ' + getDocTypeBadge(order) : ''}${getExpectedDocsBadge(order) ? ' ' + getExpectedDocsBadge(order) : ''}`;
        const dateHtml = getOrderDisplayDateHtml(order);

        const companyHtml = (isNA && noName)
            ? `<em style="color:#e8891a;cursor:pointer;font-size:12px;" onclick="showEditOrderModal('${order.order_id}')" title="Click to enter company name">⚠ Click to enter company name</em>`
            : escapeHtml(order.company_name);

        return `
        <tr>
            <td><strong>${displayOrderId(order.order_id)}</strong></td>
            <td>${order.he_number ? `<span class="he-number">HE${order.he_number}</span>` : '-'}</td>
            <td class="company-name" title="${isNA && noName ? 'ROC does not show company name for name approvals - click to edit' : escapeHtml(order.company_name)}">${nameSlotBadge(order)}${companyHtml}</td>
            <td>${getTypeBadge(order.service_type)}</td>
            <td>${labelHtml}${getClientBadge(order)}</td>
            <td>${dateHtml}</td>
            <td>${order.decision_pending ? getDecisionPendingBadge() : getDecisionBadge(order.decision)}</td>
            <td>
                <div class="row-actions ek-decide-actions">
                    <button class="btn btn-sm btn-success" title="Approve and download this order once it is ready" onclick="setDecision('${order.order_id}', 'accepted')"><i data-lucide="check" class="icon"></i>Approve</button>
                    <button class="btn btn-sm btn-danger" title="Reject this order (it will not be downloaded)" onclick="setDecision('${order.order_id}', 'rejected')"><i data-lucide="x" class="icon"></i>Reject</button>
                    <button class="icon-btn" title="Edit" onclick="showEditOrderModal('${order.order_id}')"><i data-lucide="pencil" class="icon"></i></button>
                    <button class="icon-btn" title="Block order (stop it returning)" onclick="blockOrder('${order.order_id}')"><i data-lucide="ban" class="icon"></i></button>
                </div>
            </td>
        </tr>
    `;
    }

    // Group by account, same layout as accepted tab
    const groups = {};
    orders.forEach(o => {
        const acc = (o.roc_account || 'Unknown').toString().trim() || 'Unknown';
        if (!groups[acc]) groups[acc] = [];
        groups[acc].push(o);
    });
    const accountList = getOrderedAcceptedAccounts(Object.keys(groups));

    const groupsHtml = accountList.map(acc => {
        const rows = (groups[acc] || []).map(o => renderEkkremisRow(o)).join('');
        return `
            <tr class="group-header-row">
                <td colspan="8">
                    <div class="group-header">
                        <div class="group-title">${escapeHtml(acc)}</div>
                        <div class="group-count">${groups[acc].length}</div>
                    </div>
                </td>
            </tr>
            ${rows}
        `;
    }).join('');

    tbody.innerHTML = groupsHtml;
    refreshIcons();
    _staggerRows(tbody);
}

function renderReadyTable() {
    const tbody = document.getElementById('ready-table-body');
    const empty = document.getElementById('ready-empty');
    let orders = queueData.ready || [];
    
    // Filter out snoozed unless showAllReady is true
    if (!showAllReady) {
        orders = orders.filter(o => o.decision !== 'snoozed');
    }
    
    if (orders.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    // Apply search filter (across all accounts)
    const term = (readySearchTerm || '').trim().toLowerCase();
    if (term) {
        orders = orders.filter(o => {
            const orderId = (o.order_id || '').toString().toLowerCase();
            const company = (o.company_name || '').toString().toLowerCase();
            const heRaw = (o.he_number || '').toString().toLowerCase();
            const heLabel = ('he' + (o.he_number || '')).toLowerCase();
            const account = (o.roc_account || '').toString().toLowerCase();
            const labelNames = (o.labels || []).map(l => (l.name || '').toLowerCase()).join(' ');
            const clientName = (o.client_name || '').toString().toLowerCase();
            return orderId.includes(term) ||
                   company.includes(term) ||
                   heRaw.includes(term) ||
                   heLabel.includes(term) ||
                   account.includes(term) ||
                   labelNames.includes(term) ||
                   clientName.includes(term);
        });
    }

    if (orders.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        const titleEl = empty.querySelector('.empty-title');
        const subEl = empty.querySelector('.empty-subtitle');
        if (term) {
            if (titleEl) titleEl.textContent = 'No Matching Orders';
            if (subEl) subEl.textContent = 'No results found. Try searching by order number, company name, HE number, account, or client.';
        } else {
            if (titleEl) titleEl.textContent = 'No Accepted Orders';
            if (subEl) subEl.textContent = "Accept orders from Pending Services and they will appear here for download.";
        }
        return;
    }

    empty.style.display = 'none';

    function renderOrderRow(order, hideAccount) {
        const hasComment = order.user_comment && order.user_comment.trim();
        const notes = order.notes || [];
        const noteCount = notes.length;
        const isNA = order.service_type === 'name_approval';
        const noName = !order.company_name || order.company_name === 'Unknown Company';

        // Single action menu (Edit button opens the menu)
        const meta = [];
        if (hasComment) meta.push(`<span title="Has comment"><i data-lucide="message-square" class="icon"></i></span>`);
        if (noteCount > 0) meta.push(`<span title="${noteCount >= 50 ? '50+ processing entries' : noteCount + ' processing entries'}"><i data-lucide="file-text" class="icon"></i><span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${noteCount >= 50 ? '50+' : noteCount}</span></span>`);
        const metaHtml = meta.length ? `<span style="margin-right:10px;display:inline-flex;align-items:center;gap:10px;">${meta.join('')}</span>` : '';

        const companyHtml = (isNA && noName)
            ? `<em style="color:#e8891a;cursor:pointer;font-size:12px;" onclick="showEditOrderModal('${order.order_id}')" title="Click to enter company name">⚠ Click to enter company name</em>`
            : escapeHtml(order.company_name);

        const accountTag = hideAccount ? '' : `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escapeHtml(order.roc_account || 'Unknown')}</div>`;

        return `
        <tr>
            <td><strong>${displayOrderId(order.order_id)}</strong></td>
            <td>${order.he_number ? `<span class="he-number">HE${order.he_number}</span>` : '-'}</td>
            <td class="company-name" title="${isNA && noName ? 'ROC does not show company name for name approvals - click to edit' : escapeHtml(order.company_name)}">${nameSlotBadge(order)}${companyHtml}${accountTag}</td>
            <td>${getTypeBadge(order.service_type)}</td>
            <td>${getLabelBadge(order)}${getDocTypeBadge(order) ? ' ' + getDocTypeBadge(order) : ''}${getExpectedDocsBadge(order) ? ' ' + getExpectedDocsBadge(order) : ''}${getClientBadge(order)}</td>
            <td>${getOrderDisplayDateHtml(order)}</td>
            <td>${getStatusBadge(order)}</td>
            <td>
                ${metaHtml}
                <div class="row-actions">
    <button class="icon-btn spot-check-btn" id="spot-${order.order_id}" title="Check now" onclick="spotCheckOrder('${order.order_id}'); event.stopPropagation();">
<i data-lucide="search" class="icon"></i>
    </button>
    <button class="icon-btn" title="Comments / Notes" onclick="showOrderInfoModal('${order.order_id}')">
<i data-lucide="message-square" class="icon"></i>
    </button>
    <button class="icon-btn" title="Edit order" onclick="showEditOrderModal('${order.order_id}')">
<i data-lucide="pencil" class="icon"></i>
    </button>
    <button class="icon-btn danger" title="Remove from queue" onclick="deleteOrderFromAccepted('${order.order_id}'); event.stopPropagation();">
<i data-lucide="trash-2" class="icon"></i>
    </button>
</div>
            </td>
        </tr>
    `;
    }

    // ── Separate "Needs Attention" orders (rejected, returned) ──
    const attentionOrders = [];
    const normalOrders = [];
    orders.forEach(o => {
        const err = (o.last_error || '').toLowerCase();
        if (o.last_error === 'NAME_REJECTED' || err.includes('returned') || err.includes('not found')) {
            attentionOrders.push(o);
        } else {
            normalOrders.push(o);
        }
    });

    // Rebuild groups from normal orders only
    const normalGroups = {};
    normalOrders.forEach(o => {
        const acc = (o.roc_account || 'Unknown').toString().trim() || 'Unknown';
        if (!normalGroups[acc]) normalGroups[acc] = [];
        normalGroups[acc].push(o);
    });
    const normalAccounts = getOrderedAcceptedAccounts(Object.keys(normalGroups));

    // Build attention section HTML
    let attentionHtml = '';
    if (attentionOrders.length > 0) {
        const attentionRows = attentionOrders.map(o => renderOrderRow(o, false)).join('');
        attentionHtml = `
            <tr class="attention-header-row">
                <td colspan="8">
                    <div class="attention-header">
                        <div class="attention-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Needs Attention</div>
                        <div class="attention-count">${attentionOrders.length}</div>
                    </div>
                </td>
            </tr>
            ${attentionRows}
        `;
    }

    // Build normal account groups
    const groupsHtml = normalAccounts.map(acc => {
        const rows = (normalGroups[acc] || []).map(o => renderOrderRow(o, true)).join('');
        return `
            <tr class="group-header-row">
                <td colspan="8">
                    <div class="group-header">
                        <div class="group-title">${escapeHtml(acc)}</div>
                        <div class="group-count">${normalGroups[acc].length}</div>
                    </div>
                </td>
            </tr>
            ${rows}
        `;
    }).join('');

    tbody.innerHTML = attentionHtml + groupsHtml;refreshIcons();
    _staggerRows(tbody);
    _restoreSpotCheckState();
}

// ═══════════════════════════════════════════════════════════════════════
// PRINT - today's downloads + individual completed orders
// ═══════════════════════════════════════════════════════════════════════
function _printDateTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return isNaN(d) ? ts : d.toLocaleString();
}
function _printDocTypes(order) {
    const dts = order.doc_types || [];
    return dts.length ? dts.join(', ') : '-';
}
function _runPrint(html) {
    const root = document.getElementById('print-root');
    if (!root) return;
    root.innerHTML = html;
    const cleanup = () => { root.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 60);
}
// Sends the actual certificate PDFs saved today to the default printer
// (server-side, via the OS print handler) - not a screen/table printout.
async function printTodaysOrders() {
    const preview = await api('/print/today');
    if (!preview) return; // api() already surfaced the error
    if (!preview.count) { showToast('No certificates downloaded today', 'info'); return; }
    const noun = `certificate${preview.count !== 1 ? 's' : ''}`;
    if (!confirm(`Print ${preview.count} ${noun} downloaded today to your default printer?`)) return;
    const result = await api('/print/today', 'POST');
    if (!result) return;
    if (result.failed) {
        showToast(`Sent ${result.printed} to printer · ${result.failed} failed`, 'warning');
    } else {
        showToast(`Sent ${result.printed} ${noun} to the printer`, 'success');
    }
}
// Prints the actual certificate PDFs for ONE completed order (server-side, silent,
// via the OS default printer) - not a screen/summary printout.
async function printOrder(orderId) {
    const o = (queueData.completed || []).find(x => String(x.order_id) === String(orderId));
    if (!o) { showToast('Order not found', 'error'); return; }
    const preview = await api('/print/order/' + encodeURIComponent(orderId));
    if (!preview) return; // api() already surfaced the error
    if (!preview.count) { showToast('No documents on file for this order', 'info'); return; }
    const noun = `document${preview.count !== 1 ? 's' : ''}`;
    if (!confirm(`Print ${preview.count} ${noun} for order ${displayOrderId(o.order_id)} to your default printer?`)) return;
    const result = await api('/print/order/' + encodeURIComponent(orderId), 'POST');
    if (!result) return;
    if (result.failed) {
        showToast(`Sent ${result.printed} to printer - ${result.failed} could not be printed`, 'warning');
    } else {
        showToast(`Sent ${result.printed} ${noun} to the printer`, 'success');
    }
}

function renderCompletedTable() {
    const tbody = document.getElementById('completed-table-body');
    const empty = document.getElementById('completed-empty');
    let orders = queueData.completed || [];
    
    if (orders.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        const titleEl = empty.querySelector('.empty-title');
        const subEl = empty.querySelector('.empty-subtitle');
        if (titleEl) titleEl.textContent = 'No Completed Downloads';
        if (subEl) subEl.textContent = 'Completed orders will appear here once the Downloader has successfully retrieved them.';
        return;
    }

    // Apply search filter
    const term = (completedSearchTerm || '').trim().toLowerCase();
    if (term) {
        orders = orders.filter(o => {
            const orderId = (o.order_id || '').toString().toLowerCase();
            const company = (o.company_name || '').toString().toLowerCase();
            const heRaw = (o.he_number || '').toString().toLowerCase();
            const heLabel = ('he' + (o.he_number || '')).toLowerCase();
            const account = (o.roc_account || '').toString().toLowerCase();
            const labelNames = (o.labels || []).map(l => (l.name || '').toLowerCase()).join(' ');
            const clientName = (o.client_name || '').toString().toLowerCase();
            return orderId.includes(term) ||
                   company.includes(term) ||
                   heRaw.includes(term) ||
                   heLabel.includes(term) ||
                   account.includes(term) ||
                   labelNames.includes(term) ||
                   clientName.includes(term);
        });
    }

    if (orders.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        const titleEl = empty.querySelector('.empty-title');
        const subEl = empty.querySelector('.empty-subtitle');
        if (term) {
            if (titleEl) titleEl.textContent = 'No Matching Orders';
            if (subEl) subEl.textContent = 'No results found. Try searching by order number, company name, HE number, account, or client.';
        } else {
            if (titleEl) titleEl.textContent = 'No Completed Downloads';
            if (subEl) subEl.textContent = 'Completed orders will appear here once the Downloader has successfully retrieved them.';
        }
        return;
    }
    
    empty.style.display = 'none';
    tbody.innerHTML = orders.map(order => {
        const hasComment = order.user_comment && order.user_comment.trim();
        const notes = order.notes || [];
        const noteCount = notes.length;
        const hasInfo = hasComment || noteCount > 0;
        
        // Build info button
        let infoBtn = '';
        if (hasInfo) {
            const parts = [];
            if (hasComment) parts.push(`<i data-lucide="message-square" class="icon"></i>`);
            if (noteCount > 0) parts.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="file-text" class="icon"></i><span style="font-size:12px;color:var(--text-muted);">${noteCount >= 50 ? '50+' : noteCount}</span></span>`);
            infoBtn = `<button class="info-btn has-content" onclick="actionsShowInfo(event, '${order.order_id}')" title="View details">${parts.join(' ')}</button>`;
        } else {
            infoBtn = `<span style="color:var(--text-muted)">-</span>`;
        }
        
        return `
        <tr>
            <td><strong>${displayOrderId(order.order_id)}</strong></td>
            <td>${order.he_number ? `<span class="he-number">HE${order.he_number}</span>` : '-'}</td>
            <td class="company-name" title="${escapeHtml(order.company_name)}">${escapeHtml(order.company_name)}</td>
            <td>${getTypeBadge(order.service_type)}</td>
            <td>${getLabelBadge(order)}${getDocTypeBadge(order) ? ' ' + getDocTypeBadge(order) : ''}${getClientBadgeStatic(order)}</td>
            <td>${escapeHtml(order.roc_account || '-')}</td>
            <td>${formatTimestamp(order.completed_ts)}</td>
            <td>${order.files_downloaded || 0}${order.expected_documents > 0 ? '/' + order.expected_documents : ''}</td>
            <td>
                <div class="row-actions">
                    ${infoBtn}
                    ${(order.files_downloaded || 0) > 0 ? `<button class="btn btn-sm btn-ghost btn-icon" onclick="printOrder('${order.order_id}')" title="Print this order's documents"><i data-lucide="printer" class="icon" style="width:14px;height:14px;"></i></button>` : ''}
                    <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteCompletedOrder('${order.order_id}')" title="Remove"><i data-lucide="trash-2" class="icon" style="width:14px;height:14px;"></i></button>
                </div>
            </td>
        </tr>
    `}).join('');
    refreshIcons();
    _staggerRows(tbody);
}

// ═══════════════════════════════════════════════════════════════════════
// BADGES & FORMATTING
// ═══════════════════════════════════════════════════════════════════════

function nameSlotBadge(order) {
    // Shown only for multi name-approval orders ("Name 1/2", "Name 2/2", ...).
    const total = order.name_slot_total || 0;
    if (total < 2) return '';
    const slot = order.name_slot || 0;
    return `<span class="badge badge-purple" style="font-size:11px;padding:2px 8px;margin-right:6px;" title="Name approval ${slot} of ${total} for this order">Name ${slot}/${total}</span>`;
}

function getTypeBadge(type) {
    const badges = {
        certificate: '<span class="badge badge-info">Certificates</span>',
        he32: '<span class="badge badge-warning">HE32</span>',
        name_approval: '<span class="badge badge-purple">Name Approval</span>',
        new_company: '<span class="badge badge-success">New Company</span>',
        other: '<span class="badge badge-primary">Other</span>'
    };
    if (badges[type]) return badges[type];
    if (type && type !== 'other') return `<span class="badge badge-primary">${escapeHtml(type)}</span>`;
    return badges.other;
}

function getLabelBadge(order) {
    const labels = order.labels || [];
    if (labels.length === 0) return '';
    return labels.map(lbl => {
        const color = lbl.color || '#6B7280';
        return `<span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44;font-size:11px;padding:2px 8px;" title="Label: ${escapeHtml(lbl.name)}">${escapeHtml(lbl.name)}</span>`;
    }).join(' ');
}

function getDocTypeBadge(order) {
    const types = order.doc_types || [];
    if (types.length === 0) return '';
    const c = DOC_TYPE_COLOR;
    return types.map(dt =>
        `<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44;font-size:11px;padding:2px 8px;" title="Doc type: ${escapeHtml(dt)}">${escapeHtml(dt)}</span>`
    ).join(' ');
}

function getExpectedDocsBadge(order) {
    const exp = order.expected_documents || 0;
    if (exp <= 0) return '';
    const dl = order.files_downloaded || 0;
    const done = dl === exp;
    const mismatch = dl > exp;
    const variant = done ? 'success' : (mismatch ? 'danger' : 'warn');
    const title = done ? `Complete: ${dl}/${exp} document(s)` :
                  mismatch ? `Mismatch: found ${dl} but expected exactly ${exp}` :
                  `Waiting: found ${dl} of ${exp} expected document(s)`;
    return `<span class="chip ${variant}" style="font-size:11px;padding:2px 6px;" title="${title}">${dl}/${exp} docs</span>`;
}

function getClientBadge(order) {
    const client = (order.client_name || '').trim();
    if (client) {
        return ` <span class="badge" style="background:var(--client-preset-bg);color:var(--client-preset-color);border:1px solid var(--client-preset-border);font-size:11px;padding:2px 8px;cursor:pointer;white-space:nowrap;" onclick="showInlineClientPicker('${order.order_id}')" title="Client: ${escapeHtml(client)} - click to change"><i data-lucide="user" style="width:11px;height:11px;display:inline;vertical-align:-1px;margin-right:3px;"></i>${escapeHtml(client)}</span>`;
    }
    return '';
}

function getClientBadgeStatic(order) {
    const client = (order.client_name || '').trim();
    if (client) {
        return ` <span class="badge" style="background:var(--client-preset-bg);color:var(--client-preset-color);border:1px solid var(--client-preset-border);font-size:11px;padding:2px 8px;white-space:nowrap;" title="Client: ${escapeHtml(client)}"><i data-lucide="user" style="width:11px;height:11px;display:inline;vertical-align:-1px;margin-right:3px;"></i>${escapeHtml(client)}</span>`;
    }
    return '';
}

async function showInlineClientPicker(orderId) {
    const presets = (window.settingsData && window.settingsData.client_presets) || [];
    const order = [...(queueData.ready || []), ...(queueData.ekkremis || [])].find(o => o.order_id === orderId);
    const current = order ? (order.client_name || '') : '';
    const isCustom = current && !presets.includes(current);

    const choice = await new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:12px;padding:20px;min-width:300px;max-width:360px;box-shadow:var(--modal-shadow);';
        box.innerHTML = `<div style="font-weight:600;margin-bottom:12px;color:var(--text-primary);font-size:14px;">Assign Client - <span style="color:var(--client-preset-color);">${displayOrderId(orderId)}</span></div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:14px;" id="_ilp_wrap" data-custom-mode="${isCustom ? 'true' : 'false'}">
                <select id="_ilp_sel" class="form-input custom-select-source" style="${isCustom ? 'display:none' : ''}">
                    <option value="">- None -</option>
                    ${presets.map(p => `<option value="${escapeHtml(p)}" ${p === current ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                    <option value="__custom__">✎ Other...</option>
                </select>
                <input type="text" id="_ilp_inp" class="form-input" placeholder="Type client name..." style="font-size:13px;flex:1;${isCustom ? '' : 'display:none'}" value="${isCustom ? escapeHtml(current) : ''}">
                <button class="btn btn-sm btn-ghost" id="_ilp_back" style="padding:4px 8px;font-size:14px;line-height:1;${isCustom ? '' : 'display:none'}">✕</button>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="btn btn-sm btn-ghost" id="_ilp_cancel">Cancel</button>
                <button class="btn btn-sm btn-primary" id="_ilp_save">Save</button>
            </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Initialize custom select for the popup
        initCustomSelects();

        const sel = box.querySelector('#_ilp_sel');
        const inp = box.querySelector('#_ilp_inp');
        const back = box.querySelector('#_ilp_back');
        const wrap = box.querySelector('#_ilp_wrap');
        const csWrapper = _csInstances.get('_ilp_sel')?.wrapper;

        function getVal() {
            if (wrap.dataset.customMode === 'true') return inp.value.trim();
            return (sel.value === '__custom__' || sel.value === '') ? '' : sel.value;
        }
        function doSave() {
            csDestroy('_ilp_sel');
            document.body.removeChild(overlay);
            resolve(getVal());
        }
        function doCancel() {
            csDestroy('_ilp_sel');
            document.body.removeChild(overlay);
            resolve(null);
        }

        sel.addEventListener('change', () => {
            if (sel.value === '__custom__') {
                if (csWrapper) csWrapper.style.display = 'none';
                inp.style.display = ''; inp.value = '';
                back.style.display = '';
                wrap.dataset.customMode = 'true';
                _csClose('_ilp_sel');
                requestAnimationFrame(() => inp.focus());
            }
        });

        back.addEventListener('click', (e) => {
            e.stopPropagation();
            sel.value = '';
            if (csWrapper) csWrapper.style.display = '';
            csRefresh('_ilp_sel');
            inp.style.display = 'none'; inp.value = '';
            back.style.display = 'none';
            wrap.dataset.customMode = 'false';
        });

        // Enter on custom input → save
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });

        // Escape anywhere → cancel
        box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); doCancel(); } });

        overlay.addEventListener('click', (e) => { if (e.target === overlay) doCancel(); });
        box.querySelector('#_ilp_cancel').addEventListener('click', doCancel);
        box.querySelector('#_ilp_save').addEventListener('click', doSave);

        // Auto-focus
        if (isCustom) {
            requestAnimationFrame(() => { inp.focus(); inp.select(); });
        } else {
            const csTrigger = csWrapper?.querySelector('.custom-select-trigger');
            requestAnimationFrame(() => { if (csTrigger) csTrigger.focus(); else sel.focus(); });
        }
    });

    if (choice === null) return;
    await api('/queue/update-order', 'POST', {
        original_order_id: orderId,
        order_id: orderId,
        company_name: order?.company_name || '',
        he_number: order?.he_number || '',
        service_type: order?.service_type || 'certificate',
        client_name: choice
    });
    refreshQueue(true);
}

function getDecisionBadge(decision) {
    const badges = {
        undecided: '<span class="chip warn"><span class="dot"></span>Undecided</span>',
        accepted: '<span class="chip success"><span class="dot"></span>Accepted</span>',
        rejected: '<span class="chip danger"><span class="dot"></span>Rejected</span>',
        blocked: '<span class="chip"><span class="dot"></span>Blocked</span>',
        snoozed: '<span class="chip info"><span class="dot"></span>Snoozed</span>'
    };
    return badges[decision] || badges.undecided;
}

function getDecisionPendingBadge() {
    return '<span class="badge badge-purple" title="Order left ROC Ekkremis but is still undecided">Left ROC Ekkremis - waiting for your decision</span>';
}

function getStatusBadge(order) {
    const err = (order.last_error || '');
    const errLower = err.toLowerCase();

    if (err === 'NAME_REJECTED') {
        return `<span class="chip danger" title="Name has been rejected by ROC"><span class="dot"></span>Name Rejected</span>`;
    }
    if (errLower.includes('returned')) {
        return `<span class="chip danger" title="${escapeHtml(order.last_error || 'Returned for corrections')}"><span class="dot"></span>Returned</span>`;
    }
    if (errLower.includes('not found')) {
        return `<span class="chip warn" title="${escapeHtml(order.last_error || 'Not found in ROC yet')}"><span class="dot"></span>Not found in ROC</span>`;
    }
    if (errLower.includes('still pending') || errLower.includes('name still pending')) {
        return `<span class="chip warn" title="${escapeHtml(order.last_error || 'Name approval pending')}"><span class="dot"></span>Pending Approval</span>`;
    }

    if (order.status === 'failed') {
        return `<span class="chip warn" title="${escapeHtml(order.last_error || 'Needs attention')}"><span class="dot"></span>Needs attention</span>`;
    }

    const badges = {
        new: '<span class="chip info"><span class="dot"></span>New</span>',
        pending: '<span class="chip warn"><span class="dot"></span>Pending</span>',
        queued: '<span class="chip"><span class="dot"></span>Queued</span>',
        waiting: '<span class="chip info"><span class="dot"></span>Waiting for ROC</span>',
        processing: '<span class="chip info"><span class="dot"></span>Downloading</span>',
        completed: '<span class="chip success"><span class="dot"></span>Completed</span>',
        failed: '<span class="chip danger"><span class="dot"></span>Failed</span>',
        skipped: '<span class="chip warn"><span class="dot"></span>Skipped</span>'
    };
    return badges[order.status] || badges.new;
}

function formatTimestamp(ts) {
    if (!ts) return '-';
    try {
        const date = new Date(ts);
        return date.toLocaleString();
    } catch {
        return ts;
    }
}

// Date helpers (UI-only overrides for manual orders)
function _dateOverrideKey(orderId) {
    return `roc_order_date_override:${orderId}`;
}

function getOrderDateOverride(orderId) {
    try {
        return localStorage.getItem(_dateOverrideKey(orderId)) || '';
    } catch (_) {
        return '';
    }
}

function setOrderDateOverride(orderId, dateStr) {
    try {
        if (!orderId) return;
        if (!dateStr) {
            localStorage.removeItem(_dateOverrideKey(orderId));
            return;
        }
        localStorage.setItem(_dateOverrideKey(orderId), dateStr);
    } catch (_) {}
}

function getOrderDisplayDateHtml(order) {
    if (!order) return '-';
    const override = getOrderDateOverride(order.order_id);
    if (override) {
        // Parse the override (YYYY-MM-DD from date input) and format like other dates
        try {
            const parts = override.split('-');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                if (!isNaN(d.getTime())) {
                    return `<span title="Manual date">${d.toLocaleDateString()}</span>`;
                }
            }
        } catch (_) {}
        return `<span title="Manual date">${escapeHtml(override)}</span>`;
    }
    const ts = order.created_ts || order.decision_ts || order.updated_ts || '';
    if (!ts) return '-';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return escapeHtml(ts);
        const short = d.toLocaleDateString();
        const full = d.toLocaleString();
        return `<span title="${escapeHtml(full)}">${escapeHtml(short)}</span>`;
    } catch (_) {
        return escapeHtml(ts);
    }
}

const _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _ESC_RE = /[&<>"']/g;
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(_ESC_RE, c => _ESC_MAP[c]);
}

function displayOrderId(orderId) {
    if (!orderId) return '';
    return orderId.includes('_') ? orderId.split('_')[0] : orderId;
}

// ═══════════════════════════════════════════════════════════════════════
// ORDER ACTIONS
function actionsShowInfo(event, orderId) {
    try { if (event) event.stopPropagation(); } catch (e) {}
    if (typeof showOrderInfoModal === "function") {
        showOrderInfoModal(orderId);
    }
}

// ═══════════════════════════════════════════════════════════════════════

async function setDecision(orderId, decision) {
    // Multi name-approval orders: apply the decision to ALL sibling names at once
    // (they are nameless and interchangeable until ROC resolves them).
    const all = [...(queueData.ekkremis || []), ...(queueData.ready || [])];
    const self = all.find(o => o.order_id === orderId);
    if (self && (self.name_slot_total || 0) >= 2) {
        const base = (orderId || '').split('_')[0];
        const sibIds = all
            .filter(o => (o.name_slot_total || 0) >= 2 && (o.order_id || '').split('_')[0] === base)
            .map(o => o.order_id);
        if (sibIds.length > 1) {
            const result = await api('/queue/decision/bulk', 'POST', { order_ids: sibIds, decision });
            if (result && result.success !== false) {
                showToast(`Order ${displayOrderId(orderId)}: ${decision} (${sibIds.length} names)`, 'success');
                refreshQueue(true);
            } else {
                showToast('Failed to update order', 'error');
            }
            return;
        }
    }
    const result = await api('/queue/decision', 'POST', { order_id: orderId, decision });
    if (result?.success) {
        showToast(`Order ${displayOrderId(orderId)}: ${decision}`, 'success');
        refreshQueue(true);
    } else {
        showToast('Failed to update order', 'error');
    }
}

async function deleteOrder(orderId) {
    if (!confirm(`Delete order ${displayOrderId(orderId)}? This cannot be undone.`)) return;
    
    const result = await api(`/queue/${orderId}`, 'DELETE');
    if (result?.success) {
        showToast(`Order ${displayOrderId(orderId)} deleted`, 'success');
        refreshQueue(true);
    } else {
        showToast('Failed to delete order', 'error');
    }
}

async function bulkAcceptEkkremis() {
    const orderIds = queueData.ekkremis.map(o => o.order_id);
    if (orderIds.length === 0) return;
    
    const result = await api('/queue/decision/bulk', 'POST', {
        order_ids: orderIds,
        decision: 'accepted'
    });
    
    if (result) {
        showToast(`Accepted ${orderIds.length} orders`, 'success');
        refreshQueue(true);
    }
}

async function deleteCompletedOrder(orderId) {
    const result = await api(`/queue/${encodeURIComponent(orderId)}`, 'DELETE');
    if (result?.success) {
        showToast(`Removed order ${displayOrderId(orderId)}`, 'success');
        refreshQueue(true);
    }
}

async function clearCompleted() {
    if (!confirm('Clear all completed downloads?')) return;

    const result = await api('/queue/clear-completed', 'POST');
    if (result) {
        showToast(`Cleared ${result.cleared} orders`, 'success');
        refreshQueue(true);
    }
}

function setReadySearch(val) {
    readySearchTerm = (val || '').toString();
    renderReadyTable();
}

function clearReadySearch() {
    readySearchTerm = '';
    const el = document.getElementById('ready-search');
    if (el) el.value = '';
    renderReadyTable();
}

function setCompletedSearch(val) {
    completedSearchTerm = (val || '').toString();
    renderCompletedTable();
}

function clearCompletedSearch() {
    completedSearchTerm = '';
    const el = document.getElementById('completed-search');
    if (el) el.value = '';
    renderCompletedTable();
}


// ═══════════════════════════════════════════════════════════════════════
// BLOCKLIST MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

let blockedOrders = [];

async function refreshBlocklist() {
    const result = await api('/blocked-orders');
    if (result) {
        blockedOrders = result.blocked_orders || [];
        document.getElementById('blocked-count').textContent = blockedOrders.length;
        renderBlocklistItems();
    }
}

function renderBlocklistItems() {
    const container = document.getElementById('blocklist-items');
    if (blockedOrders.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">No blocked orders</span>';
        return;
    }
    container.innerHTML = blockedOrders.map(order => `
        <span style="background: var(--bg-hover); padding: 4px 8px; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            ${order}
            <button onclick="removeBlockedOrder('${order}')" style="background: none; border: none; color: var(--accent-danger); cursor: pointer; padding: 0; font-size: 14px;">×</button>
        </span>
    `).join('');
}

function toggleBlocklistView() {
    const container = document.getElementById('blocklist-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

async function addBlockedOrder() {
    const input = document.getElementById('block-order-input');
    const orderId = input.value.trim();
    
    if (!orderId) {
        showToast('Please enter an order number to block', 'error');
        return;
    }
    
    const result = await api('/blocked-orders/add', 'POST', { order_id: orderId });
    if (result?.success) {
        showToast(`Order ${displayOrderId(result.order_id)} blocked`, 'success');
        input.value = '';
        refreshBlocklist();
        refreshQueue(true);
    } else {
        showToast('Failed to block order', 'error');
    }
}

async function removeBlockedOrder(orderId) {
    const result = await api('/blocked-orders/remove', 'POST', { order_id: orderId });
    if (result?.success) {
        showToast(`Order ${displayOrderId(orderId)} unblocked`, 'success');
        refreshBlocklist();
        refreshQueue(true);
    } else {
        showToast('Failed to unblock order', 'error');
    }
}

// Block order directly from table (convenience)
async function blockOrder(orderId) {
    const baseId = orderId.includes('_') ? orderId.split('_')[0] : orderId;
    if (!confirm(`Block order ${baseId}? All companies in this order will be hidden.`)) return;
    await addBlockedOrderDirect(orderId);
}

async function addBlockedOrderDirect(orderId) {
    // Persist decision=blocked for history/clarity, AND add to the global blocklist.
    // Server normalises to the base order number so all sub-orders are caught.
    try { await api('/queue/decision', 'POST', { order_id: orderId, decision: 'blocked' }); } catch(e) {}
    const result = await api('/blocked-orders/add', 'POST', { order_id: orderId });
    if (result?.success) {
        showToast(`Order ${displayOrderId(result.order_id)} blocked`, 'success');
        refreshBlocklist();
        refreshQueue(true);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// CLEAR REJECTED ORDERS
// ═══════════════════════════════════════════════════════════════════════

async function clearRejectedOrders() {
    const rejected = queueData.ekkremis.filter(o => o.decision === 'rejected');
    if (rejected.length === 0) {
        showToast('No rejected orders to clear', 'info');
        return;
    }
    
    if (!confirm(`Clear ${rejected.length} rejected order(s)?`)) return;
    
    const result = await api('/queue/clear-rejected', 'POST');
    if (result) {
        showToast(`Cleared ${result.cleared} rejected orders`, 'success');
        refreshQueue(true);
    } else {
        showToast('Failed to clear rejected orders', 'error');
    }
}


// ═══════════════════════════════════════════════════════════════════════
// MANUAL ORDER ENTRY
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// ADD / EDIT ORDER DIALOGS (popup + drawer)  ·  open/close + live preview
// ═══════════════════════════════════════════════════════════════════════

let _editOriginalComment = '';

function openDlg(dlg) {
    if (!dlg) return;
    dlg.classList.add('open');
    dlg.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
}

function closeDlg(dlg) {
    if (!dlg) return;
    dlg.querySelectorAll('.custom-select').forEach(w => { if (w.dataset.for) _csClose(w.dataset.for); });
    dlg.classList.remove('open');
    dlg.setAttribute('aria-hidden', 'true');
    if (dlg.id === 'dlg-edit') {
        currentEditOriginalOrderId = null;
        _editOriginalComment = '';
        const ewrap = document.getElementById('edit-client-wrap');
        if (ewrap) ewrap.dataset.customMode = 'false';
    }
    // Only release the body scroll lock once nothing else is open
    if (!document.querySelector('.dlg.open') && !document.querySelector('.modal-overlay.active')) {
        document.body.style.overflow = '';
    }
}

// Close on scrim / Cancel / × (delegated)
document.addEventListener('click', (e) => {
    const closer = e.target.closest && e.target.closest('[data-dlg-close]');
    if (closer) { const dlg = closer.closest('.dlg'); if (dlg) closeDlg(dlg); }
});

// Esc closes the open dialog (after closing any open custom-select first)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const dlg = document.querySelector('.dlg.open');
    if (!dlg) return;
    const openSel = dlg.querySelector('.custom-select.open');
    if (openSel) { if (openSel.dataset.for) _csClose(openSel.dataset.for); return; }
    closeDlg(dlg);
});

function _dlgFieldOf(id) { const el = document.getElementById(id); return el && el.closest ? el.closest('.dlg-field') : null; }
function _dlgMarkInvalid(id) { const f = _dlgFieldOf(id); if (f) f.classList.add('invalid'); }
function _dlgClearInvalid(panelId) { document.querySelectorAll(`#${panelId} .dlg-field.invalid`).forEach(f => f.classList.remove('invalid')); }

// Reveal the Document-types group only for certificate orders that have presets
function syncDocTypesReveal(prefix) {
    const group = document.getElementById(prefix + '-doc-types-group');
    if (!group) return;
    const typeSel = document.getElementById(prefix + '-service-type');
    const type = typeSel ? typeSel.value : '';
    const chips = document.getElementById(prefix + '-doc-type-chips');
    const hasChips = !!(chips && chips.querySelector('.label-chip'));
    group.classList.toggle('show', type === 'certificate' && hasChips);
}

// Live preview strip (no avatar tile, per request)
function updateDlgPreview(prefix) {
    const panel = document.getElementById(prefix === 'manual' ? 'dlg-add' : 'dlg-edit');
    if (!panel) return;
    const val = (sfx) => { const el = document.getElementById(prefix + sfx); return el ? (el.value || '').trim() : ''; };
    const order = val('-order-id'), he = val('-he-number'), company = val('-company-name');
    const typeSel = document.getElementById(prefix + '-service-type');
    const type = typeSel ? typeSel.value : 'certificate';
    const setPrev = (key, fn) => { const el = panel.querySelector(`[data-prev="${key}"]`); if (el) fn(el); };

    setPrev('company', el => {
        if (company) { el.textContent = company; el.classList.remove('muted'); }
        else {
            el.textContent = (type === 'name_approval') ? 'Name approval'
                : (prefix === 'manual' ? 'New order' : 'Untitled order');
            el.classList.add('muted');
        }
    });
    setPrev('order', el => el.textContent = order ? '#' + order : '#-');
    setPrev('he', el => el.textContent = he ? 'HE ' + he : 'HE -');
    setPrev('type', el => el.innerHTML = getTypeBadge(type));
    setPrev('labels', el => {
        let html = '';
        document.querySelectorAll(`#${prefix}-labels-chips .label-chip.selected`).forEach(c => {
            const color = c.dataset.color || '#888';
            html += `<span class="prev-chip" style="background:${color}26;color:${color};">${escapeHtml(c.dataset.name)}</span>`;
        });
        el.innerHTML = html;
    });
}

// One-time wiring: live preview + invalid-clearing on both dialogs (delegated)
let _orderDialogsWired = false;
function initOrderDialogs() {
    if (_orderDialogsWired) return;
    [['dlg-add', 'manual'], ['dlg-edit', 'edit']].forEach(([panelId, prefix]) => {
        const body = document.querySelector(`#${panelId} .dlg-body`);
        if (!body) return;
        body.addEventListener('input', (e) => {
            const f = e.target.closest('.dlg-field'); if (f) f.classList.remove('invalid');
            updateDlgPreview(prefix);
        });
        body.addEventListener('change', (e) => {
            const f = e.target.closest('.dlg-field'); if (f) f.classList.remove('invalid');
            if (e.target.id === `${prefix}-service-type`) syncDocTypesReveal(prefix);
            updateDlgPreview(prefix);
        });
    });
    _orderDialogsWired = true;
}

function toggleManualAddForm() {
    const dlg = document.getElementById('dlg-add');
    if (!dlg) return;
    if (dlg.classList.contains('open')) { closeDlg(dlg); return; }

    initOrderDialogs();
    populateAccountDropdown();
    document.getElementById('manual-order-id').value = '';
    document.getElementById('manual-he-number').value = '';
    document.getElementById('manual-company-name').value = '';
    document.getElementById('manual-service-type').value = 'certificate';
    csRefresh('manual-service-type');
    const md = document.getElementById('manual-date'); if (md) md.value = '';
    const med = document.getElementById('manual-expected-documents'); if (med) med.value = '';
    const mc = document.getElementById('manual-comment'); if (mc) mc.value = '';
    const mj = document.getElementById('manual-labels-json'); if (mj) mj.value = '[]';
    populateManualLabelChips();
    // Reset client field completely (clear custom mode lock)
    const mwrap = document.getElementById('manual-client-wrap');
    if (mwrap) mwrap.dataset.customMode = 'false';
    populateClientDropdown('manual-client-select', '');
    _dlgClearInvalid('dlg-add');
    syncDocTypesReveal('manual');
    updateDlgPreview('manual');
    openDlg(dlg);
}

function populateAccountDropdown() {
    const select = document.getElementById('manual-roc-account');
    select.innerHTML = '<option value="">Select account…</option>';

    if (window.settingsData?.accounts) {
        window.settingsData.accounts.forEach(acc => {
            if (acc.enabled) {
                select.innerHTML += `<option value="${acc.code}">${acc.code}</option>`;
            }
        });
    }
    csRefresh('manual-roc-account');
}

function populateManualLabelChips() {
    const container = document.getElementById('manual-labels-chips');
    if (!container) return;
    const labelPresets = (window.settingsData && window.settingsData.label_presets) || [];
    const emptySelected = new Set();

    if (labelPresets.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No label presets - create them in Settings</span>';
    } else {
        container.innerHTML = renderChipButtons(labelPresets, emptySelected, 'toggleManualLabelChip');
    }

    const docTypePresets = (window.settingsData && window.settingsData.doc_type_presets) || [];
    const dtContainer = document.getElementById('manual-doc-type-chips');
    if (dtContainer) {
        if (docTypePresets.length > 0) {
            const dtPresetObjs = docTypePresets.map(name => ({ name, color: DOC_TYPE_COLOR }));
            dtContainer.innerHTML = renderChipButtons(dtPresetObjs, emptySelected, 'toggleManualLabelChip');
        } else {
            dtContainer.innerHTML = '';
        }
    }
    // Visibility of the doc-types group is gated by service type (certificate only)
    syncDocTypesReveal('manual');
    updateManualLabelsJson();
}

function toggleManualLabelChip(btn) {
    const isSelected = btn.classList.toggle('selected');
    const c = btn.dataset.color || '#6B7280';
    btn.style.borderColor = isSelected ? c : 'var(--border-light)';
    btn.style.background = isSelected ? c + '33' : 'transparent';
    btn.style.color = isSelected ? c : 'var(--text-muted)';
    updateManualLabelsJson();
    updateDlgPreview('manual');
}

function updateManualLabelsJson() {
    const labels = [];
    document.querySelectorAll('#manual-labels-chips .label-chip.selected').forEach(chip => {
        labels.push({ name: chip.dataset.name, color: chip.dataset.color });
    });
    const el = document.getElementById('manual-labels-json');
    if (el) el.value = JSON.stringify(labels);
}

async function submitManualOrder() {
    const orderId = document.getElementById('manual-order-id').value.trim();
    const heNumber = document.getElementById('manual-he-number').value.trim();
    const companyName = document.getElementById('manual-company-name').value.trim();
    const serviceType = document.getElementById('manual-service-type').value;
    const rocAccount = document.getElementById('manual-roc-account').value;

    const expectedDocsRaw = (document.getElementById('manual-expected-documents') || {}).value || '';
    const manualDate = (document.getElementById('manual-date') || {}).value || '';
    const comment = (document.getElementById('manual-comment') || {}).value?.trim?.() || '';

    let labels = [];
    try {
        labels = JSON.parse((document.getElementById('manual-labels-json') || {}).value || '[]') || [];
    } catch (_) { labels = []; }

    const manualDocTypes = [];
    document.querySelectorAll('#manual-doc-type-chips .label-chip.selected').forEach(chip => {
        manualDocTypes.push(chip.dataset.name);
    });

    // Validate required fields — flag all that are missing, focus the first
    _dlgClearInvalid('dlg-add');
    let bad = false, focusEl = null;
    const fail = (id, el) => { _dlgMarkInvalid(id); bad = true; if (!focusEl) focusEl = el; };
    if (!orderId) fail('manual-order-id', document.getElementById('manual-order-id'));
    if (!rocAccount) fail('manual-roc-account', _csInstances.get('manual-roc-account')?.trigger);
    if (serviceType === 'new_company' && !companyName) fail('manual-company-name', document.getElementById('manual-company-name'));
    if (bad) {
        try { focusEl && focusEl.focus(); } catch (_) {}
        const msg = !orderId ? 'Order number is required'
            : !rocAccount ? 'ROC account is required'
            : 'A company name is required for a new company';
        showToast(msg, 'error');
        return;
    }

    const companyToSave = companyName || 'Manual Entry';

    const result = await api('/queue/add-manual', 'POST', {
        order_id: orderId,
        he_number: heNumber,
        company_name: companyToSave,
        service_type: serviceType,
        roc_account: rocAccount,
        client_name: getSelectedClient('manual')
    });

    if (result?.success) {
        // add-manual assigns the real key (e.g. "123_C1" / "123_456"); the follow-up
        // edits MUST target it, not the bare order number, or they hit the wrong row.
        const realId = result.order_id || orderId;
        // Apply labels / expected documents (UI-only edit endpoint)
        const exp = expectedDocsRaw !== '' ? parseInt(expectedDocsRaw) : 0;
        if ((labels && labels.length) || (exp && exp > 0) || manualDocTypes.length) {
            await api('/queue/update-order', 'POST', {
                original_order_id: realId,
                order_id: realId,
                company_name: companyToSave,
                he_number: serviceType === 'new_company' ? '' : heNumber,
                service_type: serviceType,
                labels: labels,
                doc_types: manualDocTypes,
                expected_documents: exp
            });
        }

        // Apply comment
        if (comment) {
            await api('/queue/comment', 'POST', { order_id: realId, comment });
        }

        // Store manual date (UI-only override used for display)
        if (manualDate) {
            setOrderDateOverride(realId, manualDate);
        }

        showToast(`Order ${displayOrderId(realId)} added to queue`, 'success');
        toggleManualAddForm();
        refreshQueue(true);
    } else {
        showToast(result?.detail || 'Failed to add order', 'error');
    }
}


// ═══════════════════════════════════════════════════════════════════════
// ORDER INFO MODAL (unified comments + notes)
// ═══════════════════════════════════════════════════════════════════════

let currentInfoOrderId = null;
let _notesOriginalComment = '';

// Map a processing-note message to a timeline kind (reuses the app's existing keyword rules)
function _noteKind(msg) {
    msg = msg || '';
    if (msg.includes('✅') || msg.includes('COMPLETED') || msg.includes('Succeeded') || msg.includes('approved')) return 'success';
    if (msg.includes('⚠️') || msg.includes('failed') || msg.includes('crashed') || msg.includes('rejected') || msg.includes('skipped')) return 'error';
    if (msg.includes('⏳') || msg.includes('waiting') || msg.includes('Partial') || msg.includes('pending') || msg.includes('Still processing')) return 'warning';
    if (msg.includes('Processing started') || msg.includes('Found in workspace')) return 'purple';
    return 'info';
}
const _NOTE_KIND_LABEL = { success: 'Done', error: 'Failed', warning: 'Waiting', purple: 'Started', info: 'Info' };

function _autoGrowNotes(ta) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.max(58, ta.scrollHeight) + 'px'; }

// Fill a dialog's preview strip (no avatar tile) from an order object
function _fillNotesPreview(panel, order) {
    const setPrev = (key, fn) => { const el = panel.querySelector(`[data-prev="${key}"]`); if (el) fn(el); };
    const company = (order.company_name || '').trim();
    const he = (order.he_number || '').trim();
    const type = order.service_type || 'certificate';
    setPrev('company', el => {
        if (company && company !== 'Manual Entry') { el.textContent = company; el.classList.remove('muted'); }
        else { el.textContent = (type === 'name_approval') ? 'Name approval' : '-'; el.classList.add('muted'); }
    });
    setPrev('order', el => el.textContent = '#' + displayOrderId(order.order_id || ''));
    setPrev('he', el => el.textContent = he ? 'HE ' + he : 'HE -');
    setPrev('type', el => el.innerHTML = getTypeBadge(type));
}

function _renderNotesTimeline(notes) {
    const wrap = document.getElementById('notes-timeline');
    const countEl = document.getElementById('notes-count');
    notes = notes || [];
    if (countEl) countEl.textContent = notes.length + (notes.length === 1 ? ' entry' : ' entries');
    if (!wrap) return;
    if (!notes.length) {
        wrap.innerHTML = `<div class="tl-empty"><i data-lucide="inbox" class="icon"></i><span>No processing history yet.<br>Entries appear as the Downloader works this order.</span></div>`;
        refreshIcons();
        return;
    }
    wrap.innerHTML = `<div class="tl">` + notes.slice().reverse().map(n => {
        const kind = _noteKind(n.msg);
        const when = [n.date, n.time].filter(Boolean).map(escapeHtml).join(' · ');
        const tag = _NOTE_KIND_LABEL[kind] || '';
        return `<div class="tl-entry tl--${kind}">
            <div class="tl-marker"><span class="tl-dot"></span></div>
            <div class="tl-content">
                <div class="tl-time">${when}${tag ? ` <span style="opacity:.5;">·</span> <span class="tl-tag">${tag}</span>` : ''}</div>
                <div class="tl-msg">${escapeHtml(n.msg || '')}</div>
            </div>
        </div>`;
    }).join('') + `</div>`;
    refreshIcons();
}

// One-time composer wiring: dirty state + Cmd/Ctrl+Enter to save
let _notesComposerWired = false;
function _initNotesComposer() {
    if (_notesComposerWired) return;
    const ta = document.getElementById('notes-comment');
    const comp = document.getElementById('notes-composer');
    const btn = document.getElementById('notes-save-btn');
    if (!ta || !comp || !btn) return;
    ta.addEventListener('input', () => {
        _autoGrowNotes(ta);
        const changed = ta.value.trim() !== (_notesOriginalComment || '');
        comp.classList.toggle('is-dirty', changed);
        if (changed) comp.classList.remove('is-saved');
        btn.disabled = !changed;
    });
    ta.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !btn.disabled) { e.preventDefault(); saveOrderComment(); }
    });
    _notesComposerWired = true;
}

async function showOrderInfoModal(orderId) {
    const dlg = document.getElementById('dlg-notes');
    if (!dlg) return;
    currentInfoOrderId = orderId;

    const chip = document.getElementById('notes-ordchip');
    if (chip) chip.textContent = '#' + displayOrderId(orderId);

    // Preview strip from the order (searches Accepted, Completed and Pending)
    const allOrders = [...(queueData.ready || []), ...(queueData.completed || []), ...(queueData.ekkremis || [])];
    const order = allOrders.find(o => o.order_id === orderId) || { order_id: orderId };
    _fillNotesPreview(dlg, order);

    // Composer: load the saved comment, reset dirty/saved state
    const ta = document.getElementById('notes-comment');
    const comp = document.getElementById('notes-composer');
    const btn = document.getElementById('notes-save-btn');
    _notesOriginalComment = order.user_comment || '';
    if (ta) ta.value = _notesOriginalComment;
    if (comp) comp.classList.remove('is-dirty', 'is-saved');
    if (btn) btn.disabled = true;
    _initNotesComposer();

    // Timeline: loading placeholder, then fetch + render
    const wrap = document.getElementById('notes-timeline');
    if (wrap) wrap.innerHTML = `<div class="tl-empty"><i data-lucide="loader" class="icon"></i><span>Loading history...</span></div>`;
    openDlg(dlg);
    if (ta) setTimeout(() => _autoGrowNotes(ta), 0);

    const result = await api(`/queue/notes/${orderId}`);
    if (currentInfoOrderId !== orderId) return; // user switched/closed while loading
    _renderNotesTimeline(result && result.notes ? result.notes : []);
}

function hideOrderInfoModal() {
    closeDlg(document.getElementById('dlg-notes'));
    currentInfoOrderId = null;
}


// ═══════════════════════════════════════════════════════════════════════
// EDIT ACCEPTED ORDER MODAL
// ═══════════════════════════════════════════════════════════════════════

let currentEditOriginalOrderId = null;

function renderChipButtons(presets, selectedNames, onclickFn) {
    return presets.map(p => {
        const isSelected = selectedNames.has(p.name);
        const c = p.color || '#6B7280';
        return `<button type="button" class="label-chip ${isSelected ? 'selected' : ''}"
            data-name="${escapeHtml(p.name)}" data-color="${c}"
            onclick="${onclickFn}(this)"
            style="padding:4px 12px;border-radius:20px;font-size:12px;cursor:pointer;border:2px solid ${isSelected ? c : 'var(--border-light)'};background:${isSelected ? c + '33' : 'transparent'};color:${isSelected ? c : 'var(--text-muted)'};transition:all .15s;">
            ${escapeHtml(p.name)}
        </button>`;
    }).join('');
}

function showEditOrderModal(orderId) {
    initOrderDialogs();
    currentEditOriginalOrderId = orderId;
    document.getElementById('edit-original-order-id').textContent = '#' + displayOrderId(orderId);

    // Find in Accepted or Pending (Ekkremis)
    const order = [...(queueData.ready || []), ...(queueData.ekkremis || [])].find(o => o.order_id === orderId);
    if (!order) {
        showToast('Order not found', 'error');
        return;
    }

    // Show only the BASE order number - composite suffixes (_C1/_N1/_he) are
    // internal identity; the server re-attaches the suffix on save.
    document.getElementById('edit-order-id').value = displayOrderId(order.order_id || '');
    document.getElementById('edit-company-name').value = order.company_name || '';
    document.getElementById('edit-he-number').value = order.he_number || '';
    document.getElementById('edit-service-type').value = order.service_type || 'certificate';
    csRefresh('edit-service-type');
    document.getElementById('edit-expected-documents').value = order.expected_documents || '';

    // Comment lives inline in the drawer now (was the separate Order Info modal)
    _editOriginalComment = order.user_comment || '';
    const ecomment = document.getElementById('edit-comment'); if (ecomment) ecomment.value = _editOriginalComment;

    // Populate label chips from presets
    const labelPresets = (window.settingsData && window.settingsData.label_presets) || [];
    const orderLabels = order.labels || [];
    const selectedLabelNames = new Set(orderLabels.map(l => l.name));

    const chipsContainer = document.getElementById('edit-labels-chips');
    if (labelPresets.length === 0) {
        chipsContainer.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No label presets - create them in Settings</span>';
    } else {
        chipsContainer.innerHTML = renderChipButtons(labelPresets, selectedLabelNames, 'toggleLabelChip');
    }

    // Populate doc type chips from separate presets
    const docTypePresets = (window.settingsData && window.settingsData.doc_type_presets) || [];
    const orderDocTypes = new Set(order.doc_types || []);
    const dtContainer = document.getElementById('edit-doc-type-chips');
    if (docTypePresets.length > 0) {
        const dtPresetObjs = docTypePresets.map(name => ({ name, color: DOC_TYPE_COLOR }));
        dtContainer.innerHTML = renderChipButtons(dtPresetObjs, orderDocTypes, 'toggleDocTypeChip');
    } else {
        dtContainer.innerHTML = '';
    }
    updateLabelsJson();

    // Populate client dropdown (clear lock first so populate works)
    const ewrap = document.getElementById('edit-client-wrap');
    if (ewrap) ewrap.dataset.customMode = 'false';
    populateClientDropdown('edit-client-select', order.client_name || '');

    _dlgClearInvalid('dlg-edit');
    syncDocTypesReveal('edit');
    updateDlgPreview('edit');
    openDlg(document.getElementById('dlg-edit'));
}

function hideEditOrderModal() {
    closeDlg(document.getElementById('dlg-edit'));
}

async function saveEditedOrder() {
    if (!currentEditOriginalOrderId) return;

    const newOrderId = document.getElementById('edit-order-id').value.trim();
    const companyName = document.getElementById('edit-company-name').value.trim();
    const heNumber = document.getElementById('edit-he-number').value.trim();
    const serviceType = document.getElementById('edit-service-type').value;
    const expectedDocs = document.getElementById('edit-expected-documents').value;
    
    // Build labels array from selected label chips only
    const labels = [];
    document.querySelectorAll('#edit-labels-chips .label-chip.selected').forEach(chip => {
        labels.push({ name: chip.dataset.name, color: chip.dataset.color });
    });

    // Build doc_types array from selected doc type chips
    const docTypes = [];
    document.querySelectorAll('#edit-doc-type-chips .label-chip.selected').forEach(chip => {
        docTypes.push(chip.dataset.name);
    });

    if (!newOrderId) {
        _dlgClearInvalid('dlg-edit');
        _dlgMarkInvalid('edit-order-id');
        const el = document.getElementById('edit-order-id'); if (el) try { el.focus(); } catch (_) {}
        showToast('Order number is required', 'error');
        return;
    }

    const result = await api('/queue/update-order', 'POST', {
        original_order_id: currentEditOriginalOrderId,
        order_id: newOrderId,
        company_name: companyName,
        he_number: heNumber,
        service_type: serviceType,
        labels: labels,
        doc_types: docTypes,
        expected_documents: expectedDocs ? parseInt(expectedDocs) : 0,
        client_name: getSelectedClient('edit')
    });

    if (result?.success) {
        // Save the comment too (update-order may rename the key — use the final id)
        const finalId = result.order_id || newOrderId;
        const comment = (document.getElementById('edit-comment')?.value || '').trim();
        if (comment !== (_editOriginalComment || '')) {
            await api('/queue/comment', 'POST', { order_id: finalId, comment });
        }
        showToast('Order updated', 'success');
        hideEditOrderModal();
        refreshQueue(true);
    } else {
        showToast(result?.detail || 'Failed to update order', 'error');
    }
}

function toggleLabelChip(btn) {
    const isSelected = btn.classList.toggle('selected');
    const c = btn.dataset.color || '#6B7280';
    btn.style.borderColor = isSelected ? c : 'var(--border-light)';
    btn.style.background = isSelected ? c + '33' : 'transparent';
    btn.style.color = isSelected ? c : 'var(--text-muted)';
    updateLabelsJson();
    updateDlgPreview('edit');
}

function toggleDocTypeChip(btn) {
    const isSelected = btn.classList.toggle('selected');
    const c = btn.dataset.color || DOC_TYPE_COLOR;
    btn.style.borderColor = isSelected ? c : 'var(--border-light)';
    btn.style.background = isSelected ? c + '33' : 'transparent';
    btn.style.color = isSelected ? c : 'var(--text-muted)';
}

function updateLabelsJson() {
    const labels = [];
    document.querySelectorAll('#edit-labels-chips .label-chip.selected').forEach(chip => {
        labels.push({ name: chip.dataset.name, color: chip.dataset.color });
    });
    document.getElementById('edit-labels-json').value = JSON.stringify(labels);
}

// ═══════════════════════════════════════════════════════════════════════
// LABEL PRESET MANAGEMENT (Settings page)
// ═══════════════════════════════════════════════════════════════════════

let newPresetColor = '#c4856a';

function pickNewPresetColor(color) {
    newPresetColor = color;
    document.getElementById('new-preset-color').value = color;
    document.querySelectorAll('#new-preset-colors .preset-color-btn').forEach(btn => {
        btn.style.borderColor = btn.dataset.color === color ? '#E2E8F0' : 'transparent';
    });
}

async function addLabelPreset() {
    const name = document.getElementById('new-preset-name').value.trim();
    if (!name) { showToast('Please enter a label name', 'error'); return; }
    const color = document.getElementById('new-preset-color').value || '#c4856a';
    const result = await api('/settings/label-presets', 'POST', { name, color });
    if (result?.success) {
        showToast(`Label "${name}" created`, 'success');
        document.getElementById('new-preset-name').value = '';
        refreshSettings();
    } else {
        showToast(result?.detail || 'Failed to add label', 'error');
    }
}

async function deleteLabelPreset(name) {
    if (!confirm(`Delete label "${name}"? It will not be removed from existing orders.`)) return;
    const result = await api(`/settings/label-presets/${encodeURIComponent(name)}`, 'DELETE');
    if (result?.success) {
        showToast(`Label "${name}" deleted`, 'success');
        refreshSettings();
    }
}

function renderLabelPresets(presets) {
    const container = document.getElementById('label-presets-list');
    if (!presets || presets.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No label presets yet. Create one below.</span>';
        return;
    }
    container.className = 'preset-drag-list';
    container.innerHTML = presets.map(p => {
        const c = p.color || '#6B7280';
        const eName = escapeHtml(p.name);
        return `<div class="preset-drag-item" draggable="true" data-name="${eName}" data-color="${c}">
            <div class="preset-drag-handle"><i data-lucide="grip-vertical" class="icon"></i></div>
            <div class="preset-drag-content">
                <span style="width:12px;height:12px;border-radius:50%;background:${c};flex-shrink:0;"></span>
                <span>${eName}</span>
            </div>
            <div class="preset-drag-actions">
                <button class="btn btn-sm btn-ghost btn-icon" onclick="editLabelPreset('${eName}','${c}')" title="Edit"><i data-lucide="pencil" class="icon"></i></button>
                <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteLabelPreset('${eName}')" title="Delete"><i data-lucide="x" class="icon"></i></button>
            </div>
        </div>`;
    }).join('');
    setupDragReorder(container, () => {
        const order = Array.from(container.querySelectorAll('.preset-drag-item')).map(el => ({
            name: el.dataset.name, color: el.dataset.color
        }));
        api('/settings/label-presets/reorder', 'POST', { presets: order });
    });
    refreshIcons();
}

async function editLabelPreset(oldName, oldColor) {
    const newName = prompt('Rename label:', oldName);
    if (newName === null) return;
    const name = newName.trim();
    if (!name) { showToast('Label name cannot be empty', 'error'); return; }
    const result = await api('/settings/label-presets/update', 'POST', {
        old_name: oldName, name, color: oldColor
    });
    if (result?.success) {
        showToast(`Label updated: ${oldName} → ${name}`, 'success');
        refreshSettings();
    } else {
        showToast(result?.detail || 'Failed to update label', 'error');
    }
}

// ── Client Presets ──

async function addClientPreset() {
    const name = document.getElementById('new-client-name').value.trim();
    if (!name) { showToast('Please enter a client name', 'error'); return; }
    const result = await api('/settings/client-presets', 'POST', { name });
    if (result?.success) {
        showToast(`Client "${name}" added`, 'success');
        document.getElementById('new-client-name').value = '';
        refreshSettings();
    } else {
        showToast(result?.detail || 'Failed to add client', 'error');
    }
}

async function deleteClientPreset(name) {
    if (!confirm(`Delete client "${name}"? It will not be removed from existing orders.`)) return;
    const result = await api(`/settings/client-presets/${encodeURIComponent(name)}`, 'DELETE');
    if (result?.success) {
        showToast(`Client "${name}" deleted`, 'success');
        refreshSettings();
    }
}

function renderClientPresets(presets) {
    const container = document.getElementById('client-presets-list');
    if (!presets || presets.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No clients yet. Add one below.</span>';
        return;
    }
    container.className = 'preset-drag-list';
    container.innerHTML = presets.map(name => {
        const eName = escapeHtml(name);
        return `<div class="preset-drag-item" draggable="true" data-name="${eName}">
            <div class="preset-drag-handle"><i data-lucide="grip-vertical" class="icon"></i></div>
            <div class="preset-drag-content"><span>${eName}</span></div>
            <div class="preset-drag-actions">
                <button class="btn btn-sm btn-ghost btn-icon" onclick="editClientPreset('${eName}')" title="Edit"><i data-lucide="pencil" class="icon"></i></button>
                <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteClientPreset('${eName}')" title="Delete"><i data-lucide="x" class="icon"></i></button>
            </div>
        </div>`;
    }).join('');
    setupDragReorder(container, () => {
        const order = Array.from(container.querySelectorAll('.preset-drag-item')).map(el => el.dataset.name);
        api('/settings/client-presets/reorder', 'POST', { presets: order });
    });
    refreshIcons();
}

async function editClientPreset(oldName) {
    const newName = prompt('Rename client:', oldName);
    if (newName === null) return;
    const name = newName.trim();
    if (!name) { showToast('Client name cannot be empty', 'error'); return; }
    const result = await api('/settings/client-presets/update', 'POST', {
        old_name: oldName, name
    });
    if (result?.success) {
        showToast(`Client updated: ${oldName} → ${name}`, 'success');
        refreshSettings();
    } else {
        showToast(result?.detail || 'Failed to update client', 'error');
    }
}

function populateClientDropdown(selectId, currentValue) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const prefix = selectId.replace('-client-select', '');
    const wrap = document.getElementById(prefix + '-client-wrap');
    const customInput = document.getElementById(prefix + '-client-custom');
    const backBtn = document.getElementById(prefix + '-client-back');

    // ── LOCK: If user is actively typing a custom name, don't touch anything ──
    if (wrap && wrap.dataset.customMode === 'true') return;

    const presets = (window.settingsData && window.settingsData.client_presets) || [];

    // Rebuild options (preserves list even if presets changed)
    sel.innerHTML = '<option value="">- None -</option>'
        + presets.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')
        + '<option value="__custom__">✎ Other...</option>';

    const csWrapper = _csInstances.get(selectId)?.wrapper;

    if (currentValue && presets.includes(currentValue)) {
        // Known preset - show dropdown with value selected
        sel.value = currentValue;
        if (csWrapper) csWrapper.style.display = '';
        if (customInput) customInput.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (wrap) wrap.dataset.customMode = 'false';
    } else if (currentValue) {
        // Custom value - switch to input mode
        if (csWrapper) csWrapper.style.display = 'none';
        if (customInput) { customInput.style.display = ''; customInput.value = currentValue; }
        if (backBtn) backBtn.style.display = '';
        if (wrap) wrap.dataset.customMode = 'true';
    } else {
        // Empty - show dropdown at "None"
        sel.value = '';
        if (csWrapper) csWrapper.style.display = '';
        if (customInput) { customInput.style.display = 'none'; customInput.value = ''; }
        if (backBtn) backBtn.style.display = 'none';
        if (wrap) wrap.dataset.customMode = 'false';
    }
    csRefresh(selectId);
}

function onClientSelectChange(prefix) {
    const sel = document.getElementById(prefix + '-client-select');
    const customInput = document.getElementById(prefix + '-client-custom');
    const backBtn = document.getElementById(prefix + '-client-back');
    const wrap = document.getElementById(prefix + '-client-wrap');
    if (!sel || !customInput) return;
    if (sel.value === '__custom__') {
        // ── Switch to custom mode and LOCK it ──
        const csWrapper = _csInstances.get(prefix + '-client-select')?.wrapper;
        if (csWrapper) csWrapper.style.display = 'none';
        customInput.style.display = '';
        customInput.value = '';
        if (backBtn) backBtn.style.display = '';
        if (wrap) wrap.dataset.customMode = 'true';
        _csClose(prefix + '-client-select');
        requestAnimationFrame(() => customInput.focus());
    }
}

function onClientBackToList(prefix) {
    const sel = document.getElementById(prefix + '-client-select');
    const customInput = document.getElementById(prefix + '-client-custom');
    const backBtn = document.getElementById(prefix + '-client-back');
    const wrap = document.getElementById(prefix + '-client-wrap');
    const csWrapper = _csInstances.get(prefix + '-client-select')?.wrapper;
    // ── Unlock custom mode and switch back to dropdown ──
    if (sel) { sel.value = ''; }
    if (csWrapper) csWrapper.style.display = '';
    if (customInput) { customInput.style.display = 'none'; customInput.value = ''; }
    if (backBtn) backBtn.style.display = 'none';
    if (wrap) wrap.dataset.customMode = 'false';
    csRefresh(prefix + '-client-select');
}

function getSelectedClient(prefix) {
    const wrap = document.getElementById(prefix + '-client-wrap');
    const customInput = document.getElementById(prefix + '-client-custom');
    const sel = document.getElementById(prefix + '-client-select');
    // If in custom mode, always read from the text input
    if (wrap && wrap.dataset.customMode === 'true' && customInput) {
        return customInput.value.trim();
    }
    if (!sel) return '';
    return (sel.value === '__custom__' || sel.value === '') ? '' : sel.value;
}

async function saveOrderComment() {
    if (!currentInfoOrderId) return;

    const ta = document.getElementById('notes-comment');
    const comment = (ta ? ta.value : '').trim();

    const result = await api('/queue/comment', 'POST', {
        order_id: currentInfoOrderId,
        comment: comment
    });

    if (result?.success) {
        _notesOriginalComment = comment;
        const comp = document.getElementById('notes-composer');
        const btn = document.getElementById('notes-save-btn');
        if (comp) { comp.classList.remove('is-dirty'); comp.classList.add('is-saved'); }
        if (btn) btn.disabled = true;
        showToast('Comment saved', 'success');
        refreshQueue(true);
    } else {
        showToast('Failed to save comment', 'error');
    }
}

// Legacy function aliases for backward compatibility
function openCommentModal(orderId, existingComment) {
    showOrderInfoModal(orderId);
}
function showNotesModal(orderId) {
    showOrderInfoModal(orderId);
}
function hideCommentModal() {
    hideOrderInfoModal();
}
function hideNotesModal() {
    hideOrderInfoModal();
}

// ═══════════════════════════════════════════════════════════════════════
// DELETE ORDER FROM ACCEPTED
// ═══════════════════════════════════════════════════════════════════════

const _activeSpotChecks = new Set();

function _restoreSpotCheckState() {
    _activeSpotChecks.forEach(id => {
        const btn = document.getElementById(`spot-${id}`);
        if (btn) {
            btn.classList.add('spot-running');
            btn.disabled = true;
            btn.title = 'Checking...';
        }
    });
}

async function spotCheckOrder(orderId) {
    if (_activeSpotChecks.has(orderId)) return;

    _activeSpotChecks.add(orderId);
    _restoreSpotCheckState();
    showToast(`Spot-check started for ${displayOrderId(orderId)}`, 'info');

    const result = await api('/spot-check', 'POST', { order_id: orderId });
    if (!result || result.status === 'error') {
        showToast(result?.detail || 'Failed to start spot-check', 'error');
        _activeSpotChecks.delete(orderId);
        _restoreSpotCheckState();
        return;
    }
    if (result.status === 'already_running') {
        showToast(`Spot-check already running for ${displayOrderId(orderId)}`, 'warning');
        return;
    }

    _pollSpotCheck(orderId);
}

function _pollSpotCheck(orderId) {
    const poll = setInterval(async () => {
        const res = await api('/spot-check/active');
        if (!res || !res.active || !res.active.includes(orderId)) {
            clearInterval(poll);
            _activeSpotChecks.delete(orderId);
            const btn = document.getElementById(`spot-${orderId}`);
            if (btn) {
                btn.classList.remove('spot-running');
                btn.disabled = false;
                btn.title = 'Check now';
            }
            refreshQueue(true);
            showToast(`Spot-check finished for ${displayOrderId(orderId)}`, 'success');
        }
    }, 3000);
}


async function deleteOrderFromAccepted(orderId) {
    if (!confirm(`Remove order ${displayOrderId(orderId)} from the queue?\n\nThis is permanent - it won't be re-added even if ROC still lists it.`)) {
        return;
    }
    
    const result = await api(`/queue/order/${orderId}`, 'DELETE');
    if (result?.success) {
        showToast(`Order ${displayOrderId(orderId)} removed`, 'success');
        refreshQueue(true);
    } else {
        showToast(result?.detail || 'Failed to remove order', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════
// AGENT CONTROLS
// ═══════════════════════════════════════════════════════════════════════

async function startAgentB() {
    const result = await api('/agent-b/start', 'POST');
    if (result) {
        showToast('Finder started', 'success');
        setTimeout(refreshStatus, 1000);
    }
}

async function stopAgentB() {
    const result = await api('/agent-b/stop', 'POST');
    if (result) {
        showToast('Finder stopped', 'success');
        setTimeout(refreshStatus, 1000);
    }
}

async function runAgentANow() {
    const result = await api('/agent-a/run-now', 'POST');
    if (result) {
        showToast('Downloader started', 'success');
        setTimeout(refreshStatus, 1000);
    }
}

async function stopDownloader() {
    const result = await api('/downloader/stop', 'POST');
    if (result) {
        showToast('Downloader stopped', 'success');
        // Make UI update feel immediate
        downloaderUiState = 'stopped';
        downloaderNextMode = 'manual';
        downloaderNextRunMs = null;
        downloaderNextRunLabel = null;
        tickDownloaderCountdown();
        setTimeout(refreshStatus, 500);
    }
}

async function toggleAgentAScheduler() {
    const result = await api('/agent-a/toggle', 'POST');
    if (result) {
        showToast(`Auto-Run ${result.enabled ? 'enabled' : 'disabled'}`, 'success');
        refreshStatus();
    }
}

async function saveDownloaderInterval() {
    const intervalInput = document.getElementById('downloader-interval');
    const unitSelect = document.getElementById('downloader-interval-unit');
    
    let minutes = parseInt(intervalInput.value) || 120;
    if (unitSelect.value === 'hours') {
        minutes = minutes * 60;
    }
    
    // Enforce limits
    minutes = Math.max(1, Math.min(1440, minutes));
    
    const result = await api('/downloader/settings', 'POST', {
        interval_minutes: minutes,
        scheduler_enabled: document.getElementById('agent-a-auto').textContent === 'ON'
    });
    
    if (result) {
        showToast(`Interval saved: ${formatInterval(result.interval_minutes)}`, 'success');
        refreshStatus();
    }
}

function formatInterval(minutes) {
    if (minutes >= 60 && minutes % 60 === 0) {
        return `${minutes / 60}h`;
    }
    return `${minutes}min`;
}

async function startAll() {
    showToast('Starting automation...', 'info');
    const result = await api('/agents/start-all', 'POST');
    if (result) {
        showToast(`Automation started - Finder ${result.finder_started ? 'active' : '(already running)'}, Downloader ${result.downloader_started ? 'active' : '(already running)'}`, 'success');
        setTimeout(refreshStatus, 1000);
    }
}

async function stopAll() {
    showToast('Stopping automation...', 'info');
    const result = await api('/agents/stop-all', 'POST');
    if (result) {
        showToast('Automation stopped', 'success');
        setTimeout(refreshStatus, 1000);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════

let _editingAccountCode = null;  // Track which account we're editing

function togglePasswordVisibility() {
    const input = document.getElementById('account-password');
    const btn = document.querySelector('.password-toggle');
    if (!input || !btn) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('[data-lucide]');
    if (icon) { icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye'); lucide.createIcons({ nodes: [btn] }); }
    btn.title = isPassword ? 'Hide password' : 'Show password';
}

function _resetPasswordToggle() {
    const input = document.getElementById('account-password');
    if (input) input.type = 'password';
    const btn = document.querySelector('.password-toggle');
    if (!btn) return;
    const icon = btn.querySelector('[data-lucide]');
    if (icon) { icon.setAttribute('data-lucide', 'eye'); lucide.createIcons({ nodes: [btn] }); }
    btn.title = 'Show password';
}

function showAddAccountModal() {
    _editingAccountCode = null;
    document.getElementById('account-modal-title').textContent = 'Add Account';
    document.getElementById('account-username').value = '';
    document.getElementById('account-username').disabled = false;
    document.getElementById('account-password').value = '';
    _resetPasswordToggle();
    document.getElementById('account-modal').classList.add('active');
}

function editAccount(code) {
    _editingAccountCode = code;
    document.getElementById('account-modal-title').textContent = 'Edit Account';
    document.getElementById('account-username').value = code;
    document.getElementById('account-username').disabled = true;
    document.getElementById('account-password').value = '';
    _resetPasswordToggle();
    document.getElementById('account-modal').classList.add('active');
}

function hideAccountModal() {
    document.getElementById('account-modal').classList.remove('active');
    _editingAccountCode = null;
    _resetPasswordToggle();
}

async function saveAccount() {
    const username = document.getElementById('account-username').value.trim();
    const password = document.getElementById('account-password').value;
    
    if (!username || !password) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Use the username as the account code (they're the same for ROC)
    const code = _editingAccountCode || username;
    
    const result = await api('/settings/account', 'POST', {
        code, username, password, enabled: true
    });
    
    if (result?.success) {
        showToast('Account saved', 'success');
        hideAccountModal();
        refreshSettings();
    } else {
        showToast('Failed to save account', 'error');
    }
}

async function removeAccount(code) {
    if (!confirm(`Remove account "${code}"?`)) return;
    
    const result = await api(`/settings/account/${encodeURIComponent(code)}`, 'DELETE');
    if (result?.success) {
        showToast('Account removed', 'success');
        refreshSettings();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// SHUTDOWN MODAL + CLOSE INTERCEPTION
// ═══════════════════════════════════════════════════════════════════════

let _shutdownModalEl = null;
let _previouslyFocused = null;

function _createShutdownModal() {
    if (_shutdownModalEl) return _shutdownModalEl;
    const div = document.createElement('div');
    div.className = 'shutdown-overlay';
    div.id = 'shutdown-overlay';
    div.setAttribute('role', 'alertdialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-labelledby', 'shutdown-title');
    div.setAttribute('aria-describedby', 'shutdown-desc');
    div.innerHTML = `
        <div class="shutdown-modal">
            <div class="shutdown-modal-body" id="shutdown-confirm-body">
                <div class="shutdown-modal-icon"><i data-lucide="power" class="icon"></i></div>
                <div class="shutdown-modal-title" id="shutdown-title">Quit PandaRoc?</div>
                <div class="shutdown-modal-desc" id="shutdown-desc">Any downloads in progress will be stopped. The queue is saved and will resume next time you open the app.</div>
            </div>
            <div class="shutdown-modal-footer" id="shutdown-footer">
                <button class="btn btn-ghost" id="shutdown-cancel-btn" onclick="cancelShutdown()">Cancel</button>
                <button class="btn btn-danger" id="shutdown-quit-btn" onclick="confirmShutdown()"><i data-lucide="power" class="icon"></i>Quit</button>
            </div>
            <div class="shutdown-checklist" id="shutdown-checklist" style="display:none;">
                <div class="shutdown-step" data-step="downloader">
                    <div class="shutdown-step-icon">
                        <i data-lucide="circle" class="icon" style="width:16px;height:16px;"></i>
                    </div>
                    <span>Stopping downloader</span>
                </div>
                <div class="shutdown-step" data-step="scanner">
                    <div class="shutdown-step-icon">
                        <i data-lucide="circle" class="icon" style="width:16px;height:16px;"></i>
                    </div>
                    <span>Stopping scanner</span>
                </div>
                <div class="shutdown-step" data-step="queue">
                    <div class="shutdown-step-icon">
                        <i data-lucide="circle" class="icon" style="width:16px;height:16px;"></i>
                    </div>
                    <span>Saving queue state</span>
                </div>
                <div class="shutdown-step" data-step="server">
                    <div class="shutdown-step-icon">
                        <i data-lucide="circle" class="icon" style="width:16px;height:16px;"></i>
                    </div>
                    <span>Stopping server</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);
    _shutdownModalEl = div;
    refreshIcons();

    // Focus trap
    div.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { cancelShutdown(); return; }
        if (e.key !== 'Tab') return;
        const focusable = div.querySelectorAll('button:not([style*="display:none"]):not([disabled])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    });

    return div;
}

// ── Window controls ──
function winMinimize() {
    if (window.pywebview && window.pywebview.api) window.pywebview.api.minimize_window();
}
function winToggleMaximize() {
    if (!window.pywebview || !window.pywebview.api) return;
    Promise.resolve(window.pywebview.api.toggle_maximize()).then(maximized => {
        const ico = document.getElementById('win-max-icon');
        if (ico) ico.setAttribute('data-lucide', maximized ? 'copy' : 'square');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}
function winClose() {
    window.rocShowShutdownModal();
}

// ── Nav bar drag (native caption behavior - snap, move, dblclick-maximize) ──
// The lock-screen topbar gets the same treatment: the overlay covers the nav,
// so without it a logged-out window couldn't be moved at all.
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.top-nav, #lock-screen-topbar').forEach(function(bar) {
        bar.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            if (e.target.closest('button, a, input, select, [role="tab"], .window-controls')) return;
            if (window.pywebview && window.pywebview.api) window.pywebview.api.start_drag();
        });
        bar.addEventListener('dblclick', function(e) {
            if (e.target.closest('button, a, input, select, [role="tab"], .window-controls')) return;
            winToggleMaximize();
        });
    });
});

// ── Edge/corner resize handles (Windows custom chrome only; macOS resizes natively) ──
let _resizeInit = false;
function _initResizeHandles() {
    if (_resizeInit) return;
    const wrap = document.getElementById('resize-handles');
    if (!wrap) return;
    if (!(window.pywebview && window.pywebview.api && window.pywebview.api.start_resize)) return;
    _resizeInit = true;
    wrap.style.display = 'block';
    wrap.querySelectorAll('.rsz').forEach(function(h) {
        h.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            window.pywebview.api.start_resize(h.dataset.dir);
        });
    });
}
window.addEventListener('pywebviewready', _initResizeHandles);
document.addEventListener('DOMContentLoaded', function() {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.start_resize) _initResizeHandles();
});

// Called by pywebview's closing event via evaluate_js, or by closeApp() in browser mode
window.rocShowShutdownModal = function() {
    _previouslyFocused = document.activeElement;
    const modal = _createShutdownModal();
    // Reset to confirm state
    document.getElementById('shutdown-confirm-body').style.display = '';
    document.getElementById('shutdown-footer').style.display = '';
    document.getElementById('shutdown-checklist').style.display = 'none';
    // Reset checklist steps
    modal.querySelectorAll('.shutdown-step').forEach(s => {
        s.className = 'shutdown-step';
        s.querySelector('.shutdown-step-icon').innerHTML = '<i data-lucide="circle" class="icon" style="width:16px;height:16px;"></i>';
    });
    refreshIcons();
    modal.classList.add('active');
    document.querySelector('main')?.setAttribute('inert', '');
    // Focus Cancel (safer option per Apple HIG)
    document.getElementById('shutdown-cancel-btn')?.focus();
};

function cancelShutdown() {
    const modal = document.getElementById('shutdown-overlay');
    if (modal) modal.classList.remove('active');
    document.querySelector('main')?.removeAttribute('inert');
    if (_previouslyFocused) { _previouslyFocused.focus(); _previouslyFocused = null; }
    // Tell pywebview bridge we cancelled
    if (window.pywebview?.api?.cancel_shutdown) {
        window.pywebview.api.cancel_shutdown();
    }
}

function _shutdownFetch(url, ms) {
    // POST with a manual timeout. AbortSignal.timeout does NOT exist on older
    // WKWebView (macOS Safari < 16) and would throw/skip or, worse, leave a
    // fetch unbounded - the shutdown flow must never depend on it.
    return new Promise((resolve, reject) => {
        let ctrl = null;
        try { ctrl = new AbortController(); } catch (e) {}
        const timer = setTimeout(() => {
            try { ctrl?.abort(); } catch (e) {}
            reject(new Error('timeout'));
        }, ms);
        fetch(url, { method: 'POST', signal: ctrl?.signal })
            .then(r => { clearTimeout(timer); resolve(r); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}

async function confirmShutdown() {
    // Tell pywebview bridge we confirmed
    if (window.pywebview?.api?.request_shutdown) {
        try { window.pywebview.api.request_shutdown(); } catch (e) {}
    }

    // Nothing inside this block may strand the overlay: every step is
    // time-boxed and finish_shutdown below ALWAYS runs.
    try {
        // Flip the server to "shutting down" immediately (before agents stop) so a quick
        // relaunch takes over cleanly instead of attaching to this dying instance.
        try { await _shutdownFetch('/api/shutdown/begin', 2000); } catch (e) {}

        // Switch to checklist view
        document.getElementById('shutdown-confirm-body').style.display = 'none';
        document.getElementById('shutdown-footer').style.display = 'none';
        const checklist = document.getElementById('shutdown-checklist');
        checklist.style.display = '';

        const steps = [
            { name: 'downloader', endpoint: '/api/agent-a/stop' },
            { name: 'scanner',    endpoint: '/api/agent-b/stop' },
            { name: 'queue',      endpoint: null }, // queue auto-saves; brief pause
            { name: 'server',     endpoint: '/shutdown' },
        ];

        for (const step of steps) {
            try { _setStepState(step.name, 'active'); } catch (e) {}
            try {
                if (step.endpoint) {
                    await _shutdownFetch(step.endpoint, 5000);
                } else {
                    await new Promise(r => setTimeout(r, 500)); // queue save grace period
                }
            } catch (e) {
                // Server may have died on /shutdown - that's expected
            }
            try { _setStepState(step.name, 'done'); } catch (e) {}
        }
    } catch (e) {
        // Unexpected failure mid-checklist - still hand over to finish_shutdown.
    }

    // Tell pywebview to destroy the window now that cleanup is done
    if (window.pywebview?.api?.finish_shutdown) {
        try { window.pywebview.api.finish_shutdown(); } catch (e) {}
    } else {
        // Browser mode fallback - show closed message
        setTimeout(() => {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg-primary,#111110);color:var(--text-secondary,#b5b3ad);font-family:Inter,sans-serif;"><div style="text-align:center"><h2 style="color:var(--text-primary,#eeeeec);">Application Closed</h2><p>You can close this tab now.</p></div></div>';
        }, 800);
    }
}

function _setStepState(stepName, state) {
    const el = document.querySelector(`.shutdown-step[data-step="${stepName}"]`);
    if (!el) return;
    const iconEl = el.querySelector('.shutdown-step-icon');
    el.className = `shutdown-step ${state}`;
    if (state === 'active') {
        iconEl.innerHTML = '<i data-lucide="loader" class="icon" style="width:16px;height:16px;"></i>';
    } else if (state === 'done') {
        iconEl.innerHTML = '<i data-lucide="check-circle-2" class="icon" style="width:16px;height:16px;color:var(--accent-success);"></i>';
    }
    refreshIcons();
}

// Fallback for browser mode (no pywebview X button)
async function closeApp() {
    window.rocShowShutdownModal();
}

async function browseFolder() {
    const btn = document.querySelector('[onclick="browseFolder()"]');
    const originalHTML = btn ? btn.innerHTML : '';
    try {
        // Show loading state while dialog is open
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" class="icon spin"></i>Picking...';
            lucide.createIcons();
        }
        const response = await fetch('/api/browse-folder', { method: 'POST' });
        if (!response.ok) { showToast('Folder picker failed', 'error'); return; }
        const result = await response.json();
        if (result?.success && result.path) {
            document.getElementById('download-dir').value = result.path;
            // Auto-save after picking
            await saveDownloadDir();
        }
    } catch (e) {
        showToast('Could not open folder picker', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }
}

async function saveDownloadDir() {
    const directory = document.getElementById('download-dir').value.trim();
    const result = await api('/settings/download-directory', 'POST', { directory });
    if (result?.success) {
        showToast('Download directory saved', 'success');
    }
}

async function toggleNotifications(enabled) {
    const result = await api('/settings/notifications', 'POST', { enabled });
    if (result?.success) {
        showToast(`Notifications ${enabled ? 'enabled' : 'disabled'}`, 'success');
    }
}

async function saveDisplayName(name) {
    const result = await api('/settings/display-name', 'POST', { display_name: name });
    if (result?.success) {
        if (window.settingsData) window.settingsData.display_name = result.display_name;
        updateGreeting();
        showToast('Name saved', 'success');
    }
}

async function setAgentAHeadless(headless) {
    const result = await api('/settings/agent-a-headless', 'POST', { headless });
    if (result?.success) {
        showToast(`Downloader: Browser set to ${headless ? 'headless' : 'visible'} mode`, 'success');
        refreshSettings();
    }
}

async function setAgentBHeadless(headless) {
    const result = await api('/settings/agent-b-headless', 'POST', { headless });
    if (result?.success) {
        showToast(`Finder: Browser set to ${headless ? 'headless' : 'visible'} mode`, 'success');
        refreshSettings();
    }
}

// ── Finder schedule (interval + active-hours window) ──
let _finderDays = [0, 1, 2, 3, 4];

function _renderFinderDays() {
    document.querySelectorAll('#finder-days .pill-btn').forEach(btn => {
        const d = parseInt(btn.dataset.day, 10);
        btn.classList.toggle('active', _finderDays.includes(d));
        btn.setAttribute('aria-checked', _finderDays.includes(d) ? 'true' : 'false');
    });
}

function toggleFinderDay(d) {
    const i = _finderDays.indexOf(d);
    if (i >= 0) _finderDays.splice(i, 1); else _finderDays.push(d);
    _renderFinderDays();
}

function _updateFinderHoursVisibility() {
    const chk = document.getElementById('finder-active-hours-chk');
    const row = document.getElementById('finder-hours-row');
    if (row) row.style.display = (chk && chk.checked) ? '' : 'none';
}

async function saveFinderSchedule() {
    const interval = parseInt(document.getElementById('finder-interval').value, 10) || 15;
    const enabled = !!document.getElementById('finder-active-hours-chk').checked;
    const start = parseInt(document.getElementById('finder-start-hour').value, 10);
    const end = parseInt(document.getElementById('finder-end-hour').value, 10);
    const days = _finderDays.slice().sort((a, b) => a - b);
    const result = await api('/settings/finder-schedule', 'POST', {
        interval_minutes: interval,
        active_hours_enabled: enabled,
        start_hour: isNaN(start) ? 8 : start,
        end_hour: isNaN(end) ? 19 : end,
        days,
    });
    if (result?.success) {
        showToast(`Finder schedule saved - every ${Math.round(result.agent_b_interval_seconds / 60)} min`, 'success');
        refreshSettings();
    }
}

async function setFolderMode(mode) {
    const result = await api('/settings/download-folder-mode', 'POST', { mode });
    if (result?.success) {
        showToast(`Download mode: ${mode === 'organized' ? 'Organized (subfolders)' : 'Flat (all in one folder)'}`, 'success');
        refreshSettings();
    }
}

async function toggleAccountEnabled(code) {
    const result = await api(`/settings/account/${encodeURIComponent(code)}/toggle`, 'POST');
    if (result?.success) {
        showToast(`Account ${code}: ${result.enabled ? 'Enabled' : 'Disabled'}`, 'success');
        refreshSettings();
    }
}

async function toggleAgentAccount(code, field, value) {
    const agentLabel = field === 'finder_enabled' ? 'Finder' : 'Downloader';
    const result = await api(`/settings/account/${encodeURIComponent(code)}/agent-toggle`, 'PATCH', { field, value });
    if (result?.success) {
        showToast(`${code}: ${agentLabel} ${value ? 'enabled' : 'disabled'}`, value ? 'success' : 'info');
        refreshSettings();
    }
}

async function testAccount(code) {
    const btn = document.getElementById(`test-btn-${code}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="icon spin"></i>Testing…';
        refreshIcons();
    }

    const toastId = `account-test-${code}`;
    showToast(`Checking ${code}… this can take up to a minute`, 'info', { id: toastId, sticky: true, pending: true });

    try {
        const task = await api(`/settings/account/${encodeURIComponent(code)}/test`, 'POST');
        if (!task?.task_id) {
            updateToast(toastId, { type: 'error', message: `${code}: couldn't start the check` });
            return;
        }

        // Poll: 750ms for first 10s, then 2s. Cap ~90s total.
        const startTs = Date.now();
        const deadline = startTs + 90000;
        let lastMessage = '';
        while (Date.now() < deadline) {
            const elapsed = Date.now() - startTs;
            const wait = elapsed < 10000 ? 750 : 2000;
            await new Promise(r => setTimeout(r, wait));
            const result = await api(`/settings/account/${encodeURIComponent(code)}/test/${task.task_id}`, 'GET');
            if (!result) break;
            if (result.status === 'success') {
                updateToast(toastId, { type: 'success', message: `${code}: ${result.message}` });
                if (btn) { btn.disabled = false; btn.className = 'btn btn-sm btn-test-pass'; btn.innerHTML = '<i data-lucide="check" class="icon"></i>Passed'; refreshIcons(); }
                return;
            }
            if (result.status === 'failed') {
                updateToast(toastId, { type: 'error', message: `${code}: ${result.message}` });
                if (btn) { btn.disabled = false; btn.className = 'btn btn-sm btn-test-fail'; btn.innerHTML = '<i data-lucide="x" class="icon"></i>Failed'; refreshIcons(); }
                return;
            }
            // running - surface phase if it changed
            if (result.message && result.message !== lastMessage) {
                lastMessage = result.message;
                updateToast(toastId, { message: `${code}: ${result.message}` });
            }
        }
        updateToast(toastId, { type: 'warning', message: `${code}: timed out - ROC may be slow, try again` });
    } catch (e) {
        updateToast(toastId, { type: 'error', message: `${code}: check failed - ${e.message || 'unknown error'}` });
    } finally {
        if (btn && !btn.classList.contains('btn-test-pass') && !btn.classList.contains('btn-test-fail')) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="plug-zap" class="icon"></i>Test';
            refreshIcons();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════

const _toastDurations = { info: 3000, success: 3500, warning: 5500, error: 7000 };
const _toastIcons = {
    info:    'info',
    success: 'check-circle-2',
    warning: 'alert-triangle',
    error:   'alert-circle',
};
const _MAX_TOASTS = 5;

function showToast(message, type = 'info', opts = {}) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    if (opts.pending) toast.classList.add('pending');
    if (opts.id) toast.dataset.toastId = opts.id;
    const role = (type === 'warning' || type === 'error') ? 'alert' : 'status';
    toast.setAttribute('role', role);
    const iconName = opts.pending ? 'loader-2' : (_toastIcons[type] || 'info');
    const iconClass = opts.pending ? 'icon toast-icon spin' : 'icon toast-icon';
    toast.innerHTML = `<i data-lucide="${iconName}" class="${iconClass}"></i><span class="toast-msg">${escapeHtml(message)}</span><button class="toast-close" aria-label="Dismiss">&times;</button>`;
    container.appendChild(toast);
    refreshIcons();

    // Manual close (always available)
    toast.querySelector('.toast-close').addEventListener('click', () => {
        _clearToastTimer(toast);
        _dismissToast(toast);
    });

    if (!opts.sticky) {
        _startToastTimer(toast, type);
    }

    // Evict oldest if over max
    const toasts = container.querySelectorAll('.toast:not(.exiting)');
    if (toasts.length > _MAX_TOASTS) {
        _dismissToast(toasts[toasts.length - 1]); // oldest is last in column-reverse
    }
    return toast;
}

function _startToastTimer(toast, type) {
    if (toast._toastTimerActive) return;
    toast._toastTimerActive = true;
    const duration = _toastDurations[type] || 4000;
    let remaining = duration;
    let startTime = Date.now();
    let timer = setTimeout(() => _dismissToast(toast), remaining);
    toast._clearTimer = () => { clearTimeout(timer); toast._toastTimerActive = false; };

    toast.addEventListener('mouseenter', () => {
        clearTimeout(timer);
        remaining -= (Date.now() - startTime);
    });
    toast.addEventListener('mouseleave', () => {
        startTime = Date.now();
        timer = setTimeout(() => _dismissToast(toast), Math.max(remaining, 500));
        toast._clearTimer = () => { clearTimeout(timer); toast._toastTimerActive = false; };
    });
}

function _clearToastTimer(toast) {
    if (toast._clearTimer) toast._clearTimer();
}

// Update an existing toast (by id) in place. Falls back to showToast if not found.
function updateToast(id, { type, message } = {}) {
    const toast = document.querySelector(`[data-toast-id="${CSS.escape(id)}"]:not(.exiting)`);
    if (!toast) {
        return showToast(message || '', type || 'info', { id });
    }
    if (type) {
        ['info', 'success', 'warning', 'error'].forEach(t => toast.classList.remove(t));
        toast.classList.add(type);
        toast.classList.remove('pending');
        // Replace the icon node so Lucide re-renders (mutating data-lucide on the already-rendered SVG is a no-op)
        const iconEl = toast.querySelector('.toast-icon');
        if (iconEl) {
            const fresh = document.createElement('i');
            fresh.setAttribute('data-lucide', _toastIcons[type] || 'info');
            fresh.className = 'icon toast-icon';
            iconEl.replaceWith(fresh);
        }
        const role = (type === 'warning' || type === 'error') ? 'alert' : 'status';
        toast.setAttribute('role', role);
        // Pulse to cue the state change
        toast.classList.remove('toast-pulse');
        void toast.offsetWidth; // restart animation
        toast.classList.add('toast-pulse');
        setTimeout(() => toast.classList.remove('toast-pulse'), 450);
        refreshIcons();
    }
    if (message !== undefined) {
        const msgEl = toast.querySelector('.toast-msg');
        if (msgEl) msgEl.textContent = message;
    }
    if (type && !toast._toastTimerActive) {
        _startToastTimer(toast, type);
    }
    return toast;
}

function _dismissToast(toast) {
    if (toast.classList.contains('exiting')) return;
    toast.classList.add('exiting');
    setTimeout(() => toast.remove(), 200);
}

// ═══════════════════════════════════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

function getEffectiveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function switchSettingsPanel(panelName) {
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.settings-nav-link').forEach(l => l.classList.remove('active'));
    const panel = document.getElementById('settings-' + panelName);
    const link = document.querySelector(`.settings-nav-link[data-panel="${panelName}"]`);
    if (panel) panel.classList.add('active');
    if (link) link.classList.add('active');
    localStorage.setItem('pandaroc-settings-panel', panelName);
    if (panelName === 'account') renderAccountPanel();
}

function restoreSettingsPanel() {
    let saved = localStorage.getItem('pandaroc-settings-panel') || 'appearance';
    // A previously-saved panel may now be hidden (e.g. Trello) or removed — fall back to
    // appearance so we never restore to a panel whose nav link is unreachable.
    const link = document.querySelector(`.settings-nav-link[data-panel="${saved}"]`);
    if (!link || link.style.display === 'none') saved = 'appearance';
    switchSettingsPanel(saved);
}

function applyTheme(mode) {
    localStorage.setItem('roc-theme', mode);
    document.documentElement.setAttribute('data-theme', getEffectiveTheme(mode));
    updateThemeButtons(mode);
}

function setTheme(mode) {
    applyTheme(mode);
    fetch('/api/settings/theme', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({theme_mode: mode})
    }).catch(() => {});
}

function updateThemeButtons(mode) {
    const lightBtn = document.getElementById('theme-light-btn');
    const darkBtn = document.getElementById('theme-dark-btn');
    const systemBtn = document.getElementById('theme-system-btn');
    if (!lightBtn) return;

    [lightBtn, darkBtn, systemBtn].forEach(btn => btn.classList.remove('active'));
    const activeBtn = mode === 'light' ? lightBtn : mode === 'dark' ? darkBtn : systemBtn;
    activeBtn.classList.add('active');
}

// Listen for OS theme changes (only matters when in 'system' mode)
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    const pref = localStorage.getItem('roc-theme') || 'system';
    if (pref === 'system') {
        document.documentElement.setAttribute('data-theme', getEffectiveTheme('system'));
    }
});

// Initialize theme buttons on load
(function initThemeButtons() {
    const stored = localStorage.getItem('roc-theme') || 'system';
    updateThemeButtons(stored);
})();

// ═══════════════════════════════════════════════════════════════════════
// (Sidebar removed - top-nav is the primary navigation now)

// ═══════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════

// Initial load with "Connecting..." retry
let _backendReady = false;
let _trelloAutoSyncDone = false;
let _licPendingTries = 0;
async function _tryConnect() {
    try {
        // Use /api/health (license-exempt) to check if backend is ready
        const healthRes = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (healthRes.ok) {
            _backendReady = true;
            // Check license before loading full app
            const licOk = await refreshLicenseStatus();
            // Startup verify still running: keep the splash, poll again shortly.
            // Caps at ~30s (the verify itself times out long before that), then
            // falls through to the lock screen with whatever status we have.
            if (licOk === 'pending' && _licPendingTries < 40) {
                _licPendingTries++;
                setTimeout(_tryConnect, 750);
                return;
            }
            if (!licOk || licOk === 'pending') {
                const splash = document.getElementById('app-splash');
                if (splash) {
                    splash.style.opacity = '0';
                    setTimeout(() => splash.remove(), 500);
                }
                showLockScreen();
                return;
            }
            // Settings first (provides savedAccountOrder used by renderReadyTable)
            await refreshSettings();
            await Promise.all([
                refreshStatus(),
                refreshActivity(),
                refreshQueue(),
                refreshBlocklist(),
                refreshTrelloStatus(),
                refreshIssues(),
            ]);
            // Fade out splash overlay only after everything is loaded
            const splash = document.getElementById('app-splash');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => { splash.remove(); updatePillIndicator(); updateSegmentIndicator(); initCustomSelects(); restoreSettingsPanel(); }, 500);
            }
            // Auto-sync Trello once on startup if already configured
            if (!_trelloAutoSyncDone) {
                _trelloAutoSyncDone = true;
                const d = window.settingsData || {};
                if (d.trello_enabled && d.trello_api_key && d.trello_has_token && d.trello_board_id) {
                    fetch('/api/settings/trello/sync', { method: 'POST' }).catch(() => {});
                }
            }
            // First-run onboarding tour — server-persisted flag (localStorage doesn't
            // survive pywebview). Unreachable while locked (the unlicensed path returns
            // at the lock screen above); 650ms lets the 500ms splash fade finish first.
            if (window.settingsData && window.settingsData.onboarding_completed === false
                && typeof startOnboardingTour === 'function') {
                setTimeout(() => startOnboardingTour(false), 650);
            }
            return;
        }
    } catch (_) {}
    // Not ready - silently retry (splash is still showing)
    setTimeout(_tryConnect, 1000);
}
_tryConnect();

// Auto-refresh every 5 seconds
setInterval(() => { if (_backendReady) refreshData(); }, 5000);

// Needs-Attention issue stack: poll every 30s
setInterval(() => { if (_backendReady) refreshIssues(); }, 30000);

// Keyboard shortcuts
// ── Zoom ──
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.0, ZOOM_STEP = 0.1;
let _zoomLevel = parseFloat(localStorage.getItem('pandaroc-zoom') || '1');
document.body.style.zoom = _zoomLevel;
document.documentElement.style.setProperty('--zoom', _zoomLevel);

function _setZoom(level) {
    _zoomLevel = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level)) * 100) / 100;
    document.body.style.zoom = _zoomLevel;
    document.documentElement.style.setProperty('--zoom', _zoomLevel);
    localStorage.setItem('pandaroc-zoom', _zoomLevel);
    const pct = document.getElementById('zoom-pct');
    if (pct) pct.textContent = Math.round(_zoomLevel * 100) + '%';
    updatePillIndicator();
    updateSegmentIndicator();
    fetch('/api/settings/zoom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoom_level: _zoomLevel }) }).catch(() => {});
}

function _applyZoom(level) {
    _zoomLevel = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level)) * 100) / 100;
    document.body.style.zoom = _zoomLevel;
    document.documentElement.style.setProperty('--zoom', _zoomLevel);
    localStorage.setItem('pandaroc-zoom', _zoomLevel);
    const pct = document.getElementById('zoom-pct');
    if (pct) pct.textContent = Math.round(_zoomLevel * 100) + '%';
}

document.addEventListener('DOMContentLoaded', () => {
    const pct = document.getElementById('zoom-pct');
    if (pct) pct.textContent = Math.round(_zoomLevel * 100) + '%';
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case '1': e.preventDefault(); switchSection('dashboard'); break;
            case '2': e.preventDefault(); switchSection('orders'); break;
            case ',': e.preventDefault(); switchSection('settings'); break;
            case '+': case '=': e.preventDefault(); _setZoom(_zoomLevel + ZOOM_STEP); break;
            case '-':            e.preventDefault(); _setZoom(_zoomLevel - ZOOM_STEP); break;
            case '0':            e.preventDefault(); _setZoom(1); break;
        }
    }
});
    
// ═══════════════════════════════════════════════════════════════════════
// TRELLO INTEGRATION
// ═══════════════════════════════════════════════════════════════════════

let _trelloConfiguring = false; // True while user is filling in credentials

function refreshTrelloUI() {
    // Don't overwrite UI while user is configuring Trello
    if (_trelloConfiguring) return;

    const data = window.settingsData || {};
    const enabled = data.trello_enabled || false;
    const toggleBtn = document.getElementById('trello-toggle-btn');
    const toggleLabel = document.getElementById('trello-toggle-label');
    const fields = document.getElementById('trello-fields');
    const offMsg = document.getElementById('trello-off-msg');

    if (toggleBtn) {
        toggleBtn.dataset.enabled = enabled ? 'true' : 'false';
        toggleBtn.className = enabled ? 'btn btn-sm btn-success' : 'btn btn-sm btn-ghost';
    }
    if (toggleLabel) toggleLabel.textContent = enabled ? 'Connected' : 'Off';
    if (fields) fields.style.display = enabled ? 'block' : 'none';
    if (offMsg) offMsg.style.display = enabled ? 'none' : 'block';

    if (enabled) {
        document.getElementById('trello-api-key').value = data.trello_api_key || '';
        document.getElementById('trello-api-token').value = '';  // Never show token
        document.getElementById('trello-api-token').placeholder = data.trello_has_token ? '(saved - enter new to change)' : 'Your Trello API token';
        document.getElementById('trello-board-id').value = data.trello_board_id || '';
        // Sync interval (stored as seconds, displayed as minutes)
        const intervalSec = data.trello_sync_interval_seconds || 300;
        document.getElementById('trello-sync-interval').value = Math.round(intervalSec / 60);
        // Fetch sync status
        refreshTrelloStatus();
    } else {
        const statusBadge = document.getElementById('trello-status-badge');
        const errorBadge = document.getElementById('trello-error-badge');
        if (statusBadge) statusBadge.style.display = 'none';
        if (errorBadge) errorBadge.style.display = 'none';
    }
    refreshIcons();
}

async function refreshTrelloStatus() {
    const resp = await api('/settings/trello/status');
    if (!resp) return;

    const statusBadge = document.getElementById('trello-status-badge');
    const errorBadge = document.getElementById('trello-error-badge');
    const errorMsg = document.getElementById('trello-error-msg');
    const lastSyncEl = document.getElementById('trello-last-sync');

    if (resp.last_error) {
        if (statusBadge) statusBadge.style.display = 'none';
        if (errorBadge) errorBadge.style.display = 'block';
        if (errorMsg) errorMsg.textContent = resp.last_error;
    } else if (resp.last_sync) {
        if (errorBadge) errorBadge.style.display = 'none';
        if (statusBadge) statusBadge.style.display = 'block';
        if (lastSyncEl) {
            const syncTime = new Date(resp.last_sync);
            lastSyncEl.textContent = `Last sync: ${syncTime.toLocaleTimeString()} (${resp.card_count} cards)`;
        }
    } else {
        if (statusBadge) statusBadge.style.display = 'none';
        if (errorBadge) errorBadge.style.display = 'none';
    }

    // Update the small indicator on the Accepted tab header
    const indicator = document.getElementById('trello-sync-indicator');
    const timeEl = document.getElementById('trello-sync-time');
    if (indicator && timeEl) {
        if (resp.last_sync) {
            const t = new Date(resp.last_sync);
            timeEl.textContent = `Trello synced ${t.toLocaleTimeString()}`;
            indicator.style.display = 'inline-flex';
            indicator.style.alignItems = 'center';
            indicator.style.gap = '4px';
        } else {
            indicator.style.display = 'none';
        }
    }
}

function toggleTrello(enabled) {
    const fields = document.getElementById('trello-fields');
    const offMsg = document.getElementById('trello-off-msg');
    const toggleBtn = document.getElementById('trello-toggle-btn');
    const toggleLabel = document.getElementById('trello-toggle-label');

    if (enabled && _trelloConfiguring) {
        // Second press while configuring - user backs out, nothing was saved
        _trelloConfiguring = false;
        refreshTrelloUI();
        return;
    }

    if (fields) {
        fields.style.display = enabled ? 'block' : 'none';
        if (enabled) {
            fields.classList.remove('reveal');
            void fields.offsetWidth; // restart the animation on re-toggle
            fields.classList.add('reveal');
        }
    }
    if (offMsg) offMsg.style.display = enabled ? 'none' : 'block';

    if (enabled) {
        // User wants to configure - set flag so refreshSettings doesn't hide the form
        _trelloConfiguring = true;
        if (toggleBtn) toggleBtn.dataset.enabled = 'configuring';
        if (toggleLabel) toggleLabel.textContent = 'Cancel';
    } else {
        // Disconnect Trello
        _trelloConfiguring = false;
        api('/settings/trello', 'DELETE').then(resp => {
            if (resp && resp.success) {
                showToast('Trello disconnected', 'info');
                refreshSettings();
            } else {
                showToast('Failed to disconnect Trello', 'error');
            }
        }).catch(() => showToast('Failed to disconnect Trello', 'error'));
    }
    refreshIcons();
}

function openTrelloAdminPortal() {
    openExternal('https://trello.com/power-ups/admin');
}

function openTrelloTokenPage() {
    const apiKey = document.getElementById('trello-api-key').value.trim();
    if (!apiKey) {
        showToast('Enter your API Key first, then click Get Token', 'error');
        return;
    }
    const url = `https://trello.com/1/authorize?expiration=never&name=PandaRoc&scope=read,write,account&response_type=token&key=${apiKey}`;
    openExternal(url);
}

async function testTrelloConnection() {
    const apiKey = document.getElementById('trello-api-key').value.trim();
    const apiToken = document.getElementById('trello-api-token').value.trim();
    const boardId = document.getElementById('trello-board-id').value.trim();
    const resultEl = document.getElementById('trello-test-result');
    const hasSavedToken = window.settingsData && window.settingsData.trello_has_token;

    if (!apiKey || !boardId) {
        resultEl.style.display = 'block';
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = 'API Key and Board ID are required';
        return;
    }

    if (!apiToken && !hasSavedToken) {
        resultEl.style.display = 'block';
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = 'API Token is required';
        return;
    }

    resultEl.style.display = 'block';
    resultEl.style.color = 'var(--text-muted)';
    resultEl.textContent = 'Testing connection...';

    // Build test payload - server falls back to saved token if api_token is empty
    const payload = { api_key: apiKey, board_id: boardId };
    if (apiToken) {
        payload.api_token = apiToken;
    }

    const resp = await api('/settings/trello/test', 'POST', payload);
    if (!resp) {
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = 'Connection test failed';
        return;
    }

    if (resp.success) {
        resultEl.style.color = 'var(--success)';
        const lists = resp.lists || [];
        const listNames = lists.map(l => l.name);
        resultEl.textContent = `Connected to board: ${resp.board_name} (${lists.length} list${lists.length !== 1 ? 's' : ''})`;

        // Show which Trello lists match app accounts
        const matchInfo = document.getElementById('trello-match-info');
        const syncBtn = document.getElementById('trello-sync-btn');
        if (matchInfo) {
            // Get app accounts from settings
            const accounts = (window.settingsData && window.settingsData.accounts) || [];
            const accountCodes = accounts.map(a => a.code || a);
            const matched = accountCodes.filter(code =>
                listNames.some(ln => ln.trim().toLowerCase() === code.trim().toLowerCase())
            );
            const unmatched = accountCodes.filter(code =>
                !listNames.some(ln => ln.trim().toLowerCase() === code.trim().toLowerCase())
            );

            let html = '<div style="font-size:12px; margin-top:8px;">';
            if (matched.length > 0) {
                html += '<div style="color:var(--success);margin-bottom:4px;">' +
                    '<strong>Matched accounts:</strong> ' + matched.map(escapeHtml).join(', ') + '</div>';
            }
            if (unmatched.length > 0) {
                html += '<div style="color:var(--text-muted);margin-bottom:4px;">' +
                    '<strong>New lists will be created for:</strong> ' + unmatched.map(escapeHtml).join(', ') + '</div>';
            }
            html += '<div style="color:var(--text-muted);margin-top:4px;">Each account maps to a Trello list. Orders sync as cards with labels.</div>';
            // Warn if Custom Fields Power-Up is not enabled
            if (resp.warning) {
                html += '<div style="color:var(--warning, #f59e0b);margin-top:8px;padding:8px;border:1px solid var(--warning, #f59e0b);border-radius:6px;background:rgba(245,158,11,0.08);">' +
                    '<strong>⚠ ' + escapeHtml(resp.warning) + '</strong></div>';
            }
            html += '</div>';
            matchInfo.innerHTML = html;
            matchInfo.style.display = 'block';
        }
        if (syncBtn) syncBtn.style.display = 'inline-flex';
        refreshIcons();
    } else {
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = resp.error || 'Connection failed';
    }
}

async function saveTrelloAndSync() {
    const apiKey = document.getElementById('trello-api-key').value.trim();
    const apiToken = document.getElementById('trello-api-token').value.trim();
    const boardId = document.getElementById('trello-board-id').value.trim();

    if (!apiKey || !boardId) {
        showToast('API Key and Board ID are required', 'error');
        return;
    }

    // Sync interval (UI = minutes, API = seconds)
    const intervalMin = parseInt(document.getElementById('trello-sync-interval').value) || 5;
    const intervalSec = Math.max(60, Math.min(intervalMin * 60, 3600));

    // Save credentials + settings
    const savePayload = { enabled: true, api_key: apiKey, board_id: boardId, sync_interval_seconds: intervalSec };
    if (apiToken) savePayload.api_token = apiToken;

    const saveResp = await api('/settings/trello', 'POST', savePayload);
    if (!saveResp || !saveResp.success) {
        showToast('Failed to save Trello settings', 'error');
        return;
    }

    // Trigger full sync in background (returns immediately, no timeout)
    const syncResp = await api('/settings/trello/sync', 'POST');
    if (syncResp && syncResp.success) {
        showToast('Trello sync started - check status for progress', 'success');
    } else {
        showToast('Could not start Trello sync', 'error');
    }

    _trelloConfiguring = false;
    // Poll status after a short delay to show progress
    setTimeout(() => refreshSettings(), 3000);
}

// ───────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
// LICENSE
// ═══════════════════════════════════════════════════════════════════════════════

// External links: pywebview ignores window.open / target=_blank on macOS, so
// every outbound link goes through the backend (opens the system browser on
// both platforms). window.open stays as the fallback for plain-browser dev.
function openExternal(url) {
    fetch('/api/open-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    }).then(res => { if (!res.ok) window.open(url, '_blank'); })
      .catch(() => window.open(url, '_blank'));
}

let _licenseData = null;

async function refreshLicenseStatus() {
    try {
        const res = await fetch('/api/license/status', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return true; // if endpoint missing, don't block
        _licenseData = await res.json();
        // Startup verify still in flight: don't flash the login screen on a
        // device that's already logged in. _tryConnect keeps the splash up and
        // retries until the backend has a real answer.
        if (!_licenseData.licensed && _licenseData.pending) return 'pending';
        updateLicenseUI(_licenseData);
        if (!_licenseData.licensed) {
            showLockScreen();
            return false;
        }
        hideLockScreen();
        updateTrialBanner(_licenseData);
        return true;
    } catch (e) {
        return true; // network error - don't block
    }
}

function updateLicenseUI(data) {
    const badge = document.getElementById('license-status-badge');
    const daysEl = document.getElementById('license-days-remaining');
    const slotSection = document.getElementById('license-slot-section');
    const activeActions = document.getElementById('license-active-actions');
    const tierInfo = document.getElementById('license-tier-info');
    if (!badge) return;

    badge.className = 'chip';
    if (data.status === 'active') {
        badge.className = 'chip success'; badge.textContent = 'Active';
    } else if (data.status === 'trial') {
        badge.className = 'chip warn'; badge.textContent = 'Trial';
    } else if (data.status === 'past_due') {
        badge.className = 'chip warn'; badge.textContent = 'Past Due';
    } else if (data.status === 'expired' || data.status === 'unlicensed') {
        badge.className = 'chip danger'; badge.textContent = data.status === 'expired' ? 'Expired' : 'Not signed in';
    } else {
        badge.textContent = data.status || 'Unknown';
    }

    // Countdown only matters for trials; a monthly sub just renews (the Account
    // panel shows the renewal date), so "29 days remaining" would read like expiry.
    if (data.days_remaining != null && data.licensed && data.is_trial) {
        daysEl.textContent = data.days_remaining === 0 ? 'Trial ends today' : `${data.days_remaining} day${data.days_remaining !== 1 ? 's' : ''} left in trial`;
    } else {
        daysEl.textContent = '';
    }

    if (data.licensed && data.slot_count > 0) {
        slotSection.style.display = '';
        const used = accountsInUse();
        const pct = Math.min(100, Math.round((used / data.slot_count) * 100));
        const fill = document.getElementById('slot-meter-fill');
        fill.style.width = pct + '%';
        fill.className = 'slot-meter-fill' + (pct >= 100 ? ' danger' : pct >= 80 ? ' warning' : '');
        document.getElementById('slot-meter-label').textContent = `${used} of ${data.slot_count} slots used`;
    } else {
        slotSection.style.display = 'none';
    }

    activeActions.style.display = data.licensed ? '' : 'none';
    const _plan = planLabel(data);
    tierInfo.textContent = (data.licensed && _plan) ? `Plan: ${_plan}` : '';

    // Sign-in state: show the login form only when this device holds no account.
    const signedInState = data.licensed || !!data.email;
    const loginSection = document.getElementById('device-login-section');
    const signedIn = document.getElementById('device-signed-in');
    if (loginSection) loginSection.style.display = signedInState ? 'none' : '';
    if (signedIn) {
        signedIn.style.display = signedInState ? '' : 'none';
        const emailEl = document.getElementById('device-account-email');
        if (emailEl) emailEl.textContent = data.email || 'Your account';
    }
    renderAccountPanel(data);
}

// Friendly plan name derived from slot_count (the server's raw plan_tier isn't user-facing).
function planLabel(data) {
    const map = { 1: 'Starter', 5: 'Small Firm', 10: 'Professional', 20: 'Firm' };
    const n = (data && data.slot_count) || 0;
    if (n <= 0) return '';
    return map[n] || `Custom (${n} account${n !== 1 ? 's' : ''})`;
}

// Number of ROC accounts currently enabled (= slots in use; disabling one frees a slot).
function accountsInUse() {
    const accts = (window.settingsData && window.settingsData.accounts) || [];
    return accts.filter(a => a && a.enabled).length;
}

// Account settings panel — name + plan + status + slots + renewal, sourced from the license status.
function renderAccountPanel(data) {
    data = data || _licenseData || {};
    const badge = document.getElementById('account-status-badge');
    if (!badge) return;
    const nameEl = document.getElementById('account-name');
    const details = document.getElementById('account-details');
    const hint = document.getElementById('account-unlicensed-hint');

    badge.className = 'chip';
    if (data.status === 'active') { badge.classList.add('success'); badge.textContent = 'Active'; }
    else if (data.status === 'trial') { badge.classList.add('warn'); badge.textContent = 'Trial'; }
    else if (data.status === 'past_due') { badge.classList.add('warn'); badge.textContent = 'Past Due'; }
    else if (data.status === 'expired') { badge.classList.add('danger'); badge.textContent = 'Expired'; }
    else if (!data.licensed || data.status === 'unlicensed') { badge.classList.add('danger'); badge.textContent = 'Not signed in'; }
    else { badge.textContent = data.status || 'Unknown'; }

    nameEl.textContent = data.customer_name || data.email || (data.licensed ? 'Your account' : '');

    if (data.licensed) {
        details.style.display = '';
        hint.style.display = 'none';
        document.getElementById('account-plan').textContent = planLabel(data) || '—';
        const slot = data.slot_count || 0;
        document.getElementById('account-slots').textContent = `${accountsInUse()} of ${slot} ${slot === 1 ? 'account' : 'accounts'}`;
        const row = document.getElementById('account-renewal-row');
        const lbl = document.getElementById('account-renewal-label');
        const val = document.getElementById('account-renewal');
        const iso = data.is_trial ? data.trial_ends_at : data.current_period_end;
        const d = iso ? new Date(iso) : null;
        if (d && !isNaN(d)) {
            lbl.textContent = data.is_trial ? 'Trial ends' : 'Renews';
            val.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            row.style.display = '';
        } else if (data.days_remaining != null) {
            lbl.textContent = data.is_trial ? 'Trial ends' : 'Renews';
            val.textContent = data.days_remaining === 0 ? 'Today' : `in ${data.days_remaining} day${data.days_remaining !== 1 ? 's' : ''}`;
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    } else {
        details.style.display = 'none';
        hint.style.display = '';
    }
}

// ROC passwords never sync (by design), so after a login that reset this device
// the accounts come back from the cloud without their passwords. Shown while any
// enabled account is missing one; disappears by itself once they're re-entered.
function updatePasswordBanner(accounts) {
    const banner = document.getElementById('password-banner');
    if (!banner) return;
    const missing = (accounts || []).filter(a => a && a.enabled && !a.has_password).length;
    if (missing > 0) {
        const txt = document.getElementById('password-banner-text');
        if (txt) txt.textContent = missing === 1
            ? 'One ROC account needs its password re-entered. For security, passwords stay on this device only.'
            : `${missing} ROC accounts need their passwords re-entered. For security, passwords stay on this device only.`;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

function updateTrialBanner(data) {
    const banner = document.getElementById('trial-banner');
    if (!banner) return;
    if (data.is_trial && data.days_remaining != null) {
        banner.style.display = 'flex';
        document.getElementById('trial-banner-text').textContent = `${data.days_remaining} day${data.days_remaining !== 1 ? 's' : ''} remaining in your free trial`;
    } else {
        banner.style.display = 'none';
    }
}

let _lockVerifyTimer = null;

function showLockScreen() {
    const el = document.getElementById('lock-screen');
    if (!el) return;
    el.style.display = 'flex';
    const title = document.getElementById('lock-screen-title');
    const msg = document.getElementById('lock-screen-message');
    const loginForm = document.getElementById('lock-login-form');
    const nosubActions = document.getElementById('lock-nosub-actions');

    const reason = _licenseData && _licenseData.reason;
    // Signed in but no active plan: don't ask for credentials again — point at
    // billing and poll a real verify so the app unlocks by itself after payment.
    const loggedInNoSub = _licenseData && _licenseData.status === 'expired'
        && (reason === 'no_subscription' || reason === 'trial_expired' || reason === 'cache_expired');

    if (loggedInNoSub) {
        if (reason === 'trial_expired') {
            title.textContent = 'Trial Expired';
            msg.textContent = 'Your free trial has ended. Choose a plan on pandaroc.com to keep using PandaRoc — the app unlocks automatically once payment completes.';
        } else {
            title.textContent = 'No Active Subscription';
            msg.textContent = "You're signed in, but there's no active plan on your account. Manage your plan on pandaroc.com — the app unlocks automatically once payment completes.";
        }
        if (loginForm) loginForm.style.display = 'none';
        if (nosubActions) nosubActions.style.display = '';
        if (!_lockVerifyTimer) _lockVerifyTimer = setInterval(lockScreenRecheck, 60000);
    } else {
        title.textContent = 'Log in to PandaRoc';
        msg.textContent = (reason === 'offline_no_cache')
            ? "Can't reach the license server. Check your internet connection and try again."
            : 'Use your PandaRoc account email and password.';
        if (loginForm) loginForm.style.display = '';
        if (nosubActions) nosubActions.style.display = 'none';
        if (_lockVerifyTimer) { clearInterval(_lockVerifyTimer); _lockVerifyTimer = null; }
    }
}

function hideLockScreen() {
    const el = document.getElementById('lock-screen');
    if (el) el.style.display = 'none';
    if (_lockVerifyTimer) { clearInterval(_lockVerifyTimer); _lockVerifyTimer = null; }
}

async function _submitLogin(emailInput, passInput, errEl) {
    const email = (emailInput.value || '').trim();
    const password = passInput.value || '';
    // NOTE: must be 'block', not '' — .lock-screen-error is hidden by a CSS
    // class rule, and clearing the inline style just falls back to display:none
    // (errors were set but never visible).
    if (!email || !password) {
        errEl.textContent = 'Enter your email and password';
        errEl.style.display = 'block';
        return false;
    }
    errEl.style.display = 'none';
    try {
        const res = await fetch('/api/license/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        passInput.value = '';
        if (!res.ok) {
            errEl.textContent = (res.status === 401)
                ? 'Wrong email or password. Check them and try again.'
                : (data.detail || 'Login failed');
            errEl.style.display = 'block';
            return false;
        }
        emailInput.value = '';
        if (data.account_reset) {
            showToast(`Signed in as ${data.email || email} — this device was set up fresh`, 'success');
        }
        await refreshLicenseStatus();
        if (_licenseData && _licenseData.licensed) {
            hideLockScreen();
            _tryConnect();
        }
        return true;
    } catch (e) {
        errEl.textContent = 'Could not reach the license server. Check your internet connection.';
        errEl.style.display = 'block';
        return false;
    }
}

async function settingsLogin() {
    const btn = document.getElementById('device-login-btn');
    btn.disabled = true; btn.textContent = 'Signing in...';
    await _submitLogin(
        document.getElementById('device-email-input'),
        document.getElementById('device-password-input'),
        document.getElementById('device-login-error'),
    );
    btn.disabled = false; btn.textContent = 'Sign In';
}

async function lockScreenLogin() {
    const btn = document.getElementById('lock-login-btn');
    btn.disabled = true; btn.textContent = 'Logging in...';
    await _submitLogin(
        document.getElementById('lock-email'),
        document.getElementById('lock-password'),
        document.getElementById('lock-login-error'),
    );
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" class="icon"></i> Log In';
    if (window.lucide) lucide.createIcons();
}

async function lockScreenRecheck() {
    try {
        const res = await fetch('/api/license/verify', { method: 'POST' });
        if (!res.ok) return;
        const wasLicensed = _licenseData && _licenseData.licensed;
        await refreshLicenseStatus();
        // Just unlocked (payment landed): load the app — startup bailed at the lock screen.
        if (!wasLicensed && _licenseData && _licenseData.licensed) _tryConnect();
    } catch (e) {}
}

async function lockScreenLogout() {
    try {
        await fetch('/api/license/deactivate', { method: 'POST' });
    } catch (e) {}
    await refreshLicenseStatus();
}

async function deactivateLicense() {
    if (!confirm('Log out on this device? You can log back in anytime with your email and password.')) return;
    try {
        await fetch('/api/license/deactivate', { method: 'POST' });
        await refreshLicenseStatus();
    } catch (e) {}
}

async function forceVerifyLicense() {
    try {
        const res = await fetch('/api/license/verify', { method: 'POST' });
        if (res.ok) {
            await refreshLicenseStatus();
            showToast('License verified', 'success');
        }
    } catch (e) {
        showToast('Verification failed', 'error');
    }
}

async function refreshSyncStatus() {
    try {
        const res = await fetch('/api/sync/status');
        if (!res.ok) return;
        const data = await res.json();
        const badge = document.getElementById('sync-status-badge');
        const timeEl = document.getElementById('sync-last-time');
        if (!badge || !timeEl) return;

        const lastPush = data.last_push ? new Date(data.last_push) : null;
        const lastPull = data.last_pull ? new Date(data.last_pull) : null;
        const latest = lastPush && lastPull ? (lastPush > lastPull ? lastPush : lastPull) : (lastPush || lastPull);

        if (latest) {
            badge.className = 'chip success';
            badge.textContent = 'Synced';
            const ago = Math.round((Date.now() - latest.getTime()) / 1000);
            if (ago < 60) timeEl.textContent = 'just now';
            else if (ago < 3600) timeEl.textContent = Math.floor(ago / 60) + 'm ago';
            else timeEl.textContent = Math.floor(ago / 3600) + 'h ago';
        } else {
            badge.className = 'chip';
            badge.textContent = 'Not synced';
            timeEl.textContent = '';
        }
    } catch (e) {}
}

async function syncNow() {
    const btn = document.getElementById('sync-now-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="icon"></i> Syncing...'; }
    try {
        await fetch('/api/sync/pull', { method: 'POST' });
        await fetch('/api/sync/push', { method: 'POST' });
        await refreshSyncStatus();
        showToast('Sync complete', 'success');
    } catch (e) {
        showToast('Sync failed', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="upload-cloud" class="icon"></i> Sync Now'; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}


(function () {
  // Heartbeat: ping the server every 3 seconds to let it know the tab is alive.
  // This is informational only - if the tab closes, the server and agents
  // continue running. Reconnect by opening http://localhost:5000 in a new tab.
  function sendHeartbeat() {
    try {
      fetch('/api/heartbeat', { method: 'POST', keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  sendHeartbeat();
  setInterval(sendHeartbeat, 3000);
})();

// ═══════════════════════════════════════════════════════════════════════
// NAME APPROVALS - approval-likelihood checker + shortlist
// ═══════════════════════════════════════════════════════════════════════

/* ─────────────────────────────────────────────────────────────────────
   NAME CHECK - redesigned tab. Three verdict treatments (meter, stamp, ring),
   two-stage real backend (offline -> live registry), shortlist + promote.
   ───────────────────────────────────────────────────────────────────── */
const _RING_C = 2 * Math.PI * 20;   // shortlist mini-ring (r=20)
const _RING84 = 2 * Math.PI * 84;   // hero ring (r=84)
let _ncLast = null;
let _ncTimer = null;
let _ncReq = 0;
let _ncCelebrated = '';
let _ncCandidates = [];
const _ncCollisionCache = {}; // session cache: normalized core -> refined assessment

function _el(id) { return document.getElementById(id); }
function _ncIcons() { if (window.lucide) lucide.createIcons(); }
const verdictWord = (v) => v === 'likely' ? 'Likely' : v === 'uncertain' ? 'Borderline' : 'Unlikely';

// Cosmetic normalize for the live core-chip preview (Greek + Latin, strip punctuation).
function ncNormalize(s) {
    return (s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9Α-ΩΆ-Ώ ]/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

// ── core preview chips ──
function ncRenderCore() {
    const name = (_el('nc-input')?.value || '');
    const el = _el('nc-core');
    if (!el) return;
    const norm = ncNormalize(name);
    if (!norm) { el.innerHTML = '<span class="nc-core__label">distinctive core appears here</span>'; return; }
    const LEGAL = ['LTD', 'PLC', 'LIMITED', 'PUBLIC'];
    // Cosmetic preview only - mirrors a representative slice of the engine's
    // filler list plus a few common activity words (the full lexicon lives in
    // static/vendor/activity_lexicon.txt and is judged server-side).
    const NONDIST = new Set('TRADING TRADE SERVICES SERVICE HOLDINGS HOLDING CONSULTING GROUP VENTURES ENTERPRISES INVESTMENTS MANAGEMENT PARTNERS COMPANY CO SYSTEMS CAPITAL COMMERCIAL GENERAL AGENCY BUSINESS ONLINE DIGITAL CYPRUS NICOSIA LIMASSOL INTERNATIONAL GLOBAL EUROPEAN CONSTRUCTIONS CONSTRUCTION FINANCE FINANCIAL MEDIA MARKETING TECHNOLOGY TECHNOLOGIES TECH PROPERTIES PROPERTY ESTATES DEVELOPMENTS RESTAURANT CATERING SHIPPING LOGISTICS TRANSPORT'.split(' '));
    const toks = norm.split(' ').filter(Boolean);
    el.innerHTML = '<span class="nc-core__label">core</span>' + toks.map(t => {
        if (LEGAL.includes(t)) return '';
        const cls = NONDIST.has(t) ? ' generic' : '';
        return `<span class="nc-chip${cls}">${escapeHtml(t)}</span>`;
    }).join('');
}

// ── registry note ──
function ncSetNote(note, pending) {
    const el = _el('nc-registry-note');
    if (!el) return;
    if (pending) { el.className = 'nc-registry-note searching'; el.innerHTML = '<i data-lucide="loader-2" class="icon spin"></i> Searching the Cyprus registry - this can take a few seconds'; _ncIcons(); return; }
    const map = {
        live: ['shield-check', 'Verified against the live Cyprus registry'],
        cache: ['shield-check', 'Checked against the registry (cached)'],
        cooldown: ['pause', 'Registry paused (cooldown) - offline estimate'],
        blocked: ['wifi-off', 'Registry unavailable - offline estimate'],
        error: ['wifi-off', 'Registry unreachable - offline estimate'],
        skipped: ['minus', 'Offline estimate'],
    };
    const m = map[note] || map.skipped;
    el.className = 'nc-registry-note' + (['cooldown', 'blocked', 'error'].includes(note) ? ' warn' : '');
    el.innerHTML = `<i data-lucide="${m[0]}" class="icon"></i> ${m[1]}`;
    _ncIcons();
}

function summaryFor(r, pending) {
    const f = r.flags || [];
    const has = t => f.some(x => x.type === t);
    if (has('brand')) return 'Looks like a protected international brand - high refusal risk.';
    if (has('government')) return 'Implies a connection with the state - refused without proof of that connection.';
    if (has('crowding')) return 'Hundreds of registered names already use these words - approval is very unlikely.';
    if ((r.pillars.collision || 0) >= 0.6) return 'Closely matches a name already on the register.';
    if ((r.pillars.distinctiveness || 0) >= 0.6) return 'Too generic to be distinctive - a common reason for refusal.';
    if (has('restricted')) return 'Contains a restricted word that needs prior consent.';
    if (r.verdict === 'likely') return pending ? 'Distinctive name - confirming against the registry…' : 'Distinctive name with low collision risk.';
    if (r.verdict === 'uncertain') return 'Some risk factors - see the breakdown.';
    return 'Several risk factors make approval unlikely.';
}

function complianceSub(r) {
    const f = r.flags || [];
    const find = t => f.find(x => x.type === t);
    if (find('brand')) return 'Resembles a protected brand';
    if (find('government')) return 'Implies a state connection';
    const rw = find('restricted'); if (rw) return 'Needs consent: ' + (rw.word || 'restricted word');
    if (find('offensive')) return 'Potentially offensive wording';
    if (find('suffix')) return 'Add a legal ending (LTD / ΛΤΔ)';
    if (find('misleading')) return 'May read as misleading';
    return 'No compliance issues';
}

// ── verdict treatment (ring) ──
function ncRenderRing(r) {
    const fill = _el('nc-ring-fill');
    fill.style.strokeDasharray = _RING84.toFixed(2);
    fill.style.strokeDashoffset = (_RING84 * (1 - r.score / 100)).toFixed(2);
    _el('nc-ring-score').textContent = r.score;
    _el('nc-ring-verdict').textContent = verdictWord(r.verdict);
}

// ── breakdown panel (shared) ──
function ncRenderFactors(r, pending) {
    const defs = [
        { key: 'distinctiveness', label: 'Distinctiveness', icon: 'fingerprint' },
        { key: 'collision', label: 'Registry collision', icon: 'copy' },
        { key: 'compliance', label: 'Compliance', icon: 'scale' },
    ];
    _el('nc-factors').innerHTML = defs.map(d => {
        const risk = Math.round((r.pillars[d.key] || 0) * 100);
        const sev = risk >= 50 ? 'high' : risk >= 20 ? 'mid' : 'low';
        let cls = '', sub, valTxt = risk + '% risk', width = risk;
        if (d.key === 'collision' && pending) {
            cls = 'pending'; sub = 'Checking the Cyprus registry…'; valTxt = ''; width = 0;
        } else if (d.key === 'collision') {
            const n = (r.closest || []).length;
            const overflow = r.crowding && r.crowding.primary_overflow;
            sub = !r.registry_ran ? 'Registry not checked'
                : overflow ? 'Registry reports 200+ names with these words'
                : n ? `${n} similar name${n > 1 ? 's' : ''} on the register` : 'No similar names found';
        } else if (d.key === 'distinctiveness') {
            sub = risk >= 50 ? 'Too generic - not distinctive' : risk >= 20 ? 'Somewhat generic' : 'Strong, distinctive name';
        } else {
            sub = complianceSub(r);
        }
        return `<div class="nc-factor ${cls || sev}">
            <div class="nc-factor__icon"><i data-lucide="${d.icon}" class="icon"></i></div>
            <div class="nc-factor__body">
                <div class="nc-factor__row"><span class="nc-factor__label">${d.label}</span><span class="nc-factor__val">${valTxt}</span></div>
                <div class="nc-factor__sub">${sub}</div>
                <div class="nc-factor__bar"><div class="nc-factor__fill" style="width:${width}%"></div></div>
            </div>
        </div>`;
    }).join('');
}

function ncRenderFlags(flags) {
    const icon = { restricted: 'shield-alert', brand: 'badge-alert', offensive: 'octagon-alert', suffix: 'pencil', misleading: 'triangle-alert', crowding: 'layers', industry: 'factory', government: 'landmark' };
    _el('nc-flags').innerHTML = (flags || []).map(f =>
        `<span class="nc-flag ${f.severity || 'low'}"><i data-lucide="${icon[f.type] || 'info'}" class="icon"></i>${escapeHtml(f.message)}</span>`
    ).join('');
}

function statusInfo(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('αίτηση') || s.includes('αιτηση')) return { cls: 'pending', label: 'Name application' };
    if (s.includes('εγγεγρ') || s.includes('υπενθ') || s.includes('register')) return { cls: 'active', label: 'Registered' };
    if (s.includes('διαλυ') || s.includes('διαγρ') || s.includes('εκκαθ') || s.includes('dissolv') || s.includes('struck')) return { cls: '', label: 'Dissolved' };
    return { cls: '', label: status ? (status.length > 18 ? status.slice(0, 18) + '…' : status) : '-' };
}

function ncRenderClosest(r, pending) {
    const el = _el('nc-closest');
    if (pending) { el.innerHTML = '<div class="nc-closest__title">Closest existing names</div><div class="nc-closest__empty">Searching the register…</div>'; return; }
    const closest = r.closest || [];
    if (!closest.length) {
        const overflow = r.crowding && r.crowding.primary_overflow;
        el.innerHTML = r.registry_ran
            ? `<div class="nc-closest__title">Existing names</div><div class="nc-closest__empty">${overflow ? 'The register holds 200+ names with these words, too many to list.' : 'No similar names on the Cyprus register.'}</div>`
            : '';
        return;
    }
    el.innerHTML = `<div class="nc-closest__title">Closest existing names</div>` + closest.map(c => {
        const sim = Math.round((c.similarity || 0) * 100);
        const st = statusInfo(c.status);
        return `<div class="nc-closest__row">
            <span class="nc-closest__name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)} <b>${escapeHtml(c.reg_no || '')}</b></span>
            <span class="nc-status ${st.cls}">${st.label}</span>
            <span class="nc-closest__sim"><span class="nc-closest__simbar"><span class="nc-closest__simfill" style="width:${sim}%"></span></span><span class="nc-closest__simval">${sim}%</span></span>
            ${c.reason ? `<span class="nc-closest__reason">${escapeHtml(c.reason)}</span>` : ''}
        </div>`;
    }).join('');
}

// ── master render ──
function ncRender(r, pending) {
    _ncLast = r;
    const result = _el('nc-result');
    result.dataset.state = 'done';
    result.classList.remove('is-likely', 'is-uncertain', 'is-unlikely');
    result.classList.add('is-' + r.verdict);
    result.classList.toggle('nc-checking', !!pending);
    _el('nc-verdict-sub').textContent = summaryFor(r, pending);
    ncSetNote(pending ? null : r.registry_note, pending);
    ncRenderRing(r);
    ncRenderFactors(r, pending);
    ncRenderFlags(r.flags);
    ncRenderClosest(r, pending);
    _el('nc-hero-cta').style.display = '';
    _ncIcons();
    if (!pending && r.verdict === 'likely' && r.score >= 78 && _ncCelebrated !== r.normalized) {
        _ncCelebrated = r.normalized; ncCelebrate();
    }
}

function ncResetIdle() {
    _ncLast = null;
    const result = _el('nc-result');
    result.dataset.state = 'idle';
    result.classList.remove('is-likely', 'is-uncertain', 'is-unlikely', 'nc-checking');
    _el('nc-verdict-sub').textContent = '';
    _el('nc-registry-note').innerHTML = '';
    _el('nc-hero-cta').style.display = 'none';
}

// ── run check (two-stage against the real backend) ──
async function runNameCheck() {
    const name = (_el('nc-input')?.value || '').trim();
    if (!name) { ncResetIdle(); return; }
    const has_consent = _el('nc-consent-input')?.checked || false;
    const reqId = ++_ncReq;

    // Stage 1: instant offline score (no browser traffic)
    const r = await api('/names/check', 'POST', { name, has_consent });
    if (reqId !== _ncReq) return; // superseded by a newer check
    if (!r) { ncSetNote('error', false); return; }
    _ncLast = r;
    const pending = r.registry_note === 'pending';
    ncRender(r, pending);
    ncSaveLast(name, has_consent);
    if (!pending) return;

    // Stage 2: live registry refinement (silent + generous timeout so no busy toast)
    const key = r.normalized || name;
    const coreLen = key.replace(/\b(LTD|PLC)\b/g, '').replace(/\s+/g, '').length;
    if (coreLen < 3) { ncRender(r, false); return; } // too short to search
    if (_ncCollisionCache[key]) { _ncLast = _ncCollisionCache[key]; ncRender(_ncCollisionCache[key], false); return; }
    const col = await api('/names/collision', 'POST', { name, has_consent }, { silent: true, timeout: 60000 });
    if (reqId !== _ncReq) return;
    if (col) { _ncCollisionCache[key] = col; _ncLast = col; ncRender(col, false); }
    else { ncSetNote('error', false); }
}

function ncSaveLast(name, consent) { try { localStorage.setItem('nc-last', JSON.stringify({ name, consent })); } catch (e) {} }

function ncOnInput() {
    clearTimeout(_ncTimer);
    ncRenderCore();
    if (!(_el('nc-input')?.value || '').trim()) { ncResetIdle(); return; }
    _ncTimer = setTimeout(runNameCheck, 1100); // long debounce so partial names don't hit the registry
}

// ── shortlist (backed by /api/names) ──
async function saveCurrentName() {
    if (!_ncLast) return;
    if (_ncCandidates.some(c => (c.normalized || '') === _ncLast.normalized)) { ncToast('Already on your shortlist'); return; }
    const has_consent = _el('nc-consent-input')?.checked || false;
    const r = await api('/names', 'POST', { name: _ncLast.name, has_consent });
    if (r) { ncToast('Saved to shortlist'); loadNameCandidates(); }
}

async function loadNameCandidates() {
    const data = await api('/names');
    _ncCandidates = (data && data.candidates) || [];
    const inlineCount = _el('nc-count'); if (inlineCount) inlineCount.textContent = _ncCandidates.length;
    const badge = _el('nav-approvals-count');
    if (badge) { badge.textContent = _ncCandidates.length; badge.style.display = _ncCandidates.length ? '' : 'none'; }
    const grid = _el('nc-cards');
    if (!grid) return;
    if (!_ncCandidates.length) {
        grid.innerHTML = `<div class="nc-empty">No saved names yet - check a name and tap "Save to shortlist".</div>`;
        return;
    }
    grid.innerHTML = _ncCandidates.map(c => {
        const v = c.verdict || 'unlikely';
        const short = verdictWord(v);
        const off = (_RING_C * (1 - (c.score || 0) / 100)).toFixed(1);
        return `<div class="nc-savecard is-${v}">
            <div class="nc-savecard__ring"><svg viewBox="0 0 46 46"><circle class="t" cx="23" cy="23" r="20" fill="none" stroke-width="4"></circle><circle class="f" cx="23" cy="23" r="20" fill="none" stroke-width="4" stroke-linecap="round" style="stroke-dasharray:${_RING_C.toFixed(1)};stroke-dashoffset:${off}"></circle></svg><div class="nc-savecard__num">${c.score}</div></div>
            <div class="nc-savecard__body"><div class="nc-savecard__name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div><div class="nc-savecard__meta">${short}${c.registry_ran ? '' : ' · offline'}</div></div>
            <div class="nc-savecard__actions">
                <button class="nc-iconbtn" title="Re-check" onclick="recheckCandidate('${c.id}')"><i data-lucide="refresh-cw" class="icon"></i></button>
                <button class="nc-iconbtn" title="Track as ROC order" onclick="openPromote('${c.id}')"><i data-lucide="circle-arrow-right" class="icon"></i></button>
                <button class="nc-iconbtn danger" title="Delete" onclick="deleteCandidate('${c.id}')"><i data-lucide="trash-2" class="icon"></i></button>
            </div>
        </div>`;
    }).join('');
    _ncIcons();
}

function recheckCandidate(id) {
    const c = _ncCandidates.find(x => x.id === id);
    if (!c) return;
    const input = _el('nc-input');
    if (input) input.value = c.name;
    const consent = _el('nc-consent-input');
    if (consent) consent.checked = !!c.has_consent;
    ncRenderCore();
    clearTimeout(_ncTimer);
    runNameCheck();
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteCandidate(id) {
    const r = await api('/names/' + id, 'DELETE');
    if (r) { ncToast('Removed from shortlist'); loadNameCandidates(); }
}

function openPromote(id) {
    const c = _ncCandidates.find(x => x.id === id);
    if (!c) return;
    const modal = document.getElementById('promote-modal');
    modal.dataset.name = c.name;
    document.getElementById('promote-name').textContent = c.name;
    document.getElementById('promote-order-id').value = '';
    const _rawAccounts = (window.settingsData && window.settingsData.accounts) || [];
    const _seenCodes = new Set();
    const accounts = _rawAccounts.filter(a => {
        const k = (a.code || '').trim().toUpperCase();
        if (_seenCodes.has(k)) return false;
        _seenCodes.add(k); return true;
    });
    document.getElementById('promote-roc-account').innerHTML =
        accounts.map(a => `<option value="${escapeHtml(a.code)}">${escapeHtml(a.code)}${a.username ? ' - ' + escapeHtml(a.username) : ''}</option>`).join('')
        || `<option value="">No accounts configured</option>`;
    modal.classList.add('active');
}

function closePromote() {
    document.getElementById('promote-modal').classList.remove('active');
}

async function submitPromote() {
    const modal = document.getElementById('promote-modal');
    const order_id = (document.getElementById('promote-order-id').value || '').trim();
    if (!order_id) { showToast('Enter the ROC order number', 'warning'); return; }
    const r = await api('/queue/add-manual', 'POST', {
        order_id,
        company_name: modal.dataset.name || '',
        service_type: 'name_approval',
        roc_account: document.getElementById('promote-roc-account').value || '',
    });
    if (r && r.success) { showToast(`Tracking order ${r.order_id}`, 'success'); closePromote(); }
}

// ── confetti + toast ──
function ncCelebrate() {
    const wrap = _el('nc-confetti'); if (!wrap) return;
    wrap.innerHTML = '';
    const colors = ['var(--accent-success)', 'var(--green10)', 'var(--accent-primary)', 'var(--amber9)', 'var(--text-primary)'];
    for (let i = 0; i < 26; i++) {
        const p = document.createElement('i');
        p.style.background = colors[i % colors.length];
        p.style.left = (50 + (Math.random() * 40 - 20)) + '%';
        p.style.top = '40%';
        wrap.appendChild(p);
        const dx = (Math.random() * 2 - 1) * 180, dy = -(80 + Math.random() * 150), rot = Math.random() * 720 - 360;
        p.animate([
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
            { transform: `translate(${dx * 1.2}px, ${dy + 240}px) rotate(${rot * 1.4}deg)`, opacity: 0 },
        ], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(0.18,0.7,0.3,1)' });
    }
    clearTimeout(ncCelebrate._t);
    ncCelebrate._t = setTimeout(() => { wrap.innerHTML = ''; }, 2100);
}

let _ncToastTimer = null;
function ncToast(msg) {
    const t = _el('nc-toast'); if (!t) return;
    _el('nc-toast-msg').textContent = msg;
    t.classList.add('show'); clearTimeout(_ncToastTimer); _ncToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

(function initNameCheck() {
    const input = _el('nc-input');
    if (!input) return;
    input.addEventListener('input', ncOnInput);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(_ncTimer); runNameCheck(); } });
    _el('nc-consent-input').addEventListener('change', () => { if ((_el('nc-input').value || '').trim()) { clearTimeout(_ncTimer); runNameCheck(); } });
    _el('nc-hero-cta').addEventListener('click', saveCurrentName);
    ncRenderCore(); ncResetIdle(); loadNameCandidates(); _ncIcons();
    // restore last query text across reloads (prefill only - no auto registry traffic on launch)
    try {
        const lastQ = JSON.parse(localStorage.getItem('nc-last') || 'null');
        if (lastQ && lastQ.name) { input.value = lastQ.name; const cons = _el('nc-consent-input'); if (cons) cons.checked = !!lastQ.consent; ncRenderCore(); }
    } catch (e) {}
})();
