/* ============================================================
   layout.js — LinguaPlay Phase A
   Injects ALL DOM into #root. Pure DOM creation, minimal logic.
   Global: window.buildLayout
   ============================================================ */
(function () {
  'use strict';

  function buildLayout() {
    var root = document.getElementById('root');
    if (!root) {
      throw new Error('layout: #root element not found');
    }

    root.innerHTML = [
      /* ---- Error banner (hidden by default) ---- */
      '<div id="error-banner"></div>',

      /* ================================================================
         HEADER
         ================================================================ */
      '<header id="app-header">',
        '<span class="brand">LinguaPlay</span>',

        '<input type="file" id="file-video" accept="video/*">',
        '<button class="btn" id="btn-load-video">',
          '<span>&#9654;</span> Load Video',
        '</button>',

        '<input type="file" id="file-srt" accept=".srt,.txt">',
        '<button class="btn" id="btn-load-subs">',
          '<span>&#9776;</span> Load Subs',
        '</button>',

        '<span class="header-spacer"></span>',

        '<button class="btn btn-icon" id="btn-chat" title="Chat">&#128172;</button>',
        '<div id="connectivity-led" title="Connectivity"></div>',
      '</header>',

      /* ================================================================
         MAIN AREA
         ================================================================ */
      '<main id="app-main">',

        /* ---- Video pane ---- */
        '<div id="video-pane">',
          '<div id="video-wrapper">',
            '<video id="main-video" controls></video>',
            '<div id="video-placeholder">',
              '<div class="ph-icon">&#127909;</div>',
              '<div>Click <strong>Load Video</strong> to begin</div>',
            '</div>',
          '</div>',
        '</div>',

        /* ---- Drag splitter ---- */
        '<div id="pane-splitter"></div>',

        /* ---- Side pane ---- */
        '<div id="side-pane">',

          /* Tab buttons */
          '<div id="side-tabs">',
            '<button class="tab-btn active" data-tab="subtitles">Subtitles</button>',
            '<button class="tab-btn" data-tab="vocab">Vocab</button>',
            '<button class="tab-btn" data-tab="examples">Examples</button>',
          '</div>',

          /* Subtitles panel */
          '<div class="tab-panel active" id="panel-subtitles">',
            '<div id="subtitle-list">',
              '<p class="subtitle-empty">Load a subtitle file (.srt) to begin.</p>',
            '</div>',
          '</div>',

          /* Vocab panel */
          '<div class="tab-panel" id="panel-vocab">',
            '<div id="vocab-panel">',
              '<div id="vocab-toolbar">',
                '<span id="vocab-count">0 entries</span>',
                '<button class="btn" id="btn-export-vocab">Export JSON</button>',
              '</div>',
              '<div id="vocab-list">',
                '<p class="vocab-empty">No vocab saved yet.</p>',
              '</div>',
            '</div>',
          '</div>',

          /* Examples panel */
          '<div class="tab-panel" id="panel-examples">',
            '<div id="example-panel">',
              '<div id="example-list">',
                '<p class="example-empty">Click a word to see examples.</p>',
              '</div>',
            '</div>',
          '</div>',

          /* NLP strip (bottom of side pane) */
          '<div id="nlp-strip" class="empty">',
            '<div id="nlp-word">—</div>',
            '<div id="nlp-context"></div>',
            '<div id="nlp-tags">',
              '<span class="nlp-tag pos" id="nlp-pos">POS</span>',
              '<span class="nlp-tag trans" id="nlp-trans">Translation</span>',
            '</div>',
            '<div id="nlp-actions">',
              '<button class="btn btn-save" id="btn-save-word" disabled>Save Word</button>',
              '<button class="btn btn-save" id="btn-save-sentence" disabled>Save Sentence</button>',
            '</div>',
          '</div>',

        '</div>', /* /side-pane */

      '</main>',

      /* ================================================================
         CHAT DRAWER
         ================================================================ */
      '<div id="chat-drawer">',
        '<div id="chat-header">',
          '<span>Chat (stub)</span>',
          '<button id="chat-close">&#215;</button>',
        '</div>',
        '<div id="chat-messages"></div>',
        '<div id="chat-input-row">',
          '<textarea id="chat-input" rows="2" placeholder="Type a message..."></textarea>',
          '<button class="btn" id="btn-chat-send">Send</button>',
        '</div>',
      '</div>'

    ].join('');

    Logger.info('layout', 'DOM injected');
  }

  window.buildLayout = buildLayout;

}());
