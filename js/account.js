// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

// Slot-count to published tier (mirrors the pricing tiers on index.html).
const TIERS = { 1:'Starter', 5:'Small Firm', 10:'Professional', 20:'Firm' };

function $(id){ return document.getElementById(id); }
function show(id){ const el=$(id); if(el) el.style.display=''; }
function hide(id){ const el=$(id); if(el) el.style.display='none'; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function statusLabel(s){
  return { active:'Active', trial:'Trial', trialing:'Trial', past_due:'Past due', expired:'Expired', canceled:'Cancelled', none:'None' }[s] || 'None';
}
function fmtDate(v){ try { return new Date(v).toLocaleDateString(undefined, { day:'numeric', month:'long', year:'numeric' }); } catch(e){ return ''; } }

async function init(){
  const token = localStorage.getItem('pandaroc_token') || localStorage.getItem('pandaroc_refresh');
  if (!token){ showLoggedOut(); return; }
  try {
    const res = await authFetch('/auth/me');
    if (!res.ok){ clearTokens(); showLoggedOut(); return; }
    renderAccount(await res.json());
  } catch (e){
    hide('loading'); show('error-state');
  }
}

function showLoggedOut(){
  hide('loading'); hide('account-content'); hide('signOutBtn');
  show('login-prompt');
  if (window.lucide) lucide.createIcons();
}

function renderAccount(data){
  hide('loading'); hide('login-prompt'); hide('error-state');
  show('account-content'); show('signOutBtn'); show('dangerCard');

  // Greeting
  const first = (data.name || '').trim().split(/\s+/)[0];
  if (first) $('acctHeading').innerHTML = 'Welcome back, <em>' + escapeHtml(first) + '.</em>';
  else $('acctHeading').textContent = 'Your account';
  $('acctLead').textContent = 'Your subscription, plan and downloads, all in one place.';

  // Account details
  if (first){ $('accHolder').textContent = data.name; show('holderRow'); } else { hide('holderRow'); }
  $('accEmail').textContent = data.email || 'Not set';

  // Email verification prompt (only while unverified)
  _emailVerified = data.email_verified !== false;
  _accountEmail = data.email || 'your address';
  if (!_emailVerified){
    show('verifyBanner');
    // Accounts created before enforcement day are grandfathered server-side
    // (license server EMAIL_VERIFY_ENFORCE_FROM): nothing ever locks for them,
    // so no 24-hour claim, no hero takeover and no poll.
    const enforced = !data.created_at || new Date(data.created_at) >= new Date('2026-07-06T00:00:00Z');
    _verifyEnforced = enforced;
    if (enforced){
      // Verify-first: the hero leads with the deadline; the banner carries the
      // consequence and the resend action (not the same sentence twice).
      $('acctHeading').innerHTML = 'Confirm your <em>email.</em>';
      $('acctLead').textContent = 'We sent a link to ' + _accountEmail + '. Confirm within 24 hours to keep everything unlocked.';
      $('verifyCopy').innerHTML = 'The desktop app locks 24 hours after sign-up until you confirm. Can\'t find the email? Check your spam folder, or resend it below.';
      startVerifyPoll();
    } else {
      // Grandfathered accounts never lock and can still subscribe: plain nudge only.
      $('verifyCopy').innerHTML = 'Please confirm <b>' + escapeHtml(_accountEmail) + '</b>. Use the link we sent, or resend it below.';
    }
  } else {
    hide('verifyBanner');
    stopVerifyPoll();
  }

  // Subscription status
  const status = data.subscription_status || 'none';
  const isTrial = status === 'trial' || status === 'trialing';
  const hasSub  = status === 'active' || status === 'past_due' || isTrial;
  const slots   = data.slot_count | 0;

  const variant = status === 'active' ? '' : isTrial ? 'trial' : status === 'past_due' ? 'pastdue' : status === 'expired' ? 'expired' : 'none';
  const badge = $('subBadge');
  badge.className = 'badge-live ' + variant;
  badge.innerHTML = '<span class="dot"></span>' + statusLabel(status);

  if (hasSub){
    $('planName').textContent = TIERS[slots] || (slots > 0 ? slots + '-account plan' : 'Active plan');
    $('planMeta').innerHTML = slots > 0 ? '<b>' + slots + '</b> ROC account' + (slots !== 1 ? 's' : '') : '';
    show('managePlanBtn'); hide('subscribeBtn');
    show('billingCard'); show('cancelBlock'); show('nameCheckKv');
  } else {
    $('planName').textContent = status === 'expired' ? 'Subscription expired' : 'No active plan';
    $('planMeta').textContent = 'Start with a 7-day free trial';
    hide('managePlanBtn'); show('subscribeBtn');
    hide('billingCard'); hide('cancelBlock'); hide('nameCheckKv');
    // No plan yet (e.g. fresh sign-up): drop the user straight into the picker.
    maybeAutoOpenPlanModal();
  }

  // Trial: end date + time left. Renewal date for paid plans.
  if (isTrial && data.trial_ends_at){
    const daysLeft = Math.max(0, Math.ceil((new Date(data.trial_ends_at) - Date.now()) / 86400000));
    $('trialK').textContent = 'Trial ends';
    $('trialV').textContent = fmtDate(data.trial_ends_at)
      + ' · ' + (daysLeft === 0 ? 'today' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left');
    show('trialKvRow');
  } else if (hasSub && data.current_period_end){
    $('trialK').textContent = 'Renews';
    $('trialV').textContent = fmtDate(data.current_period_end);
    show('trialKvRow');
  } else {
    hide('trialKvRow');
  }

  if (window.lucide) lucide.createIcons();
  revealCards();
}

// ── Email verification (verify-first) ──
let _emailVerified = true;
// Accounts created before the server's enforcement day (2026-07-06) are
// grandfathered: the server never locks them or blocks their checkout.
let _verifyEnforced = true;
let _accountEmail = 'your address';
let _verifyPoll = null;

function promptVerifyFirst(){
  alert('Please confirm your email address first. We sent a link to ' + _accountEmail + '. Once confirmed, you can choose a plan.');
}

// Poll /auth/me every 5s while unverified; restore the normal view once confirmed.
function startVerifyPoll(){
  if (_verifyPoll) return;
  _verifyPoll = setInterval(async () => {
    try {
      const res = await authFetch('/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      if (data.email_verified !== false){ stopVerifyPoll(); renderAccount(data); }
    } catch (e){ /* transient network error: keep polling */ }
  }, 5000);
}
function stopVerifyPoll(){ if (_verifyPoll){ clearInterval(_verifyPoll); _verifyPoll = null; } }

// ── Plan picker ──
let _planModalAutoShown = false;

function openPlanModal(){
  if (!_emailVerified && _verifyEnforced){ promptVerifyFirst(); return; }
  show('planOverlay');
  if (window.lucide) lucide.createIcons();
}
function closePlanModal(){ hide('planOverlay'); }

function maybeAutoOpenPlanModal(){
  // Verify-first: no picker until the email is confirmed (the poll re-runs this after).
  if (_planModalAutoShown || (!_emailVerified && _verifyEnforced)) return;
  _planModalAutoShown = true;
  openPlanModal();
}

async function choosePlan(quantity, trial){
  if (!_emailVerified && _verifyEnforced){ promptVerifyFirst(); return; }
  const qty = Math.max(1, Math.min(20, parseInt(quantity, 10) || 1));
  trial = !!trial;
  try {
    const res = await authFetch('/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: qty,
        trial: trial,
        success_url: window.location.origin + '/success.html' + (trial ? '?trial=1' : ''),
        cancel_url: window.location.origin + '/cancel.html',
      }),
    });
    if (!res.ok){
      if (res.status === 403){ promptVerifyFirst(); return; }
      const err = await res.json().catch(() => ({}));
      alert(err.detail || 'Could not start checkout. Please try again.');
      return;
    }
    const d = await res.json();
    window.location.href = d.checkout_url;
  } catch (e){
    alert('Could not reach the server.');
  }
}

