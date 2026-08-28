// Event delegation for what used to be inline onclick=/oninput= attributes.
//
// CSP treats an inline handler as inline script: with 37 of them across the site,
// script-src would have needed 'unsafe-inline', which is exactly the directive
// that stops a CSP from containing XSS. One delegated listener is also less code
// than 37 addEventListener blocks plus the IDs they would have needed.
//
// Markup contract:  data-action="fnName" data-args="1,true"
// The name is resolved against window, so the handler stays an ordinary global
// function in the page's own script — same functions, same behaviour, just bound
// from here instead of from an attribute.
//
// `this` inside a handler is the CLICKED ELEMENT. An inline onclick could read
// the implicit global `event` to find its own button; under delegation that
// resolves to `document` (the node the listener is on), so any handler needing
// its button must use `this`.
(function () {
  // Only literals appear in data-args (numbers, booleans, short strings) — the
  // one call that needed a live DOM read passes a selector instead, below.
  function parseArgs(raw) {
    if (!raw) return [];
    return raw.split(',').map(function (a) {
      a = a.trim();
      if (a === 'true') return true;
      if (a === 'false') return false;
      if (a !== '' && !isNaN(a)) return Number(a);
      return a;
    });
  }

  function run(el, event) {
    var name = el.getAttribute('data-action');
    var fn = window[name];
    if (typeof fn !== 'function') {
      console.error('[actions] no such handler:', name);
      return;
    }
    var args = parseArgs(el.getAttribute('data-args'));
    // data-arg-from="#id" reads that input's current value as the first argument
    // (the quantity boxes, which must be read at click time, not at page load).
    var from = el.getAttribute('data-arg-from');
    if (from) {
      var src = document.querySelector(from);
      args.unshift(src ? src.value : '');
    }
    if (el.hasAttribute('data-arg-value')) args.unshift(el.value);
    if (el.hasAttribute('data-arg-self')) args.push(el);
    var result = fn.apply(el, args);  // `this` === the clicked element
    if (el.hasAttribute('data-prevent')) event.preventDefault();
    return result;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el) run(el, e);
  });

  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-input-action]');
    if (!el) return;
    var fn = window[el.getAttribute('data-input-action')];
    if (typeof fn === 'function') fn(el.value);
  });

  // The nav hamburger is on every page and needs no page-specific function.
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-nav-toggle]')) {
      document.querySelector('.nav-links').classList.toggle('open');
    }
  });
})();
