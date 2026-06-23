// ═══════════════════════════════════════════════════════════════════════
// FIRST-RUN ONBOARDING TOUR — spotlight walkthrough over the live UI.
// Loaded after app.js and uses its globals at call time (switchSection,
// switchSettingsPanel, switchSegment, currentSection, showToast). The
// seen-flag lives SERVER-side (settings.onboarding_completed) because
// localStorage doesn't persist under pywebview's private-mode WebView.
//
// Positioning is body-zoom aware: getBoundingClientRect() returns visual
// (post-zoom) px while position:fixed children of <body> lay out in zoomed
// CSS px, so every rect coordinate is divided by the zoom factor — the same
// compensation app.js uses in updatePillIndicator().
//
// Choreography per step: popover fades out → spotlight glides (same section)
// or fades across the View Transition (section change) → a short beat →
// popover fades back in. The dim layer itself is the highlight box's giant
// box-shadow, so the spotlight and the dim move as one. A step may carry a
// `segment` (orders subsection) and a `target` of one OR several selectors
// (the spotlight covers their union, e.g. switcher + table together).
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const STEPS = [
        {
            section: 'dashboard', target: null,
            title: 'Welcome to PandaRoc',
            body: 'PandaRoc watches the Cyprus Registrar of Companies (ROC) for you. It finds your pending orders and downloads certificates the moment they\'re ready. Here\'s a quick tour of how it all fits together.',
        },
        {
            section: 'dashboard', target: '.stats-hero',
            title: 'Your workspace at a glance',
            body: 'These counters track every order PandaRoc knows about: waiting for your decision, accepted and being watched, or completed and saved to disk. Click any card to jump straight to that list.',
        },
        {
            section: 'dashboard', target: '#agent-b-card',
            title: 'The Finder',
            body: 'The Finder logs into your ROC accounts on a schedule and scans the pending-services list (Εκκρεμείς). Anything new lands in your Pending queue automatically, so you never have to check the portal by hand.',
        },
        {
            section: 'dashboard', target: '#agent-a-card',
            title: 'The Downloader',
            body: 'Once you accept an order, the Downloader keeps watching it and downloads the certificates as soon as ROC generates them, filing the PDFs straight into your download folder.',
        },
        {
            section: 'orders', segment: 'ekkremis', target: ['.segment-switcher', '#subsection-ekkremis'],
            title: 'Pending: you decide',
            body: 'Everything the Finder discovers lands here first. Accept an order to let PandaRoc handle it, or reject the ones you don\'t want. Accepted orders move to the next list.',
        },
        {
            section: 'orders', segment: 'ready', target: ['.segment-switcher', '#subsection-ready'],
            title: 'Accepted: PandaRoc takes over',
            body: 'Your accepted orders wait here while the Downloader watches them. The badge on each row shows how many of its documents are ready so far.',
        },
        {
            section: 'orders', segment: 'completed', target: ['.segment-switcher', '#subsection-completed'],
            title: 'Completed: done and saved',
            body: 'When every certificate is downloaded, the order finishes here with its PDFs saved in your download folder. That\'s the whole journey: found, accepted, downloaded.',
        },
        {
            section: 'approvals', target: '.nc-composer',
            title: 'Name Check',
            body: 'Registering a new company? Type the proposed name here and PandaRoc estimates how likely the Registrar is to approve it, based on the naming rules and a live search of the registry.',
        },
        {
            section: 'settings', panel: 'accounts', target: '#accounts-table',
            title: 'Add your first ROC account',
            body: 'PandaRoc needs at least one ROC eFiling account to work with. Add your username and password here. They\'re stored encrypted on this computer and never leave it. That\'s everything. You\'re ready to go.',
        },
    ];

    const GLIDE_MS = 900;       // spotlight glide between same-section targets
    const FADE_MS = 400;        // spotlight fade across section switches
    const POP_MS = 400;         // popover fade in/out
    const BEAT_MS = 150;        // pause after the spotlight settles, before the popover

    let _active = false;
    let _busy = false;          // a step transition is in flight (ignore next/back)
    let _stepIndex = 0;
    let _overlay = null, _hl = null, _pop = null;
    let _rafId = 0;
    let _lastBox = null;        // last positioned target box, for the watch loop
    let _animUntil = 0;         // while gliding, the watch loop defers to the CSS transition

    const _wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const _frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const _reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    function _zoom() {
        return parseFloat(document.body.style.zoom) || 1;
    }

    // Union box of all the step's target selectors, in zoom-compensated px.
    // Returns null when no target (welcome step) or nothing matched.
    function _targetBox(step, z) {
        if (!step.target) return null;
        const sels = Array.isArray(step.target) ? step.target : [step.target];
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, found = false;
        for (const sel of sels) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            if (!rect.width && !rect.height) continue;   // hidden (inactive subsection)
            found = true;
            l = Math.min(l, rect.left);
            t = Math.min(t, rect.top);
            r = Math.max(r, rect.right);
            b = Math.max(b, rect.bottom);
        }
        return found ? [l / z, t / z, (r - l) / z, (b - t) / z] : null;
    }

    function _buildDom() {
        _overlay = document.createElement('div');
        _overlay.id = 'tour-overlay';
        _hl = document.createElement('div');
        _hl.id = 'tour-highlight';
        _pop = document.createElement('div');
        _pop.id = 'tour-popover';
        _pop.setAttribute('role', 'dialog');
        _pop.setAttribute('aria-label', 'PandaRoc tour');
        document.body.appendChild(_overlay);
        document.body.appendChild(_hl);
        document.body.appendChild(_pop);
    }

    function _renderPopover(step, i) {
        const last = i === STEPS.length - 1;
        _pop.innerHTML = `
            <div class="tour-popover__step">${i + 1} of ${STEPS.length}</div>
            <div class="tour-popover__title">${step.title}</div>
            <div class="tour-popover__body">${step.body}</div>
            <div class="tour-popover__actions">
                ${last ? '' : '<button class="btn btn-sm btn-ghost" id="tour-skip">Skip tour</button>'}
                <span class="tour-popover__spacer"></span>
                ${i > 0 ? '<button class="btn btn-sm btn-ghost" id="tour-back">&larr; Back</button>' : ''}
                <button class="btn btn-sm btn-primary" id="tour-next">${last ? 'Finish' : 'Next &rarr;'}</button>
            </div>`;
        const skip = _pop.querySelector('#tour-skip');
        const back = _pop.querySelector('#tour-back');
        if (skip) skip.addEventListener('click', () => _end('skip'));
        if (back) back.addEventListener('click', _back);
        _pop.querySelector('#tour-next').addEventListener('click', _next);
    }

    // Position highlight + popover for a step. All coordinates are divided by the
    // body zoom factor so fixed-layer px line up with the visual-px rects.
    // movePopover=false lets the watch loop fine-tune the highlight on small
    // reflows without yanking the popover (and its buttons) out from under a
    // click mid-read.
    function _position(step, glide, movePopover = true) {
        const z = _zoom();
        const vw = window.innerWidth / z;
        const vh = window.innerHeight / z;
        const pad = 12;
        const box = _targetBox(step, z);

        _hl.classList.toggle('tour-animate', !!glide && !_reduceMotion());
        _hl.classList.toggle('tour-borderless', !box);

        let t;
        if (box) {
            _lastBox = box;
            t = { left: box[0] - pad, top: box[1] - pad, w: box[2] + pad * 2, h: box[3] + pad * 2 };
        } else {
            _lastBox = null;
            t = { left: vw / 2, top: vh / 2, w: 0, h: 0 };   // welcome: dim everything
        }
        _hl.style.left = t.left + 'px';
        _hl.style.top = t.top + 'px';
        _hl.style.width = t.w + 'px';
        _hl.style.height = t.h + 'px';

        if (!movePopover) return;

        // Popover: measure (it lays out even while faded out). Placement works on
        // the VISIBLE part of the target (a long table's spotlight runs past the
        // viewport): below → above → right → inside the spotlight near its bottom
        // → centered over the dim.
        const pw = _pop.offsetWidth, ph = _pop.offsetHeight;
        const gap = 16;
        let px, py;
        if (!box) {
            px = (vw - pw) / 2;
            py = (vh - ph) / 2;
        } else {
            const cT = Math.max(t.top, 8);                   // visible box bounds
            const cB = Math.min(t.top + t.h, vh - 8);
            const cL = Math.max(t.left, 8);
            const cR = Math.min(t.left + t.w, vw - 8);
            if (cB + gap + ph <= vh - 12) {                  // below
                py = cB + gap;
                px = (cL + cR) / 2 - pw / 2;
            } else if (cT - gap - ph >= 12) {                // above
                py = cT - gap - ph;
                px = (cL + cR) / 2 - pw / 2;
            } else if (cR + gap + pw <= vw - 12) {           // right
                px = cR + gap;
                py = (cT + cB) / 2 - ph / 2;
            } else if (cB - cT > ph + 48) {                  // inside, near the bottom
                py = cB - ph - 16;
                px = (cL + cR) / 2 - pw / 2;
            } else {                                         // centered over the dim
                px = (vw - pw) / 2;
                py = (vh - ph) / 2;
            }
        }
        _pop.style.left = Math.max(12, Math.min(px, vw - pw - 12)) + 'px';
        _pop.style.top = Math.max(12, Math.min(py, vh - ph - 12)) + 'px';
    }

    // Re-read the target rect every frame and reposition when it moved — absorbs
    // table refresh reflows, window resizes, scrolling and live zoom changes.
    // Small wiggles (auto-refresh re-rendering a table) adjust the highlight only;
    // the popover relocates just for meaningful moves, so its buttons stay put.
    function _watch() {
        if (!_active) return;
        const step = STEPS[_stepIndex];
        if (step && step.target && !_busy && Date.now() > _animUntil) {
            const cur = _targetBox(step, _zoom());
            if (cur && _lastBox) {
                const delta = Math.max(...cur.map((v, i) => Math.abs(v - _lastBox[i])));
                if (delta > 0.5) _position(step, false, delta > 16);
            }
        }
        _rafId = requestAnimationFrame(_watch);
    }

    async function _showStep(i, firstShow) {
        _busy = true;
        _stepIndex = i;
        const step = STEPS[i];
        const reduce = _reduceMotion();
        const sectionChanging = typeof currentSection !== 'undefined' && currentSection !== step.section;

        // 1. Popover slips away while the scene changes.
        _pop.classList.remove('open');
        if (!firstShow && !reduce) await _wait(POP_MS * 0.65);

        try {
            if (sectionChanging && typeof switchSection === 'function') {
                // The spotlight must not ride the section slide: fade it out, let the
                // View Transition run clean, then fade back in over the new target.
                _hl.classList.add('tour-faded');
                await (switchSection(step.section) || Promise.resolve());
            }
            if (step.panel && typeof switchSettingsPanel === 'function') {
                switchSettingsPanel(step.panel);
            }
            if (step.segment && typeof switchSegment === 'function') {
                switchSegment(step.segment);
            }
            // Scroll only when the anchor is actually out of view (avoids needless
            // jumps; after a section switch the page is already at the top).
            const sel = Array.isArray(step.target) ? step.target[0] : step.target;
            const el = sel ? document.querySelector(sel) : null;
            if (el) {
                const r = el.getBoundingClientRect();
                if (r.top < 0 || r.bottom > window.innerHeight) {
                    el.scrollIntoView({ block: 'center', behavior: 'instant' });
                }
            }
        } catch (_) { /* a failed switch must never strand the tour */ }

        // Let layout settle (swap, panel/segment switch, scroll) before measuring.
        await _frame();
        if (!_active) return;

        _renderPopover(step, i);

        // 2. Spotlight moves: glide within a section, fade across a section change.
        if (sectionChanging || firstShow) {
            _position(step, false);                  // place instantly while invisible
            await _frame();
            _hl.classList.remove('tour-faded');      // fade in over the new target
            _animUntil = Date.now() + FADE_MS;
            if (!reduce) await _wait(FADE_MS + BEAT_MS);
        } else {
            _animUntil = Date.now() + GLIDE_MS + 80;
            _position(step, true);                   // glide to the new target
            if (!reduce) await _wait(GLIDE_MS + BEAT_MS); // land fully, breathe, then speak
        }
        if (!_active) return;

        // 3. Popover settles in.
        _pop.classList.add('open');
        const nextBtn = _pop.querySelector('#tour-next');
        if (nextBtn) nextBtn.focus({ preventScroll: true });
        _busy = false;
    }

    function _next() {
        if (_busy) return;
        if (_stepIndex >= STEPS.length - 1) _end('finish');
        else _showStep(_stepIndex + 1);
    }

    function _back() {
        if (_busy || _stepIndex === 0) return;
        _showStep(_stepIndex - 1);
    }

    function _onKeydown(e) {
        if (!_active) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();                   // the .dlg Esc handler must never see this
            _end('skip');
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            _next();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            _back();
        } else if (e.key === 'Enter') {
            // Let a focused Skip/Back button activate natively; bare Enter advances.
            const a = document.activeElement;
            if (_pop.contains(a) && a.id !== 'tour-next') return;
            e.preventDefault();
            e.stopPropagation();
            _next();
        }
    }

    function _onResize() {
        if (_active && !_busy) _position(STEPS[_stepIndex], false);
    }

    function _end(reason) {
        if (!_active) return;
        _active = false;
        _busy = false;
        cancelAnimationFrame(_rafId);
        window.removeEventListener('keydown', _onKeydown, true);
        window.removeEventListener('resize', _onResize);

        // Fade the dim + popover away, then drop the nodes.
        const overlay = _overlay, hl = _hl, pop = _pop;
        _overlay = _hl = _pop = null;
        pop.classList.remove('open');
        hl.classList.add('tour-faded');
        setTimeout(() => { overlay.remove(); hl.remove(); pop.remove(); }, FADE_MS + 60);

        // Finish AND skip both count as seen; the tour never auto-fires twice.
        if (window.settingsData) window.settingsData.onboarding_completed = true;
        fetch('/api/settings/onboarding-completed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ onboarding_completed: true }),
        }).catch(() => {});

        if (reason === 'finish' && typeof showToast === 'function') {
            showToast("You're all set. Add a ROC account to begin.", 'success');
        }
    }

    // Entry point. isReplay=true (Settings > Help) bypasses the seen-flag check
    // and never clears it; replaying is free, the flag only gates auto-fire.
    function startOnboardingTour(isReplay) {
        if (_active) return;
        const lock = document.getElementById('lock-screen');
        if (lock && getComputedStyle(lock).display !== 'none') return;
        if (!isReplay && !(window.settingsData && window.settingsData.onboarding_completed === false)) return;

        _active = true;
        _buildDom();
        _hl.classList.add('tour-faded');           // born invisible: the dim fades IN on start
        window.addEventListener('keydown', _onKeydown, true);
        window.addEventListener('resize', _onResize);
        _rafId = requestAnimationFrame(_watch);
        _showStep(0, true);
    }

    window.startOnboardingTour = startOnboardingTour;
})();
