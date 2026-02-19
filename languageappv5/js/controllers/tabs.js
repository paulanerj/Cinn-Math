/* ============================================================
   tabs.js — LinguaPlay Phase A
   Controls the side-panel tab switching.
   Global function: initTabs
   ============================================================ */
(function () {
  'use strict';

  function initTabs() {
    var tabBar = document.getElementById('side-tabs');
    if (!tabBar) throw new Error('tabs: #side-tabs not found');

    var buttons = tabBar.querySelectorAll('.tab-btn');
    var panels  = document.querySelectorAll('.tab-panel');

    function activate(tabName) {
      buttons.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle('active', panel.id === 'panel-' + tabName);
      });
      Logger.log('tabs', 'active tab:', tabName);
    }

    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      activate(btn.dataset.tab);
    });

    // Bus integration: allow other controllers to switch tabs
    Bus.on('tab:switch', function (detail) {
      if (typeof detail === 'string') activate(detail);
    });
  }

  window.initTabs = initTabs;

}());
