/* ============================================================
   bus.js — LinguaPlay Phase A
   Lightweight pub/sub event bus. Global: window.Bus
   ============================================================ */
(function () {
  'use strict';

  var target = new EventTarget();

  /**
   * Emit an event.
   * @param {string} name
   * @param {*}      detail
   */
  function emit(name, detail) {
    var evt = new CustomEvent(name, { detail: detail });
    target.dispatchEvent(evt);
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string}   name
   * @param {Function} cb  — called with (detail)
   * @returns {Function} unsubscribe
   */
  function on(name, cb) {
    function handler(e) { cb(e.detail); }
    target.addEventListener(name, handler);
    return function () { target.removeEventListener(name, handler); };
  }

  window.Bus = { emit: emit, on: on };

}());
