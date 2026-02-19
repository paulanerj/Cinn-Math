/* ============================================================
   connectivity.js — LinguaPlay Phase A
   Updates the LED dot based on navigator.onLine.
   Global function: initConnectivity
   ============================================================ */
(function () {
  'use strict';

  function initConnectivity() {
    var led = document.getElementById('connectivity-led');
    if (!led) throw new Error('connectivity: #connectivity-led not found');

    function update() {
      if (navigator.onLine) {
        led.classList.add('online');
        led.title = 'Online';
      } else {
        led.classList.remove('online');
        led.title = 'Offline';
      }
      Logger.log('connectivity', navigator.onLine ? 'online' : 'offline');
    }

    window.addEventListener('online',  update);
    window.addEventListener('offline', update);
    update(); // set initial state
  }

  window.initConnectivity = initConnectivity;

}());
