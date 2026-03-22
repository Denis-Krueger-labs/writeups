/**
 * Spotify "Now Playing" widget — Lanyard Discord presence API
 * Polls every 30s; updates progress bar every 1s while playing.
 */
(function () {
  'use strict';

  var widget     = document.getElementById('spotifyWidget');
  if (!widget) return;

  var USER_ID    = widget.dataset.userId;
  if (!USER_ID) return;

  var songEl     = document.getElementById('sw-song');
  var artistEl   = document.getElementById('sw-artist');
  var statusEl   = document.getElementById('sw-status');
  var progressEl = document.getElementById('sw-progress');

  function pad(n) { return n < 10 ? '0' + n : n; }

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }

  function buildBar(start, end) {
    var now     = Date.now();
    var elapsed = Math.max(0, now - start);
    var total   = end - start;
    var pct     = Math.min(100, Math.round((elapsed / total) * 100));
    var filled  = Math.round(pct / 5);
    var empty   = 20 - filled;
    return '▶ ' + '█'.repeat(filled) + '░'.repeat(empty) + ' ' + fmt(elapsed) + ' / ' + fmt(total);
  }

  var currentSpotify = null;
  var barInterval    = null;

  function updateBar() {
    if (!currentSpotify) return;
    progressEl.textContent = buildBar(
      currentSpotify.timestamps.start,
      currentSpotify.timestamps.end
    );
  }

  function trunc(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function render(data) {
    if (data.listening_to_spotify && data.spotify) {
      var sp = data.spotify;
      currentSpotify = sp;
      songEl.textContent   = trunc(sp.song, 28);
      artistEl.textContent = trunc(sp.artist, 28);
      statusEl.textContent = '> spotify';
      widget.classList.remove('sw-idle');
      if (barInterval) clearInterval(barInterval);
      barInterval = setInterval(updateBar, 1000);
      updateBar();
    } else {
      currentSpotify = null;
      if (barInterval) { clearInterval(barInterval); barInterval = null; }
      songEl.textContent     = '—';
      artistEl.textContent   = '';
      statusEl.textContent   = '> idle';
      progressEl.textContent = '';
      widget.classList.add('sw-idle');
    }
  }

  function poll() {
    fetch('https://api.lanyard.rest/v1/users/' + USER_ID)
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.success) render(j.data); })
      .catch(function () {});
  }

  poll();
  setInterval(poll, 30000);
}());
