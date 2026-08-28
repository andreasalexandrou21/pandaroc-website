// Extracted from the page's inline <script> so the site can ship a real CSP
// (script-src 'self'). Keeping it inline would have needed 'unsafe-inline',
// which is the one directive that makes a CSP stop containing XSS.

const params = new URLSearchParams(window.location.search);
const isTrial = params.get('trial') === '1';
function $(id){ return document.getElementById(id); }

if (isTrial){
  $('success-title').textContent = 'Your trial is live!';
  $('success-msg').textContent = "You have 7 days of full access with 3 ROC accounts, and no charge until your trial ends. After that it continues with 1 account at €29/month, and you can add more anytime from your account. Download the app and log in with your account email.";
} else {
  $('success-title').textContent = 'Payment successful!';
  $('success-msg').textContent = 'Your subscription is active. Download the app and log in with your account email and password to get started.';
}

// Post-payment hand-back: if the desktop app is running locally (and new enough to expose
// the endpoint), re-check its licence and bring its NATIVE window forward. This is a silent
// background fetch, so no localhost tab is ever opened. A closed app, an app not installed,
// or an older build all fall through and leave the download steps in place.
const APP_ORIGIN = 'http://127.0.0.1:8765';

async function handBackToApp(){
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(APP_ORIGIN + '/api/app/activated', { method: 'POST', signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch (_) { return false; }
}

(async () => {
  if (!(await handBackToApp())) return;
  // The app re-checked its licence and raised its own window; guide the user back to it.
  const steps = $('steps-section');
  if (steps) steps.style.display = 'none';
  $('success-msg').textContent = isTrial
    ? "You're all set. We've taken you back to PandaRoc. If it didn't come forward, click Open PandaRoc."
    : "Your subscription is active. We've taken you back to PandaRoc. If it didn't come forward, click Open PandaRoc.";
  const btn = $('download-btn');
  if (btn){
    btn.textContent = 'Open PandaRoc';
    btn.removeAttribute('href');
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', (e) => { e.preventDefault(); handBackToApp(); });
  }
})();
