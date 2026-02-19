/* ============================================================
   splitter.js — LinguaPlay Phase A
   Horizontal drag-splitter between video and side pane.
   Global function: initSplitter
   ============================================================ */
(function () {
  'use strict';

  function initSplitter() {
    var splitter  = document.getElementById('pane-splitter');
    var videoPane = document.getElementById('video-pane');
    var sidePane  = document.getElementById('side-pane');
    var appMain   = document.getElementById('app-main');

    if (!splitter || !videoPane || !sidePane || !appMain) {
      throw new Error('splitter: required pane elements not found');
    }

    // Set initial proportions via flex-basis
    videoPane.style.flex = '1 1 60%';
    sidePane.style.flex  = '1 1 40%';

    var dragging = false;
    var startX   = 0;
    var startVideoW = 0;
    var totalW = 0;

    splitter.addEventListener('mousedown', function (e) {
      dragging = true;
      startX = e.clientX;
      startVideoW = videoPane.getBoundingClientRect().width;
      totalW = appMain.getBoundingClientRect().width - splitter.offsetWidth;
      splitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var newVideoW = Math.min(Math.max(startVideoW + dx, 220), totalW - 220);
      var pct = (newVideoW / totalW * 100).toFixed(2);
      videoPane.style.flex = '0 0 ' + pct + '%';
      sidePane.style.flex  = '1 1 0';
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      Logger.log('splitter', 'resize done');
    });
  }

  window.initSplitter = initSplitter;

}());