// ── Manage-account popup ──
function openManageModal(){
  show('manageOverlay');
  if (window.lucide) lucide.createIcons();
}
function closeManageModal(){ hide('manageOverlay'); }

document.addEventListener('keydown', (e) => { if (e.key === 'Escape'){ closePlanModal(); closeManageModal(); } });
document.getElementById('planOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePlanModal();
});
document.getElementById('manageOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeManageModal();
});

// Reveal-on-scroll, set up after content is shown (cards start in display:none)
function revealCards(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = document.querySelectorAll('#account-content .reveal');
  if (reduce){ cards.forEach(c => c.classList.add('visible')); return; }
  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  cards.forEach(c => io.observe(c));
}

async function openBillingPortal(flow){
  const btns = [...document.querySelectorAll('.js-portal')];
  btns.forEach(b => b.disabled = true);
  try {
    const opts = { method: 'POST' };
    if (flow){ opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify({ flow }); }
    const res = await authFetch('/stripe/portal', opts);
    if (res.ok){ const d = await res.json(); window.location.href = d.portal_url; return; }
    const err = await res.json().catch(() => ({}));
    alert(err.detail || 'Could not open the billing portal.');
  } catch (e){
    alert('Could not reach the server.');
  }
  btns.forEach(b => b.disabled = false);
}

async function resendVerification(){
  const btn = $('resendVerifyBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  try {
    const res = await authFetch('/auth/resend-verification', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (res.ok){
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>' + escapeHtml(d.detail || 'Verification email sent');
    } else {
      btn.disabled = false; btn.innerHTML = orig;
      alert(d.detail || 'Could not send the verification email.');
    }
  } catch (e){
    btn.disabled = false; btn.innerHTML = orig;
    alert('Could not reach the server.');
  }
}

async function deleteAccount(){
  if (!confirm('Request account deletion? We will email you a confirmation link. Nothing is deleted until you approve it from your inbox.')) return;
  const btn = $('deleteAccountBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/auth/request-deletion', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (res.ok){
      show('deleteRequested');
    } else {
      btn.disabled = false;
      alert(d.detail || 'Could not start the deletion. Please contact support@pandaroc.com.');
    }
  } catch (e){
    btn.disabled = false;
    alert('Could not reach the server.');
  }
}

async function logout(){ await logoutEverywhere(); window.location.href = 'index.html'; }

// Scroll progress bar
const progress = $('scrollProgress');
window.addEventListener('scroll', () => {
  const y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.width = Math.min(100, (y / Math.max(h, 1)) * 100) + '%';
}, { passive: true });

document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => document.querySelector('.nav-links').classList.remove('open')));
document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
init();
