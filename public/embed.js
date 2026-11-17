/* Lotwise embed loader. Usage:
   <div data-lotwise="eoq" data-mode="business" data-theme="dark" data-accent="8e9bff"></div>
   <script async src="https://lotwise.io/embed.js"></script> */
(function () {
  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); for (var i = s.length - 1; i >= 0; i--) if (/\/embed\.js(\?|$)/.test(s[i].src)) return s[i]; })();
  var origin = script && script.src ? new URL(script.src).origin : 'https://lotwise.io';
  var frames = [];
  function mount(el) {
    if (el.getAttribute('data-lotwise-ready')) return;
    var calc = el.getAttribute('data-lotwise'); if (!calc || !/^[a-z0-9-]+$/.test(calc)) return;
    var q = [];
    var mode = el.getAttribute('data-mode'); if (mode === 'learner' || mode === 'business') q.push('mode=' + mode);
    var theme = el.getAttribute('data-theme'); if (theme === 'light' || theme === 'dark') q.push('theme=' + theme);
    var accent = (el.getAttribute('data-accent') || '').replace('#', ''); if (/^[0-9a-fA-F]{6}$/.test(accent)) q.push('accent=' + accent);
    var f = document.createElement('iframe');
    f.src = origin + '/embed/' + calc + (q.length ? '?' + q.join('&') : '');
    f.title = 'Lotwise calculator: ' + calc; f.loading = 'lazy'; f.setAttribute('scrolling', 'no');
    f.style.cssText = 'width:100%;max-width:760px;border:0;border-radius:14px;display:block;height:' + (parseInt(el.getAttribute('data-height'), 10) || 640) + 'px';
    el.appendChild(f); el.setAttribute('data-lotwise-ready', '1'); frames.push(f);
  }
  function scan() { var els = document.querySelectorAll('[data-lotwise]'); for (var i = 0; i < els.length; i++) mount(els[i]); }
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.lotwise !== 'resize') return;
    for (var i = 0; i < frames.length; i++) if (frames[i].contentWindow === e.source) frames[i].style.height = Math.max(240, Math.min(6000, Number(e.data.height) || 0)) + 'px';
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  window.Lotwise = { scan: scan };
})();
