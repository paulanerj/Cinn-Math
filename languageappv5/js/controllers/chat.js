/* ============================================================
   chat.js — LinguaPlay Phase A (stub)
   Chat drawer: open/close + echo bot response.
   Global function: initChat
   ============================================================ */
(function () {
  'use strict';

  function initChat() {
    var drawer    = document.getElementById('chat-drawer');
    var btnOpen   = document.getElementById('btn-chat');
    var btnClose  = document.getElementById('chat-close');
    var messagesEl = document.getElementById('chat-messages');
    var inputEl   = document.getElementById('chat-input');
    var btnSend   = document.getElementById('btn-chat-send');

    if (!drawer || !btnOpen || !btnClose || !messagesEl || !inputEl || !btnSend) {
      throw new Error('chat: required elements not found');
    }

    /* Open / close */
    btnOpen.addEventListener('click', function () {
      drawer.classList.add('open');
      inputEl.focus();
      Logger.log('chat', 'drawer opened');
    });

    btnClose.addEventListener('click', function () {
      drawer.classList.remove('open');
      Logger.log('chat', 'drawer closed');
    });

    /* Send on button click */
    btnSend.addEventListener('click', sendMessage);

    /* Send on Enter (Shift+Enter = newline) */
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    function sendMessage() {
      var text = inputEl.value.trim();
      if (!text) return;

      appendMessage(messagesEl, text, 'user');
      inputEl.value = '';

      /* Echo stub response after short delay */
      setTimeout(function () {
        appendMessage(
          messagesEl,
          'Echo (stub): ' + text + '\n\n[Chat AI will be connected in a later phase.]',
          'bot'
        );
      }, 400);

      Logger.log('chat', 'message sent:', text);
    }
  }

  function appendMessage(container, text, role) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  window.initChat = initChat;

}());
