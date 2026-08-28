// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

const API = 'https://api.pandaroc.com';

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });

// Buyer arriving from a "Buy now" click: reflect immediate checkout, not a trial.
(function () {
  if (localStorage.getItem('pandaroc_pending_trial') === '0') {
    const sub = document.getElementById('regSubhead');
    if (sub) sub.textContent = 'Final step: create your account, then continue to payment.';
    const btn = document.getElementById('registerBtn');
    if (btn) btn.lastChild.textContent = 'Continue to payment';
  }
})();

function togglePw(id, btn){
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 4.3-1.1"/><path d="m2 2 20 20"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  if (window.lucide) lucide.createIcons();
}

function scorePw(v){
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  if (v.length === 0) s = 0;
  const el = document.getElementById('pwStrength');
  const lbl = document.getElementById('pwLabel');
  el.className = 'pw-strength' + (s ? ' s' + s : '');
  lbl.textContent = v.length === 0 ? '' : ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][s];
}

// textContent, not innerHTML. Every backend `detail` is a static literal
// today, so this is not exploitable — but the sink sits on the page where
// the password is typed, and it only takes one error message that
// interpolates user input to turn it into reflected XSS.
function showError(msg){
  const el = document.getElementById('registerError');
  el.textContent = msg;
  el.style.display = 'block';
}

const regBtn = document.getElementById('registerBtn');
function resetRegBtn(label){ regBtn.disabled = false; regBtn.lastChild.textContent = label || 'Create account & start trial'; }

// Shared by email signup and Google signup: start the trial/checkout the buyer intended.
async function continueAfterAuth(accessToken){
  const pendingQty = Math.max(1, Math.min(20, parseInt(localStorage.getItem('pandaroc_pending_qty') || '1', 10)));
  const isTrial = localStorage.getItem('pandaroc_pending_trial') !== '0';
  localStorage.removeItem('pandaroc_pending_qty');
  localStorage.removeItem('pandaroc_pending_trial');
  try {
    const co = await fetch(API + '/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
      body: JSON.stringify({
        quantity: pendingQty,
        trial: isTrial,
        success_url: window.location.origin + '/success.html' + (isTrial ? '?trial=1' : ''),
        cancel_url: window.location.origin + '/cancel.html',
      }),
    });
    if (co.ok) { const cod = await co.json(); window.location.href = cod.checkout_url; return; }
    // A fresh account is unverified, so the server declines checkout (403).
    // Land on the account page, where the verify-first flow takes over.
    if (co.status === 403) { window.location.href = 'account.html'; return; }
    const cerr = await co.json().catch(() => ({}));
    showError((typeof cerr.detail === 'string') ? cerr.detail : 'Account created, but checkout could not start. Open your account to try again.');
    resetRegBtn();
  } catch (e) {
    window.location.href = 'account.html';
  }
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('registerError').style.display = 'none';
  if (!document.querySelector('input[name="terms"]').checked) {
    showError('Please agree to the Terms to continue.');
    return;
  }
  const name = (document.getElementById('firstName').value.trim() + ' ' + document.getElementById('lastName').value.trim()).trim();
  regBtn.disabled = true; regBtn.lastChild.textContent = 'Creating account...';
  try {
    const res = await fetch(API + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError((typeof data.detail === 'string') ? data.detail : 'Please check your details and try again.');
      resetRegBtn();
      return;
    }
    // The server answers identically whether or not the address already has an
    // account (it used to return an explicit 409, which let anyone test a breach
    // list against the customer roster). Tokens come back only for a NEW account;
    // an existing one gets an email instead, so just show the neutral message.
    if (!data.access_token) {
      showError(data.detail || 'Check your inbox to continue.');
      resetRegBtn();
      return;
    }
    saveTokens(data);
    // Only push to Stripe checkout if the user actually came from a Buy / trial CTA.
    // A plain sign-up lands on the styled account page, not Stripe's hosted page.
    if (localStorage.getItem('pandaroc_pending_qty')) {
      const isTrial = localStorage.getItem('pandaroc_pending_trial') !== '0';
      regBtn.lastChild.textContent = isTrial ? 'Starting your trial...' : 'Starting checkout...';
      await continueAfterAuth(data.access_token);
    } else {
      regBtn.lastChild.textContent = 'Account created';
      window.location.href = 'account.html';
    }
  } catch (err) {
    showError('Could not reach the server. Please try again.');
    resetRegBtn();
  }
});
