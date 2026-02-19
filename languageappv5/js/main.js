/* ============================================================
   main.js — LinguaPlay Phase A
   Boot sequence. Sacred order:
     1. buildLayout()
     2. DB.init()
     3. Controller inits
     4. App interactive
   ============================================================ */
(function () {
  'use strict';

  function showError(msg) {
    var banner = document.getElementById('error-banner');
    if (banner) {
      banner.textContent = 'Error: ' + msg;
      banner.classList.add('visible');
    }
    Logger.error('main', msg);
  }

  function boot() {
    Logger.info('main', '--- LinguaPlay Phase A booting ---');

    /* ---- Step 1: Build layout ---- */
    try {
      buildLayout();
    } catch (e) {
      showError('buildLayout failed: ' + e.message);
      return; // Cannot continue without DOM
    }

    /* ---- Step 2: DB init (non-fatal) ---- */
    DB.init().catch(function (err) {
      Logger.warn('main', 'DB init error (non-fatal):', err);
    });

    /* ---- Step 3: Controllers ---- */
    var controllers = [
      { name: 'connectivity', fn: initConnectivity },
      { name: 'tabs',         fn: initTabs         },
      { name: 'splitter',     fn: initSplitter      },
      { name: 'video',        fn: initVideo         },
      { name: 'subtitle',     fn: initSubtitle      },
      { name: 'nlp',          fn: initNlp           },
      { name: 'vocab',        fn: initVocab         },
      { name: 'example',      fn: initExample       },
      { name: 'chat',         fn: initChat          }
    ];

    controllers.forEach(function (ctrl) {
      try {
        ctrl.fn();
        Logger.log('main', ctrl.name + ' initialised');
      } catch (e) {
        Logger.error('main', ctrl.name + ' init failed:', e.message);
        showError(ctrl.name + ' failed to initialise: ' + e.message);
      }
    });

    Logger.info('main', '--- Boot complete. App interactive. ---');
  }

  /* Run after all scripts are parsed */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
