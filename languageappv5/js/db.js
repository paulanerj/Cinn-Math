/* ============================================================
   db.js — LinguaPlay Phase A
   IndexedDB wrapper. NON-FATAL: if DB fails the app keeps running.
   Global: window.DB
   ============================================================ */
(function () {
  'use strict';

  var DB_NAME    = 'linguaplay';
  var DB_VERSION = 1;
  var STORE_VOCAB = 'vocab';

  var _db = null; // IDBDatabase instance once opened

  /**
   * Open (or create) the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  function open() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }

      var req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_VOCAB)) {
          var store = db.createObjectStore(STORE_VOCAB, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('by_text', 'text', { unique: false });
          store.createIndex('by_type', 'type', { unique: false });
        }
      };

      req.onsuccess = function (e) {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  /**
   * Add a vocab entry.
   * Entry shape: { type: 'word'|'sentence', text: string, context: string, timestamp: string }
   * @param {Object} entry
   * @returns {Promise<number>} new key
   */
  function addVocab(entry) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_VOCAB, 'readwrite');
        var store = tx.objectStore(STORE_VOCAB);
        var req = store.add(entry);
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Retrieve all vocab entries (sorted by id ascending).
   * @returns {Promise<Array>}
   */
  function getAllVocab() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_VOCAB, 'readonly');
        var store = tx.objectStore(STORE_VOCAB);
        var req = store.getAll();
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Delete a vocab entry by id.
   * @param {number} id
   * @returns {Promise<void>}
   */
  function deleteVocab(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_VOCAB, 'readwrite');
        var store = tx.objectStore(STORE_VOCAB);
        var req = store.delete(id);
        req.onsuccess = function () { resolve(); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Initialise DB — called during boot. Non-fatal.
   * @returns {Promise<void>}
   */
  function dbInit() {
    return open().then(function () {
      Logger.info('DB', 'IndexedDB ready');
    }).catch(function (err) {
      Logger.warn('DB', 'IndexedDB unavailable:', err && err.message || err);
    });
  }

  window.DB = {
    init: dbInit,
    addVocab: addVocab,
    getAllVocab: getAllVocab,
    deleteVocab: deleteVocab
  };

}());
