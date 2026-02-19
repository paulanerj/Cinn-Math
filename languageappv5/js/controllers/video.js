/* ============================================================
   video.js — LinguaPlay Phase A
   Handles video file loading and timeupdate.

   Event contract:
     Emits:  video:timeupdate  detail: NUMBER (seconds)
     Listen: video:seek        detail: NUMBER (seconds)
   Global function: initVideo
   ============================================================ */
(function () {
  'use strict';

  function initVideo() {
    var fileInput   = document.getElementById('file-video');
    var btnLoad     = document.getElementById('btn-load-video');
    var videoEl     = document.getElementById('main-video');
    var placeholder = document.getElementById('video-placeholder');

    if (!fileInput || !btnLoad || !videoEl) {
      throw new Error('video: required elements not found');
    }

    /* Open file picker */
    btnLoad.addEventListener('click', function () {
      fileInput.value = ''; // reset so same file can be re-selected
      fileInput.click();
    });

    /* Load selected file */
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;

      var url = URL.createObjectURL(file);
      videoEl.src = url;
      videoEl.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      videoEl.load();
      Logger.info('video', 'loaded:', file.name);
    });

    /* Emit timeupdate as a NUMBER */
    videoEl.addEventListener('timeupdate', function () {
      var t = videoEl.currentTime;
      if (typeof t !== 'number' || !isFinite(t)) return;
      Bus.emit('video:timeupdate', t);
    });

    /* Listen for seek requests */
    Bus.on('video:seek', function (detail) {
      var t = parseFloat(detail);
      if (!isFinite(t) || t < 0) {
        Logger.warn('video', 'video:seek ignored — invalid detail:', detail);
        return;
      }
      try {
        videoEl.currentTime = t;
        Logger.log('video', 'seeked to', t);
      } catch (e) {
        Logger.warn('video', 'seek failed (video may not be loaded):', e.message);
      }
    });
  }

  window.initVideo = initVideo;

}());
