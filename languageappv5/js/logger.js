/* ============================================================
   logger.js — LinguaPlay Phase A
   Simple tagged console logger. Global: window.Logger
   ============================================================ */
(function () {
  'use strict';

  var LEVELS = { log: 0, info: 1, warn: 2, error: 3 };
  var currentLevel = 0; // show all

  function make(level, style) {
    return function (tag, msg) {
      if (LEVELS[level] < currentLevel) return;
      var prefix = '[' + tag + ']';
      var rest = Array.prototype.slice.call(arguments, 1);
      if (style) {
        console[level]('%c' + prefix, style, rest.join(' '));
      } else {
        console[level].apply(console, [prefix].concat(rest));
      }
    };
  }

  window.Logger = {
    log:   make('log',   'color:#9ba4c0'),
    info:  make('info',  'color:#5b8dee;font-weight:bold'),
    warn:  make('warn',  'color:#ffb74d;font-weight:bold'),
    error: make('error', 'color:#ef5350;font-weight:bold'),
    setLevel: function (l) { if (LEVELS[l] !== undefined) currentLevel = LEVELS[l]; }
  };

}());
