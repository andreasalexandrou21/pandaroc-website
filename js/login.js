// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

const API = 'https://api.pandaroc.com';

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });

function togglePw(id, btn){
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 4.3-1.1"/><path d="m2 2 20 20"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  if (window.lucide) lucide.createIcons();
}

// textContent, not innerHTML. Every backend `detail` is a static literal
// today, so this is not exploitable — but the sink sits on the page where
// the password is typed, and it only takes one error message that
// interpolates user input to turn it into reflected XSS.
function showError(msg){
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  document.getElementById('loginError').style.display = 'none';
  btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Logging in...';
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.detail || 'Invalid email or password.');
      btn.disabled = false; btn.textContent = btn.dataset.label;
      return;
    }
    saveTokens(data);
    window.location.href = 'account.html';
  } catch (err) {
    showError('Could not reach the server. Please try again.');
    btn.disabled = false; btn.textContent = btn.dataset.label;
  }
});
