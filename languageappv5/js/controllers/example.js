/* ============================================================
   example.js — LinguaPlay Phase A (stub)
   Shows placeholder example sentences for clicked words.

   Event contract:
     Listen: word:clicked  detail: { word, context }
   Global function: initExample
   ============================================================ */
(function () {
  'use strict';

  /* Stub examples — Phase C will replace with real dictionary lookups */
  var STUB_EXAMPLES = [
    'This is an example sentence using the word.',
    'Here is another sample sentence for context.',
    'The word appears naturally in spoken language.'
  ];

  function initExample() {
    var listEl = document.getElementById('example-list');
    if (!listEl) throw new Error('example: #example-list not found');

    Bus.on('word:clicked', function (detail) {
      if (!detail || typeof detail !== 'object') {
        Logger.warn('example', 'word:clicked — invalid detail ignored:', detail);
        return;
      }
      var word = String(detail.word || '');
      if (!word) return;

      renderExamples(listEl, word);
      Logger.log('example', 'rendered stubs for:', word);
    });
  }

  function renderExamples(listEl, word) {
    listEl.innerHTML = '';

    var header = document.createElement('p');
    header.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:8px;';
    header.textContent = 'Examples for "' + word + '" (stub)';
    listEl.appendChild(header);

    STUB_EXAMPLES.forEach(function (ex, i) {
      var item = document.createElement('div');
      item.className = 'example-item';

      /* Highlight the word in the example text */
      var display = ex.replace(/word/gi, function (m) {
        return '<mark style="background:var(--accent-dim);color:#fff;border-radius:2px;padding:0 2px">' + m + '</mark>';
      });

      item.innerHTML = display;

      var src = document.createElement('div');
      src.className = 'ex-source';
      src.textContent = 'Source: stub example ' + (i + 1);
      item.appendChild(src);

      listEl.appendChild(item);
    });
  }

  window.initExample = initExample;

}());
