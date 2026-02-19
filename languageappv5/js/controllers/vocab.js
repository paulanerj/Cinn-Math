/* ============================================================
   vocab.js — LinguaPlay Phase A
   Saves vocab entries to IndexedDB, renders list, exports JSON.

   Event contract:
     Listen: vocab:save  detail: { type, text, context, timestamp }
   Global function: initVocab
   ============================================================ */
(function () {
  'use strict';

  function initVocab() {
    var listEl    = document.getElementById('vocab-list');
    var countEl   = document.getElementById('vocab-count');
    var btnExport = document.getElementById('btn-export-vocab');

    if (!listEl || !countEl || !btnExport) {
      throw new Error('vocab: required elements not found');
    }

    /* Load existing entries on boot */
    loadAndRender();

    /* Listen for save events */
    Bus.on('vocab:save', function (detail) {
      if (!detail || typeof detail !== 'object') {
        Logger.warn('vocab', 'vocab:save — invalid detail ignored:', detail);
        return;
      }
      var type      = String(detail.type      || 'word');
      var text      = String(detail.text      || '').trim();
      var context   = String(detail.context   || '').trim();
      var timestamp = String(detail.timestamp || Utils.nowISO());

      if (!text) {
        Logger.warn('vocab', 'vocab:save — empty text, skipped');
        return;
      }

      var entry = { type: type, text: text, context: context, timestamp: timestamp };

      DB.addVocab(entry).then(function (id) {
        Logger.info('vocab', 'saved:', type, text, '(id=' + id + ')');
        loadAndRender();
        /* Switch to vocab tab so user sees the result */
        Bus.emit('tab:switch', 'vocab');
      }).catch(function (err) {
        Logger.warn('vocab', 'DB save failed (non-fatal):', err && err.message || err);
        /* Still show the entry in memory even if DB fails */
        appendEntryToList(listEl, entry);
        updateCount();
      });
    });

    /* Export JSON */
    btnExport.addEventListener('click', function () {
      DB.getAllVocab().then(function (entries) {
        exportJSON(entries);
      }).catch(function (err) {
        Logger.warn('vocab', 'export DB read failed:', err && err.message || err);
      });
    });
  }

  /* ---- Load all entries from DB and re-render ---- */
  function loadAndRender() {
    var listEl  = document.getElementById('vocab-list');
    var countEl = document.getElementById('vocab-count');
    if (!listEl) return;

    DB.getAllVocab().then(function (entries) {
      renderList(listEl, entries);
      if (countEl) countEl.textContent = entries.length + ' ' + (entries.length === 1 ? 'entry' : 'entries');
    }).catch(function (err) {
      Logger.warn('vocab', 'loadAndRender DB read failed:', err && err.message || err);
    });
  }

  /* ---- Render full list ---- */
  function renderList(listEl, entries) {
    listEl.innerHTML = '';
    if (!entries || entries.length === 0) {
      listEl.innerHTML = '<p class="vocab-empty">No vocab saved yet.</p>';
      return;
    }
    entries.forEach(function (entry) {
      appendEntryToList(listEl, entry);
    });
  }

  /* ---- Append a single entry ---- */
  function appendEntryToList(listEl, entry) {
    var div = document.createElement('div');
    div.className = 'vocab-entry';

    var wordEl = document.createElement('div');
    wordEl.className = 've-word';
    wordEl.textContent = entry.text;

    var typeEl = document.createElement('div');
    typeEl.className = 've-type';
    typeEl.textContent = entry.type;

    div.appendChild(wordEl);
    div.appendChild(typeEl);

    if (entry.context && entry.context !== entry.text) {
      var ctxEl = document.createElement('div');
      ctxEl.className = 've-context';
      ctxEl.textContent = entry.context;
      div.appendChild(ctxEl);
    }

    listEl.appendChild(div);
  }

  /* ---- Update count display ---- */
  function updateCount() {
    var countEl = document.getElementById('vocab-count');
    var listEl  = document.getElementById('vocab-list');
    if (!countEl || !listEl) return;
    var n = listEl.querySelectorAll('.vocab-entry').length;
    countEl.textContent = n + ' ' + (n === 1 ? 'entry' : 'entries');
  }

  /* ---- Export entries as JSON download ---- */
  function exportJSON(entries) {
    if (!entries || entries.length === 0) {
      Logger.warn('vocab', 'export: nothing to export');
      return;
    }
    var json = JSON.stringify(entries, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'linguaplay-vocab.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
    Logger.info('vocab', 'exported', entries.length, 'entries');
  }

  window.initVocab = initVocab;

}());
