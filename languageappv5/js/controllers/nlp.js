/* ============================================================
   nlp.js — LinguaPlay Phase A
   Updates the NLP strip on word:clicked.
   Stubs for POS and translation (Phase A).

   Event contract:
     Listen: word:clicked  detail: { word, context }
     Emits:  vocab:save    detail: { type, text, context, timestamp }
   Global function: initNlp
   ============================================================ */
(function () {
  'use strict';

  /* ---- Stub data: POS and translation guesses ---- */
  var POS_STUBS = {
    the: 'DET', a: 'DET', an: 'DET',
    is: 'VERB', are: 'VERB', was: 'VERB', be: 'VERB', been: 'VERB',
    i: 'PRON', you: 'PRON', he: 'PRON', she: 'PRON', it: 'PRON',
    we: 'PRON', they: 'PRON',
    in: 'PREP', on: 'PREP', at: 'PREP', to: 'PREP', of: 'PREP',
    and: 'CONJ', but: 'CONJ', or: 'CONJ',
    not: 'ADV', very: 'ADV', here: 'ADV', there: 'ADV'
  };

  function guessPos(word) {
    return POS_STUBS[word.toLowerCase()] || 'NOUN';
  }

  function guessTranslation(word) {
    return '[' + word + ']'; // stub
  }

  /* ---- State ---- */
  var currentWord    = null;
  var currentContext = null;

  function initNlp() {
    var stripEl   = document.getElementById('nlp-strip');
    var wordEl    = document.getElementById('nlp-word');
    var ctxEl     = document.getElementById('nlp-context');
    var posEl     = document.getElementById('nlp-pos');
    var transEl   = document.getElementById('nlp-trans');
    var btnWord   = document.getElementById('btn-save-word');
    var btnSent   = document.getElementById('btn-save-sentence');

    if (!stripEl || !wordEl || !ctxEl || !posEl || !transEl || !btnWord || !btnSent) {
      throw new Error('nlp: required NLP strip elements not found');
    }

    /* Listen for word clicks */
    Bus.on('word:clicked', function (detail) {
      if (!detail || typeof detail !== 'object') {
        Logger.warn('nlp', 'word:clicked — invalid detail ignored:', detail);
        return;
      }
      var word    = String(detail.word    || '');
      var context = String(detail.context || '');

      if (!word) return;

      currentWord    = word;
      currentContext = context;

      wordEl.textContent  = word;
      ctxEl.textContent   = context ? '"' + context + '"' : '';
      posEl.textContent   = guessPos(word);
      transEl.textContent = guessTranslation(word);

      stripEl.classList.remove('empty');
      btnWord.disabled  = false;
      btnSent.disabled  = false;

      Logger.log('nlp', 'updated for word:', word);
    });

    /* Save word button */
    btnWord.addEventListener('click', function () {
      if (!currentWord) return;
      Bus.emit('vocab:save', {
        type:      'word',
        text:      currentWord,
        context:   currentContext,
        timestamp: Utils.nowISO()
      });
      Logger.log('nlp', 'vocab:save word emitted:', currentWord);
    });

    /* Save sentence button */
    btnSent.addEventListener('click', function () {
      if (!currentContext) return;
      Bus.emit('vocab:save', {
        type:      'sentence',
        text:      currentContext,
        context:   currentContext,
        timestamp: Utils.nowISO()
      });
      Logger.log('nlp', 'vocab:save sentence emitted:', currentContext);
    });
  }

  window.initNlp = initNlp;

}());
