/* ============================================================
   subtitle.js — LinguaPlay Phase A
   SRT loading, card rendering, word tokenisation, active highlight.

   Event contract:
     Emits:  video:seek    detail: NUMBER (seconds)
             word:clicked  detail: { word, context }
     Listen: video:timeupdate  detail: NUMBER (seconds)
   Global function: initSubtitle
   ============================================================ */
(function () {
  'use strict';

  var subtitles = []; // Array of { id, start, end, text }
  var activeCardId = null;

  function initSubtitle() {
    var fileInput = document.getElementById('file-srt');
    var btnLoad   = document.getElementById('btn-load-subs');
    var listEl    = document.getElementById('subtitle-list');

    if (!fileInput || !btnLoad || !listEl) {
      throw new Error('subtitle: required elements not found');
    }

    /* Open file picker */
    btnLoad.addEventListener('click', function () {
      fileInput.value = '';
      fileInput.click();
    });

    /* Load and parse SRT file */
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          subtitles = Utils.parseSRT(e.target.result);
          renderCards(listEl, subtitles);
          Logger.info('subtitle', 'loaded', subtitles.length, 'cues from', file.name);
        } catch (err) {
          Logger.error('subtitle', 'parse error:', err.message);
        }
      };
      reader.onerror = function () {
        Logger.error('subtitle', 'file read error');
      };
      reader.readAsText(file, 'UTF-8');
    });

    /* Listen for timeupdate — detail MUST be a number */
    Bus.on('video:timeupdate', function (detail) {
      var t = parseFloat(detail);
      if (!isFinite(t)) {
        Logger.warn('subtitle', 'video:timeupdate — invalid detail ignored:', detail);
        return;
      }
      highlightActive(listEl, t);
    });
  }

  /* ---- Render subtitle cards ---- */
  function renderCards(listEl, subs) {
    listEl.innerHTML = '';

    if (!subs || subs.length === 0) {
      listEl.innerHTML = '<p class="subtitle-empty">No subtitles found in file.</p>';
      return;
    }

    subs.forEach(function (sub) {
      var card = document.createElement('div');
      card.className = 'subtitle-card';
      card.dataset.id    = sub.id;
      card.dataset.start = sub.start;
      card.dataset.end   = sub.end;

      var timeEl = document.createElement('div');
      timeEl.className = 'card-time';
      timeEl.textContent = Utils.formatTime(sub.start) + ' — ' + Utils.formatTime(sub.end);

      var textEl = document.createElement('div');
      textEl.className = 'card-text';
      renderTokens(textEl, sub.text);

      card.appendChild(timeEl);
      card.appendChild(textEl);

      /* Card click → seek video */
      card.addEventListener('click', function (e) {
        /* Don't double-fire if the click landed on a word token */
        if (e.target.classList.contains('word-token')) return;
        Bus.emit('video:seek', sub.start);
        Logger.log('subtitle', 'card clicked → seek', sub.start);
      });

      listEl.appendChild(card);
    });
  }

  /* ---- Tokenise subtitle text and attach word-click listeners ---- */
  function renderTokens(container, text) {
    var tokens = Utils.tokenise(text);
    tokens.forEach(function (tok) {
      if (tok.type === 'sep') {
        container.appendChild(document.createTextNode(tok.value));
      } else {
        var span = document.createElement('span');
        span.className = 'word-token';
        span.textContent = tok.value;
        span.addEventListener('click', function (e) {
          e.stopPropagation(); // prevent card click from firing
          handleWordClick(span, tok.value, text);
        });
        container.appendChild(span);
      }
    });
  }

  /* ---- Handle word click ---- */
  function handleWordClick(spanEl, word, context) {
    /* Deselect any previously selected word */
    var prev = document.querySelector('.word-token.selected');
    if (prev) prev.classList.remove('selected');
    spanEl.classList.add('selected');

    Bus.emit('word:clicked', { word: word, context: context });
    Logger.log('subtitle', 'word clicked:', word);
  }

  /* ---- Highlight active subtitle based on current time ---- */
  function highlightActive(listEl, currentTime) {
    var active = null;
    for (var i = 0; i < subtitles.length; i++) {
      if (currentTime >= subtitles[i].start && currentTime <= subtitles[i].end) {
        active = subtitles[i];
        break;
      }
    }

    var newId = active ? active.id : null;
    if (newId === activeCardId) return; // no change
    activeCardId = newId;

    /* Update card classes */
    var cards = listEl.querySelectorAll('.subtitle-card');
    cards.forEach(function (card) {
      var isActive = active && String(card.dataset.id) === String(active.id);
      card.classList.toggle('active', isActive);
      if (isActive) {
        /* Scroll into view if needed */
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  window.initSubtitle = initSubtitle;

}());
