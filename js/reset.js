// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

const API = 'https://api.pandaroc.com';
const token = new URLSearchParams(location.search).get('token');
function $(id){ return document.getElementById(id); }
function showError(id, msg){ const e = $(id); e.textContent = msg; e.style.display = 'block'; }
function togglePw(){ const i = $('password'); i.type = i.type === 'password' ? 'text' : 'password'; }
function showDone(title, msg){ $('requestMode').style.display = 'none'; $('resetMode').style.display = 'none'; $('doneTitle').textContent = title; $('doneMsg').textContent = msg; $('doneMode').style.display = ''; }

if (token){ $('requestMode').style.display = 'none'; $('resetMode').style.display = ''; }

$('requestForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('reqError').style.display = 'none';
  const btn = $('reqBtn'); btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Sending...';
  try {
    const res = await fetch(API + '/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('email').value.trim() }) });
    const d = await res.json().catch(() => ({}));
    // Always the same outcome — we never reveal whether the email is registered.
    showDone('Check your inbox', (d.detail || 'If that email is registered, a reset link is on its way.') + ' The link expires in 1 hour.');
  } catch (_){
    btn.disabled = false; btn.textContent = orig;
    showError('reqError', 'Could not reach the server. Please try again.');
  }
});

$('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('resError').style.display = 'none';
  const pw = $('password').value;
  if (pw.length < 8){ showError('resError', 'Password must be at least 8 characters.'); return; }
  const btn = $('resBtn'); btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Updating...';
  try {
    const res = await fetch(API + '/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: pw }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok){ showDone('Password updated', 'You can now log in with your new password.'); }
    else { btn.disabled = false; btn.textContent = orig; showError('resError', d.detail || 'Could not reset your password.'); }
  } catch (_){
    btn.disabled = false; btn.textContent = orig;
    showError('resError', 'Could not reach the server. Please try again.');
  }
});
