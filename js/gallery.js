/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   The gallery's enlarge view: a click on a picture opens it in a native dialog; the left and right arrow keys (or the buttons)
   move between pictures, Escape or the Close button shuts it, and focus goes back to the picture that was opened.
   Classic script, local files only, no storage, no network requests. */
(function () {
  'use strict';

  var thumbs = document.querySelectorAll('.gl-thumb');
  var dlg = document.getElementById('gl-box');
  if (!dlg || !thumbs.length) return;

  var img = document.getElementById('gl-img');
  var cap = document.getElementById('gl-cap');
  var count = document.getElementById('gl-count');
  var n = thumbs.length;
  var idx = 0;
  var opener = null;

  function show(i) {
    idx = (i + n) % n;
    var t = thumbs[idx];
    img.src = t.getAttribute('data-full');
    img.alt = t.getAttribute('data-caption');
    cap.textContent = t.getAttribute('data-caption');
    count.textContent = 'Picture ' + (idx + 1) + ' of ' + n;
  }

  function open(i) {
    opener = thumbs[i];
    show(i);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function close() {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  Array.prototype.forEach.call(thumbs, function (t, i) {
    t.addEventListener('click', function () { open(i); });
  });

  document.getElementById('gl-prev').addEventListener('click', function () { show(idx - 1); });
  document.getElementById('gl-next').addEventListener('click', function () { show(idx + 1); });
  document.getElementById('gl-close').addEventListener('click', close);

  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
  });

  // a click on the dark area around the box closes it
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

  dlg.addEventListener('close', function () {
    img.removeAttribute('src');
    if (opener) opener.focus();
  });
})();
