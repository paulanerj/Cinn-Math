/* ============================================================
   utils.js — LinguaPlay Phase A
   Shared utility helpers. Global: window.Utils
   ============================================================ */
(function () {
  'use strict';

  /**
   * Convert SRT timestamp string "HH:MM:SS,mmm" to seconds (number).
   * @param {string} ts
   * @returns {number}
   */
  function srtTimeToSeconds(ts) {
    // Accept both comma and dot as decimal separator
    var clean = ts.trim().replace(',', '.');
    var parts = clean.split(':');
    if (parts.length !== 3) return 0;
    var h = parseFloat(parts[0]) || 0;
    var m = parseFloat(parts[1]) || 0;
    var s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }

  /**
   * Format seconds to "MM:SS" string.
   * @param {number} secs
   * @returns {string}
   */
  function formatTime(secs) {
    if (!isFinite(secs) || secs < 0) return '00:00';
    var total = Math.floor(secs);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /**
   * Parse an SRT string into an array of subtitle objects.
   * Each: { id: number, start: number, end: number, text: string }
   * @param {string} srtText
   * @returns {Array}
   */
  function parseSRT(srtText) {
    var results = [];
    // Normalise line endings
    var text = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Split on blank lines between cue blocks
    var blocks = text.split(/\n\s*\n/);

    blocks.forEach(function (block) {
      var lines = block.trim().split('\n');
      if (lines.length < 2) return;

      var idLine   = lines[0].trim();
      var timeLine = lines[1].trim();
      var textLines = lines.slice(2);

      // id line must be a number
      var id = parseInt(idLine, 10);
      if (isNaN(id)) return;

      // time line: "HH:MM:SS,mmm --> HH:MM:SS,mmm"
      // also accept em-dash (–) as separator (common copy-paste artifact)
      var timeParts = timeLine.split(/\s+[-–>]+\s+/);
      if (timeParts.length < 2) return;

      var start = srtTimeToSeconds(timeParts[0]);
      var end   = srtTimeToSeconds(timeParts[1]);

      // Strip HTML tags from subtitle text
      var rawText = textLines.join(' ').replace(/<[^>]+>/g, '').trim();
      if (!rawText) return;

      results.push({ id: id, start: start, end: end, text: rawText });
    });

    return results;
  }

  /**
   * Escape a string for safe insertion as text content.
   * Only used when building innerHTML; prefer textContent otherwise.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Tokenise a sentence into word tokens and non-word separators.
   * Returns array of { type: 'word'|'sep', value: string }
   * @param {string} sentence
   * @returns {Array}
   */
  function tokenise(sentence) {
    var tokens = [];
    // Split on word boundaries, keeping separators
    var parts = sentence.split(/(\s+|[^\w\u00C0-\u024F']+)/);
    parts.forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part) || /^[^\w\u00C0-\u024F']+$/.test(part)) {
        tokens.push({ type: 'sep', value: part });
      } else {
        tokens.push({ type: 'word', value: part });
      }
    });
    return tokens;
  }

  /**
   * Generate a timestamp string for display / IDs.
   * @returns {string}
   */
  function nowISO() {
    return new Date().toISOString();
  }

  window.Utils = {
    srtTimeToSeconds: srtTimeToSeconds,
    formatTime: formatTime,
    parseSRT: parseSRT,
    escapeHtml: escapeHtml,
    tokenise: tokenise,
    nowISO: nowISO
  };

}());
