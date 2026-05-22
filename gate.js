(function() {
  if (sessionStorage.getItem('pandaroc_gate') === '1') return;

  document.documentElement.style.visibility = 'hidden';

  var HASH = '98a0a99c424bbc4698a67ed481aee7e6818dabf4ed7bf109d152a54d0fbdf06b';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  async function sha256(str) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  ready(function() {
    var overlay = document.createElement('div');
    overlay.id = 'gate-overlay';
    overlay.innerHTML =
      '<div style="background:var(--bg-card,#1f1d18);border:1px solid var(--border,#33312b);border-radius:14px;padding:40px 36px;max-width:360px;width:100%;text-align:center;">' +
        '<div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;margin-bottom:6px;">' +
          '<span style="color:var(--accent,#d07859);">Panda</span>Roc' +
        '</div>' +
        '<p style="color:var(--muted,#a09c98);font-size:13px;margin-bottom:24px;">Enter the password to continue.</p>' +
        '<input id="gate-input" type="password" placeholder="Password" style="width:100%;padding:10px 12px;background:var(--bg-elev,#2a2823);border:1px solid var(--border,#33312b);border-radius:8px;color:var(--text,#f0ece7);font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;" />' +
        '<button id="gate-btn" style="display:block;width:100%;padding:12px;background:var(--accent,#d07859);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Enter</button>' +
        '<p id="gate-error" style="color:#ef4444;font-size:12px;margin-top:8px;display:none;">Wrong password</p>' +
      '</div>';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:var(--bg-base,#16140f);padding:24px;';

    document.body.appendChild(overlay);
    document.documentElement.style.visibility = 'visible';

    var input = document.getElementById('gate-input');
    var btn = document.getElementById('gate-btn');
    var err = document.getElementById('gate-error');

    async function attempt() {
      var val = input.value;
      if (!val) return;
      var h = await sha256(val);
      if (h === HASH) {
        sessionStorage.setItem('pandaroc_gate', '1');
        overlay.remove();
      } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') attempt();
    });

    input.focus();
  });
})();
