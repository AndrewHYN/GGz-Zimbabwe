(() => {
  function getCookie(name) {
    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
  }

  const mobileToggle = document.getElementById('nav-mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  const dropdownTriggers = Array.from(document.querySelectorAll('.nav-more'));
  const profileToggle = document.getElementById('nav-profile-toggle');
  const profilePanel = document.getElementById('nav-profile-panel');

  function closeDropdowns() {
    dropdownTriggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'false');
      const panel = trigger.nextElementSibling;
      if (panel) panel.setAttribute('aria-hidden', 'true');
    });
  }

  function closeProfileMenu() {
    if (profileToggle) {
      profileToggle.setAttribute('aria-expanded', 'false');
    }
    if (profilePanel) {
      profilePanel.setAttribute('aria-hidden', 'true');
    }
  }

  function closeMobileMenu() {
    if (mobileToggle && navMenu) {
      mobileToggle.setAttribute('aria-expanded', 'false');
      navMenu.classList.remove('is-open');
    }
  }

  function closeAllMenus() {
    closeDropdowns();
    closeProfileMenu();
    closeMobileMenu();
  }

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = mobileToggle.getAttribute('aria-expanded') === 'true';
      closeDropdowns();
      closeProfileMenu();
      mobileToggle.setAttribute('aria-expanded', String(!isOpen));
      navMenu.classList.toggle('is-open', !isOpen);
    });
  }

  dropdownTriggers.forEach((trigger) => {
    const panel = trigger.nextElementSibling;
    if (panel) {
      panel.setAttribute('aria-hidden', 'true');
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      closeDropdowns();
      closeProfileMenu();
      closeMobileMenu();
      if (!isOpen && panel) {
        trigger.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
      }
    });
  });

  if (profileToggle && profilePanel) {
    profileToggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = profileToggle.getAttribute('aria-expanded') === 'true';
      closeDropdowns();
      closeMobileMenu();
      if (isOpen) {
        closeProfileMenu();
        return;
      }
      profileToggle.setAttribute('aria-expanded', 'true');
      profilePanel.setAttribute('aria-hidden', 'false');
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.nav-mobile-toggle')) {
      return;
    }
    if (event.target.closest('.nav-profile-button')) {
      return;
    }
    if (event.target.closest('.nav-more')) {
      return;
    }
    if (event.target.closest('.nav-profile')) {
      return;
    }
    if (event.target.closest('.nav-dropdown')) {
      return;
    }
    if (!event.target.closest('.site-nav')) {
      closeAllMenus();
      return;
    }
    if (!event.target.closest('.nav-menu') && !event.target.closest('.nav-mobile-toggle')) {
      closeMobileMenu();
    }
    if (!event.target.closest('.nav-profile')) {
      closeProfileMenu();
    }
    if (!event.target.closest('.nav-dropdown') && !event.target.closest('.nav-more')) {
      closeDropdowns();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllMenus();
    }
  });

  document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.dataset.passwordToggle;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.textContent = isPassword ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', String(isPassword));
    });
  });

  document.querySelectorAll('[data-form-submit-state]').forEach((form) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    form.addEventListener('submit', () => {
      button.disabled = true;
      button.classList.add('is-loading');
      const label = button.textContent.trim();
      button.dataset.originalLabel = label;
      button.textContent = 'Please wait...';
    });
  });

  document.querySelectorAll('[data-provider-submit]').forEach((link) => {
    link.addEventListener('click', () => {
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('is-loading');
      link.dataset.originalLabel = link.textContent.trim();
      link.textContent = 'Connecting...';
    });
  });

  const presencePage = document.querySelector('[data-presence-stream-url]');
  if (presencePage) {
    const statusElement = presencePage.querySelector('[data-presence-status]');
    const labelElement = presencePage.querySelector('[data-presence-label]');
    const detailElement = presencePage.querySelector('[data-presence-detail]');
    const indicator = presencePage.querySelector('[data-presence-indicator]');
    const updatePresence = (payload) => {
      if (!statusElement || !payload.status) return;
      ['presence-online', 'presence-away', 'presence-offline', 'presence-invisible'].forEach((name) => {
        statusElement.classList.remove(name);
        if (indicator) indicator.classList.remove(name);
      });
      statusElement.classList.add(`presence-${payload.status}`);
      if (indicator) indicator.classList.add(`presence-${payload.status}`);
      if (labelElement) labelElement.textContent = payload.label || 'Offline';
      if (detailElement) detailElement.textContent = payload.detail || '';
      statusElement.setAttribute('aria-label', `${payload.label || 'Offline'} — ${payload.detail || 'Not active recently'}`);
    };
    let stream = null;
    const connectPresence = () => {
      if (document.visibilityState === 'hidden' || stream) return;
      stream = new EventSource(presencePage.dataset.presenceStreamUrl);
      stream.onmessage = (event) => {
        try { updatePresence(JSON.parse(event.data)); } catch (error) { /* Ignore malformed transient events. */ }
      };
      stream.onerror = () => { stream?.close(); stream = null; };
    };
    const disconnectPresence = () => { stream?.close(); stream = null; };
    connectPresence();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') disconnectPresence(); else connectPresence(); });
    window.addEventListener('pagehide', disconnectPresence, { once: true });
    if (presencePage.dataset.presenceOwner === 'true') {
      const heartbeatUrl = presencePage.dataset.presenceHeartbeatUrl;
      let lastHeartbeat = 0;
      const heartbeat = () => {
        if (document.visibilityState === 'hidden' || Date.now() - lastHeartbeat < 15000) return;
        lastHeartbeat = Date.now();
        fetch(heartbeatUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-CSRFToken': getCookie('csrftoken'), 'X-Requested-With': 'XMLHttpRequest' },
        }).then((response) => response.ok ? response.json() : null).then((payload) => { if (payload) updatePresence(payload); }).catch(() => {});
      };
      heartbeat();
      window.setInterval(heartbeat, 30000);
      document.addEventListener('visibilitychange', heartbeat);
      ['click', 'keydown', 'pointerdown'].forEach((eventName) => document.addEventListener(eventName, heartbeat, { passive: true }));
    }
  }

  document.querySelectorAll('[data-async-action]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const label = form.querySelector('[data-follow-label]');
      const status = form.querySelector('[data-follow-status]');
      const following = form.action.includes('/unfollow/');
      if (status) status.textContent = '';
      if (label && form.matches('[data-follow-form]')) label.textContent = following ? 'Unfollowing...' : 'Following...';
      if (button) { button.disabled = true; button.classList.add('is-loading'); }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      fetch((button && button.formAction) || form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin', signal: controller.signal, headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
        .then((response) => response.text().then((body) => {
          let payload;
          try { payload = body ? JSON.parse(body) : {}; } catch (error) { throw new Error(response.ok ? 'The server returned an unexpected response. Try again.' : `Request failed (${response.status}). Try again.`); }
          if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed (${response.status}).`);
          return payload;
        }))
        .then((result) => {
          if (form.matches('[data-follow-form]')) {
            form.action = result.following ? form.action.replace('/follow/', '/unfollow/') : form.action.replace('/unfollow/', '/follow/');
            if (label) label.textContent = result.following ? 'Following' : 'Follow';
            else button.innerHTML = result.following ? '<span aria-hidden="true">✓</span> Following' : '<span aria-hidden="true">+</span> Follow';
            button.setAttribute('aria-pressed', String(result.following));
          }
          if (button) { button.disabled = false; button.classList.remove('is-loading'); }
        })
        .catch((error) => { if (label) label.textContent = following ? 'Following' : 'Follow'; if (button) { button.disabled = false; button.classList.remove('is-loading'); } if (status) status.textContent = error.name === 'AbortError' ? 'The request timed out. Try again.' : error.message || 'Could not update the follow state.'; })
        .finally(() => window.clearTimeout(timeout));
    });
  });

  const socialJson = (form) => fetch(form.action, {
    method: 'POST',
    body: new FormData(form),
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  }).then((response) => response.ok ? response.json() : Promise.reject(new Error('Request failed')));

  document.querySelectorAll('[data-async-mutation]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const original = button?.textContent || '';
      if (button) { button.disabled = true; button.textContent = 'Saving...'; }
      socialJson(form).then((result) => {
        if (!result.ok) throw new Error(result.error || 'Could not save this action.');
        if (button) {
          if (typeof result.saved === 'boolean') button.textContent = result.saved ? 'Unsave listing' : 'Save listing';
          else button.textContent = result.status || (result.attending === false || result.registered === false ? 'Removed' : 'Saved');
        }
        const status = form.querySelector('.async-status') || document.createElement('span');
        status.className = 'async-status';
        status.setAttribute('role', 'status');
        status.textContent = result.message || 'Saved';
        if (!status.parentNode) form.append(status);
        if (result.url) window.location.href = result.url;
      }).catch((error) => {
        if (button) { button.disabled = false; button.textContent = original; }
        const status = form.querySelector('.async-status') || document.createElement('span');
        status.className = 'async-status';
        status.setAttribute('role', 'alert');
        status.textContent = error.message || 'Could not save this action.';
        if (!status.parentNode) form.append(status);
      });
    });
  });

  const updateMessageCount = (count) => document.querySelectorAll('[data-message-count]').forEach((badge) => {
    badge.textContent = count || '';
    badge.hidden = !count;
  });

  document.querySelectorAll('[data-notification-open], [data-notification-read-all], [data-notification-unread]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const item = form.closest('[data-notification-id]');
      socialJson(form).then((result) => {
        if (item && form.matches('[data-notification-open]')) item.classList.remove('is-unread');
        if (form.matches('[data-notification-read-all]')) document.querySelectorAll('.social-notification').forEach((notification) => notification.classList.remove('is-unread'));
        document.querySelectorAll('[data-notification-unread]').forEach((unreadForm) => { if (form.matches('[data-notification-read-all]')) unreadForm.remove(); });
        document.querySelectorAll('[data-notification-count]').forEach((badge) => { badge.textContent = result.unread_count || ''; badge.hidden = !result.unread_count; });
        if (form.matches('[data-notification-open]') && item) form.closest('button').disabled = true;
        if (form.matches('[data-notification-open]') && result.target_url) window.location.href = result.target_url;
      }).catch(() => { const status = document.querySelector('[data-social-status]'); if (status) status.textContent = 'Could not update notifications. Try again.'; });
    });
  });

  const notificationPage = document.querySelector('[data-social-stream-url]');
  if (notificationPage) {
    const notificationStream = new EventSource(notificationPage.dataset.socialStreamUrl);
    const permissionButton = notificationPage.querySelector('[data-browser-notification-opt-in]');
    let latestNotificationId = null;
    let notificationPoll = null;
    if (permissionButton && 'Notification' in window && Notification.permission === 'default') {
      permissionButton.hidden = false;
      permissionButton.addEventListener('click', async () => {
        const permission = await Notification.requestPermission();
        permissionButton.textContent = permission === 'granted' ? 'Browser updates on' : 'Updates not enabled';
        permissionButton.disabled = true;
      });
    }
    const applyNotificationCount = (count) => document.querySelectorAll('[data-notification-count]').forEach((badge) => { badge.textContent = count > 0 ? count : ''; badge.hidden = count <= 0; });
    const applyNotificationPayload = (payload) => {
      applyNotificationCount(Number(payload.unread_count) || 0);
      updateMessageCount(payload.unread_message_count);
      if (latestNotificationId !== null && payload.latest_id && payload.latest_id !== latestNotificationId && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        new Notification('GGz activity', { body: payload.latest_message || 'You have a new GGz notification.' });
      }
      latestNotificationId = payload.latest_id || latestNotificationId;
    };
    const stopNotificationPoll = () => { if (notificationPoll) window.clearInterval(notificationPoll); notificationPoll = null; };
    const startNotificationPoll = () => {
      if (notificationPoll) return;
      notificationPoll = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        fetch(`${notificationPage.dataset.socialStreamUrl}?format=json`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('snapshot failed')))
          .then(applyNotificationPayload)
          .catch(() => {});
      }, 15000);
    };
    notificationStream.onopen = () => { stopNotificationPoll(); notificationPage.classList.remove('is-reconnecting'); };
    notificationStream.onerror = () => { notificationPage.classList.add('is-reconnecting'); startNotificationPoll(); };
    notificationStream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        notificationPage.classList.remove('is-reconnecting');
        applyNotificationPayload(payload);
      } catch (error) { /* Ignore transient malformed events. */ }
    };
  }

  const conversationSearch = document.querySelector('[data-conversation-search]');
  if (conversationSearch) conversationSearch.addEventListener('input', () => {
    const query = conversationSearch.value.trim().toLowerCase();
    document.querySelectorAll('[data-conversation-item]').forEach((item) => { item.hidden = query && !item.dataset.conversationName.includes(query); });
  });

  const inbox = document.querySelector('[data-inbox-stream-url]');
  if (inbox) {
    const inboxStream = new EventSource(inbox.dataset.inboxStreamUrl);
    const updateInbox = (payload) => {
      updateMessageCount(payload.unread_message_count);
      (payload.items || []).forEach((item) => {
        const row = document.querySelector(`[data-conversation-id="${item.id}"]`);
        if (!row) return;
        const preview = row.querySelector('.conversation-copy small');
        const count = row.querySelector('[data-conversation-unread]');
        const meta = row.querySelector('.conversation-meta');
        if (preview) preview.textContent = item.preview;
        if (meta && item.time) meta.firstChild.textContent = item.time;
        if (item.unread_count) {
          row.classList.add('is-unread');
          if (count) count.textContent = item.unread_count;
          else if (meta) { const badge = document.createElement('b'); badge.dataset.conversationUnread = 'true'; badge.textContent = item.unread_count; meta.append(badge); }
        } else {
          row.classList.remove('is-unread');
          if (count) count.remove();
        }
      });
    };
    inboxStream.onmessage = (event) => { try { updateInbox(JSON.parse(event.data)); } catch (error) { /* Ignore transient malformed events. */ } };
  }

  const chatPage = document.querySelector('[data-chat-page]');
  if (chatPage) {
    const list = chatPage.querySelector('[data-message-list]');
    const form = chatPage.querySelector('[data-message-form]');
    const input = chatPage.querySelector('[data-message-input]');
    const status = chatPage.querySelector('[data-message-status]');
    const empty = chatPage.querySelector('[data-chat-empty]');
    const newMessagePrompt = chatPage.querySelector('[data-new-message-prompt]');
    const historyButton = chatPage.querySelector('[data-load-history]');
    const typingIndicator = chatPage.querySelector('[data-typing-indicator]');
    const typingUrl = list.dataset.messageTypingUrl;
    let pendingMessages = 0;
    let typingTimer = null;
    const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    const scrollLatest = () => { list.scrollTop = list.scrollHeight; };
    const appendMessage = (message, pending = false) => {
      if (empty) empty.remove();
      const existing = list.querySelector(`[data-message-id="${message.id}"]`);
      if (existing) {
        existing.dataset.messageState = message.state || 'sent';
        const ticks = existing.querySelector('[data-message-ticks]');
        if (ticks) {
          const isRead = message.state === 'read';
          ticks.textContent = isRead || message.state === 'delivered' ? '✓✓' : '✓';
          ticks.setAttribute('aria-label', isRead ? 'Read' : message.state === 'delivered' ? 'Delivered' : 'Sent');
        }
        return existing;
      }
      const article = document.createElement('article');
      article.className = `message-bubble${message.mine ? ' message-own' : ''}${pending ? ' is-pending' : ''}`;
      article.dataset.messageId = message.id;
      article.dataset.messageState = message.state || 'sent';
      article.innerHTML = `<p></p><footer><time>${message.time || 'now'}</time>${message.mine ? `<span class="message-ticks" data-message-ticks aria-label="${message.state || 'Sent'}">${message.state === 'read' || message.state === 'delivered' ? '✓✓' : '✓'}</span>` : ''}</footer>`;
      article.querySelector('p').textContent = message.body;
      list.append(article);
      return article;
    };
    const updateTyping = (typing) => { if (typingIndicator) typingIndicator.hidden = !typing; };
    const sendTyping = (typing) => fetch(typingUrl, { method: 'POST', body: new URLSearchParams({ typing: String(typing), csrfmiddlewaretoken: getCookie('csrftoken') }), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } }).catch(() => {});
    const prependHistory = (messages) => {
      const anchor = list.querySelector('[data-message-id]');
      messages.forEach((message) => {
        const article = appendMessage(message);
        if (anchor) list.insertBefore(article, anchor);
      });
    };
    if (historyButton) {
      const firstMessage = () => list.querySelector('[data-message-id]');
      historyButton.hidden = !firstMessage();
      historyButton.addEventListener('click', () => {
        const first = firstMessage();
        if (!first) return;
        historyButton.disabled = true;
        fetch(`${list.dataset.messageHistoryUrl}?format=json&before=${encodeURIComponent(first.dataset.messageId)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('History unavailable')))
          .then((result) => { prependHistory(result.messages || []); historyButton.hidden = !result.has_more; })
          .catch(() => { historyButton.textContent = 'Could not load older messages'; })
          .finally(() => { historyButton.disabled = false; });
      });
    }
    scrollLatest();
    const markRead = () => fetch(chatPage.dataset.chatReadUrl, { method: 'POST', body: new URLSearchParams({ action: 'read', csrfmiddlewaretoken: getCookie('csrftoken') }), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then((response) => response.ok ? response.json() : null).then((result) => { if (result) updateMessageCount(result.unread_message_count); }).catch(() => {});
    markRead();
    const stream = new EventSource(chatPage.dataset.chatStreamUrl);
    const reconnectStatus = document.createElement('span');
    reconnectStatus.className = 'stream-status';
    reconnectStatus.setAttribute('role', 'status');
    chatPage.querySelector('.chat-header').append(reconnectStatus);
    stream.onopen = () => { reconnectStatus.textContent = ''; };
    stream.onerror = () => { reconnectStatus.textContent = 'Reconnecting...'; };
    stream.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === 'typing') { updateTyping(message.typing); return; }
        const shouldScroll = nearBottom();
        const article = appendMessage(message);
        if (message.mine && article) article.dataset.messageState = message.state;
        if (shouldScroll) { scrollLatest(); pendingMessages = 0; if (newMessagePrompt) newMessagePrompt.hidden = true; }
        else if (!message.mine) { pendingMessages += 1; if (newMessagePrompt) { newMessagePrompt.hidden = false; const count = newMessagePrompt.querySelector('[data-new-message-count]'); if (count) count.textContent = pendingMessages; } }
        if (!message.mine && shouldScroll) markRead();
      } catch (error) { /* Ignore malformed transient events. */ }
    };
    const sendMessage = () => {
      const body = input.value.trim();
      if (!body) return;
      const clientId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `ggz-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Sending...';
      const formData = new FormData(form);
      formData.set('client_id', clientId);
      fetch(form.action, { method: 'POST', body: formData, credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.error || 'Message failed')))).then((result) => {
        appendMessage(result.message);
        input.value = '';
        status.textContent = 'Sent';
        updateMessageCount(result.unread_message_count);
        scrollLatest();
      }).catch((error) => {
        status.textContent = error.message || 'Message failed.';
        let retry = form.querySelector('[data-message-retry]');
        if (!retry) { retry = document.createElement('button'); retry.type = 'button'; retry.dataset.messageRetry = 'true'; retry.className = 'message-retry'; retry.textContent = 'Retry'; status.append(retry); }
        retry.onclick = () => { retry.remove(); sendMessage(); };
      }).finally(() => { button.disabled = false; input.focus(); });
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage();
    });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
    input.addEventListener('input', () => { sendTyping(true); window.clearTimeout(typingTimer); typingTimer = window.setTimeout(() => sendTyping(false), 2500); });
    newMessagePrompt?.querySelector('button')?.addEventListener('click', () => { scrollLatest(); pendingMessages = 0; newMessagePrompt.hidden = true; markRead(); });
  }

  async function readJsonResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (response.redirected && new URL(response.url).pathname.includes('/accounts/login/')) {
        throw new Error('Your session has expired. Please log in again.');
      }
      throw new Error(`Unexpected server response (${response.status}).`);
    }
    const result = await response.json();
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || `Request failed (${response.status}).`);
    }
    return result;
  }

  const playerSearchForm = document.querySelector('[data-player-search-form]');
  if (playerSearchForm) {
    const playerSearchInput = playerSearchForm.querySelector('[data-player-search-input]');
    const playerSuggestions = playerSearchForm.querySelector('[data-player-suggestions]');
    const suggestionUrl = playerSearchForm.dataset.suggestionsUrl;
    let suggestionRequest = null;

    function closePlayerSuggestions() {
      playerSuggestions.innerHTML = '';
      playerSuggestions.classList.remove('is-visible');
    }

    function renderPlayerSuggestions(results) {
      playerSuggestions.innerHTML = '';
      results.forEach((result) => {
        const link = document.createElement('a');
        link.className = 'player-suggestion';
        link.href = result.url;
        link.setAttribute('role', 'option');
        const name = document.createElement('strong');
        name.textContent = result.gamer_tag;
        const detail = document.createElement('small');
        detail.textContent = `@${result.username} · ${result.rank}`;
        link.append(name, detail);
        playerSuggestions.append(link);
      });
      playerSuggestions.classList.toggle('is-visible', results.length > 0);
    }

    async function loadPlayerSuggestions() {
      const query = playerSearchInput.value.trim();
      if (query.length < 2) {
        closePlayerSuggestions();
        return;
      }
      if (suggestionRequest) suggestionRequest.abort();
      suggestionRequest = new AbortController();
      try {
        const response = await fetch(`${suggestionUrl}?q=${encodeURIComponent(query)}`, { credentials: 'same-origin', signal: suggestionRequest.signal });
        if (!response.ok) throw new Error('Suggestion request failed');
        const result = await response.json();
        renderPlayerSuggestions(result.results || []);
      } catch (error) {
        if (error.name !== 'AbortError') closePlayerSuggestions();
      }
    }

    playerSearchInput.addEventListener('input', loadPlayerSuggestions);
    playerSearchInput.addEventListener('focus', loadPlayerSuggestions);
    playerSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePlayerSuggestions();
      if (event.key === 'ArrowDown') playerSuggestions.querySelector('a')?.focus();
    });
    playerSearchForm.addEventListener('submit', closePlayerSuggestions);
    document.addEventListener('click', (event) => {
      if (!playerSearchForm.contains(event.target)) closePlayerSuggestions();
    });
    playerSearchForm.querySelectorAll('[data-filter-select]').forEach((filter) => {
      filter.addEventListener('change', () => playerSearchForm.requestSubmit());
    });
  }

  const releaseCarousel = document.querySelector('[data-release-carousel]');
  if (releaseCarousel) {
    const releaseTrack = releaseCarousel.querySelector('.release-track');
    const releaseCards = Array.from(releaseTrack.querySelectorAll('.release-card'));
    const releasePrevious = releaseCarousel.querySelector('[data-release-direction="prev"]');
    const releaseNext = releaseCarousel.querySelector('[data-release-direction="next"]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let releaseIndex = releaseCards.length > 3 ? 2 : 0;
    let releaseTimer = null;
    let releaseAnimating = false;

    if (releaseCards.length > 3) {
      releaseCards.slice(-2).forEach((card) => releaseTrack.prepend(card.cloneNode(true)));
      releaseCards.slice(0, 2).forEach((card) => releaseTrack.append(card.cloneNode(true)));
    }

    function releaseStep() {
      const card = releaseTrack.querySelector('.release-card');
      const gap = parseFloat(getComputedStyle(releaseTrack).gap) || 0;
      return card ? card.getBoundingClientRect().width + gap : 0;
    }

    function updateReleaseCenter() {
      const count = releaseCards.length;
      const centerIndex = count > 3 ? (releaseIndex - 2 + 1 + count) % count : 1;
      releaseTrack.querySelectorAll('.release-card').forEach((card, index) => {
        card.classList.toggle('is-center', count > 3 ? (index - 2 + count) % count === centerIndex : index === centerIndex);
      });
    }

    function positionReleaseTrack(animate = true) {
      releaseTrack.style.transition = animate ? '' : 'none';
      releaseTrack.style.transform = `translate3d(${-releaseIndex * releaseStep()}px, 0, 0)`;
      updateReleaseCenter();
      if (!animate) {
        requestAnimationFrame(() => { releaseTrack.style.transition = ''; });
      }
    }

    function moveReleases(direction) {
      if (releaseAnimating || releaseCards.length <= 3) return;
      releaseAnimating = true;
      releaseIndex += direction;
      positionReleaseTrack();
    }

    function stopReleaseTimer() {
      if (releaseTimer) window.clearInterval(releaseTimer);
      releaseTimer = null;
    }

    function startReleaseTimer() {
      stopReleaseTimer();
      if (!reducedMotion.matches && releaseCards.length > 3) {
        releaseTimer = window.setInterval(() => moveReleases(1), 5200);
      }
    }

    releaseTrack.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'transform') return;
      releaseAnimating = false;
      if (releaseIndex >= releaseCards.length + 2) {
        releaseIndex = 2;
        positionReleaseTrack(false);
      } else if (releaseIndex < 2) {
        releaseIndex = releaseCards.length + 1;
        positionReleaseTrack(false);
      }
    });

    releasePrevious?.addEventListener('click', () => moveReleases(-1));
    releaseNext?.addEventListener('click', () => moveReleases(1));
    releaseCarousel.addEventListener('mouseenter', stopReleaseTimer);
    releaseCarousel.addEventListener('mouseleave', startReleaseTimer);
    releaseCarousel.addEventListener('focusin', stopReleaseTimer);
    releaseCarousel.addEventListener('focusout', (event) => {
      if (!releaseCarousel.contains(event.relatedTarget)) startReleaseTimer();
    });
    window.addEventListener('resize', () => positionReleaseTrack(false), { passive: true });
    reducedMotion.addEventListener?.('change', startReleaseTimer);
    positionReleaseTrack(false);
    startReleaseTimer();
  }

  const libraryGrid = document.querySelector('[data-library-grid]');
  if (libraryGrid) {
    libraryGrid.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      const item = event.target.closest('[data-library-item]');
      if (!item) return;
      const isActive = item.classList.contains('is-active');
      libraryGrid.querySelectorAll('[data-library-item]').forEach((entry) => {
        entry.classList.remove('is-active');
        entry.querySelector('.library-preview')?.setAttribute('aria-hidden', 'true');
      });
      if (!isActive) {
        item.classList.add('is-active');
        item.querySelector('.library-preview')?.setAttribute('aria-hidden', 'false');
      }
    });

    libraryGrid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('[data-library-item]');
      if (!item || event.target.closest('a')) return;
      event.preventDefault();
      item.click();
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-library-grid]')) return;
      libraryGrid.querySelectorAll('[data-library-item]').forEach((item) => item.classList.remove('is-active'));
    });
  }

  document.querySelectorAll('[data-post-like-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const original = button.innerHTML;
      button.disabled = true;
      try {
        const response = await fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const result = await readJsonResponse(response);
        button.classList.toggle('is-liked', result.liked);
        button.setAttribute('aria-pressed', String(result.liked));
        button.innerHTML = `<span aria-hidden="true">${result.liked ? '♥' : '♡'}</span><span class="action-label">${result.count} ${result.count === 1 ? 'Like' : 'Likes'}</span>`;
      } catch (error) {
        button.innerHTML = original;
        const notice = document.createElement('small');
        notice.className = 'async-error';
        notice.textContent = error.message || 'Could not update that action.';
        form.append(notice);
        window.setTimeout(() => notice.remove(), 2500);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-post-save-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const original = button.innerHTML;
      button.disabled = true;
      try {
        const response = await fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const result = await readJsonResponse(response);
        const saved = Boolean(result.saved);
        button.classList.toggle('is-saved', saved);
        button.setAttribute('aria-pressed', String(saved));
        button.innerHTML = `<span aria-hidden="true">${saved ? '🔖' : '📑'}</span><span class="action-label">${saved ? 'Saved' : 'Save'}</span>`;
      } catch (error) {
        button.innerHTML = original;
        const notice = document.createElement('small');
        notice.className = 'async-error';
        notice.textContent = error.message || 'Could not update that action.';
        form.append(notice);
        window.setTimeout(() => notice.remove(), 2500);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('.game-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const list = chip.closest('.game-chip-list');
      const hiddenInput = document.getElementById('composer-game-input');
      if (!list || !hiddenInput) return;
      list.querySelectorAll('.game-chip').forEach((item) => item.classList.toggle('is-selected', item === chip));
      hiddenInput.value = chip.dataset.gameId || '';
    });
  });

  document.querySelectorAll('[data-composer-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      const originalLabel = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Posting...';
      try {
        const response = await fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const result = await readJsonResponse(response);
        if (result.ok && result.post_html) {
          const list = document.querySelector('.post-list');
          if (list) {
            const firstEmpty = list.querySelector('.empty-state');
            if (firstEmpty) firstEmpty.remove();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = result.post_html.trim();
            const card = wrapper.firstElementChild;
            if (card) list.prepend(card);
          }
          form.reset();
          const hiddenFile = form.querySelector('input[type="file"]');
          if (hiddenFile) hiddenFile.value = '';
          const label = form.querySelector('.media-upload-button span:last-child');
          if (label) label.textContent = 'Add media';
          form.querySelectorAll('.game-chip').forEach((item) => item.classList.remove('is-selected'));
          const gameInput = document.getElementById('composer-game-input');
          if (gameInput) gameInput.value = '';
        }
      } catch (error) {
        const notice = document.createElement('small');
        notice.className = 'async-error';
        notice.textContent = error.message || 'Could not create the post.';
        form.append(notice);
        window.setTimeout(() => notice.remove(), 2500);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    });
  });

  document.querySelectorAll('[data-comment-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('textarea, input[name="body"]');
      const button = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[data-comment-status]');
      const list = document.querySelector('[data-comment-list]');
      if (!input || !list) return;
      const value = input.value.trim();
      if (!value) {
        status.textContent = 'Write a comment first.';
        return;
      }
      button.disabled = true;
      button.textContent = 'Posting...';
      status.textContent = 'Posting...';
      try {
        const response = await fetch(form.action || window.location.href, { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const result = await readJsonResponse(response);
        if (result.ok && result.comment_html) {
          const emptyState = list.querySelector('.empty-comment-state');
          if (emptyState) emptyState.remove();
          list.insertAdjacentHTML('beforeend', result.comment_html);
          input.value = '';
          status.textContent = 'Comment posted';
        }
      } catch (error) {
        status.textContent = error.message || 'Could not post the comment.';
      } finally {
        button.disabled = false;
        button.textContent = 'Comment';
      }
    });
  });

  document.querySelectorAll('.post-menu-button').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const panel = button.nextElementSibling;
      if (!panel) return;
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.post-menu-button').forEach((item) => {
        item.setAttribute('aria-expanded', 'false');
        const sibling = item.nextElementSibling;
        if (sibling) sibling.classList.remove('is-open');
      });
      button.setAttribute('aria-expanded', String(!isOpen));
      panel.classList.toggle('is-open', !isOpen);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.post-menu-button') && !event.target.closest('.post-menu-panel')) {
      document.querySelectorAll('.post-menu-button').forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
        const panel = button.nextElementSibling;
        if (panel) panel.classList.remove('is-open');
      });
    }
  });

  document.querySelectorAll('.copy-link-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = button.dataset.copyUrl;
      try {
        if (navigator.clipboard && url) {
          await navigator.clipboard.writeText(url);
          button.textContent = 'Link copied';
          setTimeout(() => { button.textContent = 'Share link'; }, 1200);
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        window.open(url || window.location.href, '_blank', 'noopener,noreferrer');
      }
    });
  });

  document.querySelectorAll('[data-composer-form] input[type="file"]').forEach((input) => {
    input.addEventListener('change', () => {
      const label = input.closest('.media-upload-control')?.querySelector('.media-upload-button span:last-child');
      if (label) {
        label.textContent = input.files && input.files.length ? input.files[0].name : 'Add media';
      }
    });
  });

  document.querySelectorAll('.feed-refresh-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      if (!button) return;
      button.disabled = true;
      button.classList.add('is-loading');
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!response.ok) throw new Error('Could not refresh the feed.');
        const refreshed = await fetch(window.location.href, { credentials: 'same-origin' });
        if (!refreshed.ok) throw new Error('Could not load the refreshed feed.');
        const html = await refreshed.text();
        const nextDocument = new DOMParser().parseFromString(html, 'text/html');
        const currentList = document.querySelector('.discovery-list');
        const nextList = nextDocument.querySelector('.discovery-list');
        if (currentList && nextList) currentList.replaceWith(nextList);
      } catch (error) {
        const notice = document.createElement('small');
        notice.className = 'async-error';
        notice.textContent = error.message || 'Could not refresh the feed.';
        form.append(notice);
        window.setTimeout(() => notice.remove(), 2500);
      } finally {
        button.disabled = false;
        button.classList.remove('is-loading');
      }
    });
  });

  document.querySelectorAll('[data-invite-form]').forEach((form) => {
    const search = form.querySelector('[data-invite-search]');
    const count = form.querySelector('[data-invite-count]');
    const rows = Array.from(form.querySelectorAll('[data-invite-player]'));
    const updateCount = () => {
      const selected = form.querySelectorAll('input[name="player_ids"]:checked').length;
      if (count) count.textContent = `${selected} selected`;
    };
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      rows.forEach((row) => {
        row.hidden = query.length > 0 && !row.dataset.playerName.includes(query);
      });
    });
    form.querySelectorAll('input[name="player_ids"]').forEach((input) => input.addEventListener('change', updateCount));
    updateCount();
  });

  const mapContainer = document.getElementById('ggz-map');
  if (mapContainer) {
    function getMapAuthFailureMessage() {
      return 'Google Maps authentication failed. Check that GOOGLE_MAPS_API_KEY is valid, enabled for the correct project, and permitted for this origin.';
    }

    window.gm_authFailure = function gmAuthFailure() {
      if (statusNode) {
        updateStatus(getMapAuthFailureMessage());
      }
      if (locationCard) {
        setLocationCard({
          name: 'Map authentication failed',
          location: 'The Google Maps API key is invalid, missing required APIs, or blocked by browser/domain restrictions.',
          rating_average: null,
          ggz_score: null,
          url: '#',
        });
      }
    };

    const statusNode = document.getElementById('map-status');
    const insightsNode = document.getElementById('map-insights');
    const locationCard = document.getElementById('radar-location-card');
    const layerInputs = Array.from(document.querySelectorAll('[data-layer]'));
    const modeButtons = Array.from(document.querySelectorAll('[data-map-mode]'));
    const searchInput = document.getElementById('radar-search-input');
    const categoryFilter = document.getElementById('radar-category-filter');
    const distanceFilter = document.getElementById('radar-distance-filter');
    const verifiedOnlyToggle = document.getElementById('radar-verified-only');
    const nearMeBtn = document.getElementById('near-me-btn');
    const legendToggle = document.getElementById('map-legend-toggle');
    const legend = document.getElementById('radar-legend');
    const defaultLat = Number(mapContainer.dataset.defaultLat || '-17.8252');
    const defaultLng = Number(mapContainer.dataset.defaultLng || '31.0335');
    const mapDataUrl = mapContainer.dataset.mapDataUrl || '/map-data/';
    const provider = (mapContainer.dataset.mapProvider || 'google').toLowerCase();
    const apiKey = mapContainer.dataset.mapKey || '';
    const mapId = mapContainer.dataset.mapId || '';
    let map = null;
    let renderMarkers = [];
    let clusterer = null;
    let lastData = null;
    let mapReadyPromise = null;
    let discoveryCoordinates = null;

    function updateStatus(message) {
      if (statusNode) statusNode.textContent = message;
    }

    function renderInsights(items) {
      if (!insightsNode) return;
      insightsNode.innerHTML = items.length ? items.map((item) => `<li>${item}</li>`).join('') : '<li>No public map markers in this view yet.</li>';
    }

    function getMarkerIcon(kind) {
      const icons = {
        hotspot: '🔥',
        location: '🎮',
        radar_location: '🎮',
        venue: '🎮',
        event: '🎪',
        tournament: '🏆',
        organization: '🏢',
        tech: '💻',
        developer: '👨‍💻',
      };
      return icons[kind] || '📍';
    }

    function getMarkerColor(kind) {
      const colors = {
        hotspot: '#f59e0b',
        location: '#60a5fa',
        radar_location: '#60a5fa',
        venue: '#60a5fa',
        event: '#a78bfa',
        tournament: '#f97316',
        organization: '#34d399',
        tech: '#2dd4bf',
        developer: '#f472b6',
      };
      return colors[kind] || '#8b5cf6';
    }

    function setLocationCard(item) {
      if (!locationCard) return;
      if (!item) {
        locationCard.innerHTML = '<p class="eyebrow">Selected location</p><h3>Choose a venue</h3><p class="muted">Select a marker or use the map filters to discover gaming hubs, tournaments, and events.</p>';
        return;
      }

      const ratingText = item.rating_average !== null && item.rating_average !== undefined ? `${Number(item.rating_average).toFixed(1)}` : 'No ratings yet';
      const ratingCount = item.rating_count || 0;
      const scoreText = item.ggz_score !== null && item.ggz_score !== undefined ? `${Number(item.ggz_score).toFixed(1)} / 10` : 'No score yet';
      const status = item.verification_status && String(item.verification_status).toUpperCase() === 'VERIFIED' ? '<span class="verified-badge">✓ Verified</span>' : '';
      const organizationUrl = item.organization_url && item.organization_url !== '#' ? item.organization_url : '';
      const actionUrl = organizationUrl
        ? `<a class="primary-button" href="${organizationUrl}">View Organization</a>`
        : item.url && item.url !== '#'
          ? `<a class="primary-button" href="${item.url}">View Hub</a>`
        : '<button type="button" class="primary-button" disabled>View Hub</button>';
      const directionsUrl = item.latitude && item.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}` : '#';
      const eventSummary = item.event_count ? `🎪 ${item.event_count} events` : '🎪 No events';
      const tournamentSummary = item.tournament_count ? `🏆 ${item.tournament_count} tournaments` : '🏆 No tournaments';

      locationCard.innerHTML = `
        <p class="eyebrow">Selected location</p>
        <h3>${item.name || 'GGz location'}</h3>
        ${status}
        <div class="radar-rating-row"><span class="stars">${item.rating_average ? '★★★★★' : '☆☆☆☆☆'}</span><span>${ratingText}</span></div>
        <div class="stat-stack">
          <div><strong>GGz Score</strong><span>${scoreText}</span></div>
          <div><strong>Location</strong><span>${item.location || item.city || 'Public venue'}</span></div>
          <div><strong>Activity</strong><span>${eventSummary}</span></div>
          <div><strong>Tournaments</strong><span>${tournamentSummary}</span></div>
        </div>
        ${item.description ? `<p class="muted radar-card-description">${item.description}</p>` : ''}
        <div class="stack-buttons">
          ${actionUrl}
          <a class="secondary-button" href="${directionsUrl}" target="_blank" rel="noopener">Directions</a>
        </div>
      `;
    }

    function getActiveLayers() {
      return new Set(layerInputs.filter((input) => input.checked).map((input) => input.dataset.layer));
    }

    function getCurrentRadarFilters() {
      return {
        query: (searchInput && searchInput.value || '').trim().toLowerCase(),
        category: (categoryFilter && categoryFilter.value || 'all').toLowerCase(),
        distance: Number(distanceFilter && distanceFilter.value || 100),
        verifiedOnly: Boolean(verifiedOnlyToggle && verifiedOnlyToggle.checked),
      };
    }

    function buildMapItems(data) {
      const activeLayers = getActiveLayers();
      const items = [];
      if (activeLayers.has('hotspots')) {
        for (const item of data.hotspots || []) {
          items.push({ ...item, kind: 'hotspot', icon: getMarkerIcon('hotspot'), label: 'Gamer Hotspot' });
        }
      }
      if (activeLayers.has('locations')) {
        for (const item of data.locations || []) {
          items.push({ ...item, kind: item.kind || 'radar_location', icon: getMarkerIcon('radar_location'), label: item.name, url: item.url || '#' });
        }
      }
      if (activeLayers.has('venues')) {
        for (const item of data.venues || []) {
          items.push({ ...item, kind: 'venue', icon: getMarkerIcon('venue'), label: item.name, url: item.url || '#' });
        }
      }
      if (activeLayers.has('events')) {
        for (const item of data.events || []) {
          items.push({ ...item, kind: 'event', icon: getMarkerIcon('event'), label: item.name, url: item.url || '#' });
        }
      }
      if (activeLayers.has('tournaments')) {
        for (const item of data.tournaments || []) {
          items.push({ ...item, kind: 'tournament', icon: getMarkerIcon('tournament'), label: item.name, url: item.url || '#' });
        }
      }
      if (activeLayers.has('organizations')) {
        for (const item of data.organizations || []) {
          items.push({ ...item, kind: 'organization', icon: getMarkerIcon('organization'), label: item.name, url: item.url || '#' });
        }
      }
      return items;
    }

    function applySearch(items) {
      const filters = getCurrentRadarFilters();
      let filtered = items;
      if (filters.query) {
        filtered = filtered.filter((item) => {
          const haystack = [
            item.name,
            item.location,
            item.city,
            item.game,
            item.organization,
            item.location_type,
            item.category,
            item.kind,
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(filters.query);
        });
      }
      if (filters.category && filters.category !== 'all') {
        filtered = filtered.filter((item) => {
          const kind = (item.kind || '').toLowerCase();
          const categoryText = [item.location_type, item.category, item.organization_type, item.kind].join(' ').toLowerCase();
          return categoryText.includes(filters.category) || kind === filters.category || kind.includes(filters.category);
        });
      }
      if (filters.verifiedOnly) {
        filtered = filtered.filter((item) => {
          const verification = (item.verification_status || '').toString().toLowerCase();
          return verification === 'verified';
        });
      }
      if (Number.isFinite(filters.distance) && filters.distance && filters.distance < 100) {
        filtered = filtered.filter((item) => {
          if (item.distance_km === null || item.distance_km === undefined) return true;
          return Number(item.distance_km) <= filters.distance;
        });
      }
      return filtered;
    }

    function ensureGoogleMaps() {
      if (provider !== 'google' || !apiKey) {
        return Promise.resolve(null);
      }
      if (window.google && window.google.maps) {
        return Promise.resolve(window.google);
      }
      if (!window.__ggzGoogleMapsLoader) {
        window.__ggzGoogleMapsLoader = { promise: null, error: null };
      }
      if (!window.__ggzGoogleMapsLoader.promise) {
        window.__ggzGoogleMapsLoader.promise = new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-ggz-google-map]');
          if (existing) {
            if (existing.dataset.ggzGoogleMapLoaded === 'true') {
              resolve(window.google || null);
              return;
            }
            existing.addEventListener('load', () => {
              existing.dataset.ggzGoogleMapLoaded = 'true';
              resolve(window.google || null);
            }, { once: true });
            existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker,places&loading=async`;
          script.async = true;
          script.defer = true;
          script.dataset.ggzGoogleMap = 'true';
          script.dataset.ggzGoogleMapLoaded = 'false';
          script.addEventListener('load', () => {
            script.dataset.ggzGoogleMapLoaded = 'true';
            window.__ggzGoogleMapsLoader.error = null;
            resolve(window.google || null);
          }, { once: true });
          script.addEventListener('error', () => {
            const message = 'Google Maps failed to load. Check that the key is valid, the Maps JavaScript API is enabled, and the app domain is allowed.';
            window.__ggzGoogleMapsLoader.error = message;
            reject(new Error(message));
          }, { once: true });
          document.head.appendChild(script);
        });
      }
      return window.__ggzGoogleMapsLoader.promise;
    }

    function ensureClustererLibrary() {
      const clustererCtor = window.MarkerClusterer || (window.markerClusterer && window.markerClusterer.MarkerClusterer);
      if (clustererCtor) {
        return Promise.resolve(clustererCtor);
      }
      return new Promise((resolve) => {
        const existing = document.querySelector('script[data-ggz-marker-clusterer]');
        if (existing) {
          existing.addEventListener('load', () => resolve(window.MarkerClusterer || (window.markerClusterer && window.markerClusterer.MarkerClusterer) || null), { once: true });
          existing.addEventListener('error', () => resolve(null), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.5.3/dist/index.umd.min.js';
        script.async = true;
        script.defer = true;
        script.dataset.ggzMarkerClusterer = 'true';
        script.addEventListener('load', () => resolve(window.MarkerClusterer || (window.markerClusterer && window.markerClusterer.MarkerClusterer) || null), { once: true });
        script.addEventListener('error', () => resolve(null), { once: true });
        document.head.appendChild(script);
      });
    }

    function buildPinElement(kind) {
      const color = getMarkerColor(kind);
      const pin = document.createElement('div');
      pin.className = 'ggz-marker-pin';
      pin.style.background = color;
      pin.style.borderColor = '#0f172a';
      pin.innerHTML = `<span>${getMarkerIcon(kind)}</span>`;
      return pin;
    }

    function createGoogleMarker(item) {
      if (!window.google || !window.google.maps || !window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        return null;
      }
      const markerElement = buildPinElement(item.kind);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: Number(item.latitude), lng: Number(item.longitude) },
        map,
        title: item.name || 'GGz location',
        content: markerElement,
      });
      marker.addListener('click', () => {
        setLocationCard(item);
        if (item.latitude && item.longitude && map) {
          map.panTo({ lat: Number(item.latitude), lng: Number(item.longitude) });
          map.setZoom(Math.max(map.getZoom(), 12));
        }
      });
      return marker;
    }

    async function renderMapMarkers(data) {
      if (!map || !window.google || !window.google.maps) {
        return;
      }
      const items = applySearch(buildMapItems(data));
      if (clusterer) {
        clusterer.clearMarkers();
      }
      renderMarkers.forEach((markerObj) => {
        if (markerObj && markerObj.setMap) markerObj.setMap(null);
      });
      renderMarkers = [];

      if (!items.length) {
        updateStatus('No public gaming markers in this view');
        renderInsights(['No gaming hubs, events, or tournaments match the current filters.']);
        setLocationCard(null);
        return;
      }

      const validItems = items.filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
      const markerObjects = validItems.map((item) => {
        const marker = createGoogleMarker(item);
        if (marker) {
          renderMarkers.push(marker);
        }
        return marker;
      }).filter(Boolean);

      if (window.MarkerClusterer || (window.markerClusterer && window.markerClusterer.MarkerClusterer)) {
        const ClustererCtor = window.MarkerClusterer || (window.markerClusterer && window.markerClusterer.MarkerClusterer);
        clusterer = new ClustererCtor({
          markers: markerObjects,
          map,
          algorithm: undefined,
        });
      } else {
        markerObjects.forEach((marker) => marker.setMap(map));
      }

      const bounds = new google.maps.LatLngBounds();
      validItems.forEach((item) => bounds.extend({ lat: Number(item.latitude), lng: Number(item.longitude) }));
      if (validItems.length) {
        map.fitBounds(bounds, 48);
      }
      updateStatus(`${validItems.length} public markers shown`);
      renderInsights([
        `${(data.hotspots || []).length} gamer hotspot${(data.hotspots || []).length === 1 ? '' : 's'} visible`,
        `${(data.locations || []).length} radar location${(data.locations || []).length === 1 ? '' : 's'}`,
        `${(data.events || []).length} event${(data.events || []).length === 1 ? '' : 's'}`,
        `${(data.tournaments || []).length} tournament${(data.tournaments || []).length === 1 ? '' : 's'}`,
      ]);
    }

    async function loadMapData(extraParams = {}) {
      updateStatus('Loading map data…');
      try {
        const params = new URLSearchParams({
          q: (searchInput && searchInput.value || '').trim(),
          category: (categoryFilter && categoryFilter.value || 'all'),
          distance: (distanceFilter && distanceFilter.value || '100'),
          verified: verifiedOnlyToggle && verifiedOnlyToggle.checked ? '1' : '0',
          ...extraParams,
        });
        if (discoveryCoordinates && !extraParams.lat) {
          params.set('lat', discoveryCoordinates.lat);
          params.set('lng', discoveryCoordinates.lng);
        }
        const response = await fetch(`${mapDataUrl}?${params.toString()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!response.ok) throw new Error('Map request failed');
        const data = await response.json();
        lastData = data;
        if (map) {
          renderMapMarkers(data);
        }
      } catch (error) {
        updateStatus('Interactive map unavailable');
        renderInsights(['The map is available with graceful fallback, but no public data was loaded.']);
      }
    }

    function activateMapMode(mode) {
      if (!map) return;
      modeButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.mapMode === mode));
      if (mode === 'road') {
        map.setMapTypeId('roadmap');
        map.setTilt(0);
      }
      if (mode === 'satellite') {
        map.setMapTypeId('satellite');
        map.setTilt(0);
      }
      if (mode === 'hybrid') {
        map.setMapTypeId('hybrid');
        map.setTilt(0);
      }
      if (mode === '3d') {
        if (window.google && window.google.maps && map.setTilt) {
          map.setTilt(45);
          map.setHeading(45);
          map.setMapTypeId('roadmap');
          updateStatus('3D tilt enabled where supported by the current provider configuration.');
        } else {
          updateStatus('3D map support is unavailable in this configuration.');
          map.setMapTypeId('roadmap');
        }
      }
      if (mode === 'street') {
        const panorama = map.getStreetView();
        if (panorama) {
          const target = { lat: map.getCenter().lat(), lng: map.getCenter().lng() };
          panorama.setPosition(target);
          panorama.setVisible(true);
          updateStatus('Street View is active for the current map center.');
        } else {
          updateStatus("Street View isn't available at this location.");
        }
        map.setMapTypeId('roadmap');
      }
    }

    function bindControls() {
      modeButtons.forEach((button) => {
        button.addEventListener('click', () => activateMapMode(button.dataset.mapMode));
      });

      layerInputs.forEach((input) => input.addEventListener('change', () => {
        if (!lastData) return;
        renderMapMarkers(lastData);
      }));

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          if (!lastData) return;
          renderMapMarkers(lastData);
        });
      }

      if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
          if (map) {
            loadMapData();
          }
        });
      }

      if (distanceFilter) {
        distanceFilter.addEventListener('change', () => {
          if (map) {
            loadMapData();
          }
        });
      }

      if (verifiedOnlyToggle) {
        verifiedOnlyToggle.addEventListener('change', () => {
          if (map) {
            loadMapData();
          }
        });
      }

      if (legendToggle && legend) {
        legendToggle.addEventListener('click', () => {
          const isHidden = legend.hasAttribute('hidden');
          legend.toggleAttribute('hidden', !isHidden);
        });
      }

      if (nearMeBtn) {
        nearMeBtn.addEventListener('click', () => {
          if (!navigator.geolocation) {
            updateStatus('Geolocation is unavailable in this browser');
            return;
          }
          updateStatus('Requesting your location…');
          navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            discoveryCoordinates = { lat, lng };
            if (map) {
              map.setCenter({ lat, lng });
              map.setZoom(12);
            }
            loadMapData({ lat, lng });
            updateStatus('Nearby gaming results focused around your location');
          }, () => {
            updateStatus('Location access denied. Manual search and map navigation remain available.');
          }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          });
        });
      }
    }

    async function initMap() {
      if (provider !== 'google' || !apiKey) {
        updateStatus('Interactive map unavailable');
        renderInsights(['Map service is not configured. GGz still exposes public venue and event data in the Radar list and detail views.']);
        return;
      }

      try {
        await ensureGoogleMaps();
        if (!window.google || !window.google.maps) {
          throw new Error('Google Maps library is unavailable');
        }
        await ensureClustererLibrary();

        const mapOptions = {
          center: { lat: defaultLat, lng: defaultLng },
          zoom: 11,
          mapId: mapId || 'GGZ_RADAR_MAP',
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          disableDefaultUI: false,
          mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
          },
        };
        map = new google.maps.Map(mapContainer, mapOptions);
        bindControls();
        map.addListener('zoom_changed', () => {
          if (lastData) renderMapMarkers(lastData);
        });
        updateStatus('Map ready');
        await loadMapData();
      } catch (error) {
        updateStatus('Interactive map unavailable');
        if (locationCard) {
          setLocationCard({
            name: 'Map unavailable',
            location: 'Public venue information remains available in the GGz data layer.',
            rating_average: null,
            ggz_score: null,
            url: '#',
          });
        }
        renderInsights(['The provider is unavailable or misconfigured. Public GGz venue and event data remain available in the rest of the app.']);
      }
    }

    bindControls();
    initMap();
  }

  const picker = document.querySelector('[data-map-picker]');
  if (picker) {
    const pickerMapNode = document.getElementById('location-picker-map');
    const pickerStatus = document.getElementById('location-picker-status');
    const pickerSearch = document.getElementById('location-address-search');
    const pickerButton = document.getElementById('location-address-search-button');
    const currentLocationButton = document.getElementById('location-current-location-button');
    const pickerMapButtons = Array.from(document.querySelectorAll('[data-picker-map-type]'));
    const latitudeInput = document.getElementById('id_latitude');
    const longitudeInput = document.getElementById('id_longitude');
    const pickerProvider = (picker.dataset.mapProvider || 'google').toLowerCase();
    const pickerKey = picker.dataset.mapKey || '';
    const pickerMapId = picker.dataset.mapId || '';
    const pickerCenter = { lat: Number(picker.dataset.defaultLat || '-17.8252'), lng: Number(picker.dataset.defaultLng || '31.0335') };
    let pickerMap = null;
    let pickerMarker = null;

    const setPickerStatus = (message) => {
      if (pickerStatus) pickerStatus.textContent = message;
    };

    const getPickerFailureMessage = () => 'Google Maps is unavailable. Check that GOOGLE_MAPS_API_KEY is valid, the Maps JavaScript API is enabled, and this origin is allowed in the Google Cloud project.';

    const loadPickerMaps = () => {
      if (window.google && window.google.maps) return Promise.resolve(window.google);
      if (!pickerKey || pickerProvider !== 'google') return Promise.resolve(null);
      if (!window.__ggzGoogleMapsLoader) {
        window.__ggzGoogleMapsLoader = { promise: null, error: null };
      }
      if (!window.__ggzGoogleMapsLoader.promise) {
        window.__ggzGoogleMapsLoader.promise = new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-ggz-google-map]');
          if (existing) {
            existing.addEventListener('load', () => resolve(window.google), { once: true });
            existing.addEventListener('error', () => reject(new Error(getPickerFailureMessage())), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(pickerKey)}&v=weekly&libraries=marker,places&loading=async`;
          script.async = true;
          script.defer = true;
          script.dataset.ggzGoogleMap = 'true';
          script.addEventListener('load', () => resolve(window.google), { once: true });
          script.addEventListener('error', () => reject(new Error(getPickerFailureMessage())), { once: true });
          document.head.appendChild(script);
        });
      }
      return window.__ggzGoogleMapsLoader.promise;
    };

    const setPickerCoordinates = (position) => {
      const latValue = typeof position?.lat === 'function' ? position.lat() : Number(position?.lat);
      const lngValue = typeof position?.lng === 'function' ? position.lng() : Number(position?.lng);
      const lat = Number(latValue);
      const lng = Number(lngValue);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        if (latitudeInput) latitudeInput.value = lat.toFixed(6);
        if (longitudeInput) longitudeInput.value = lng.toFixed(6);
      }
      if (pickerMap && Number.isFinite(lat) && Number.isFinite(lng)) pickerMap.panTo({ lat, lng });
      const addressText = (pickerSearch && pickerSearch.value && pickerSearch.value.trim()) ? pickerSearch.value.trim() : 'map selection';
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setPickerStatus(`Location selected: ${addressText} — ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    };

    const placePickerMarker = (position) => {
      if (!window.google || !window.google.maps || !window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        setPickerStatus('Advanced Marker support is unavailable for this map configuration.');
        return;
      }
      const nextPosition = { lat: Number(position.lat), lng: Number(position.lng) };
      if (!Number.isFinite(nextPosition.lat) || !Number.isFinite(nextPosition.lng)) {
        return;
      }
      if (pickerMarker) pickerMarker.map = null;
      pickerMarker = new google.maps.marker.AdvancedMarkerElement({ map: pickerMap, position: nextPosition, gmpDraggable: true, title: 'Radar location' });
      pickerMarker.addListener('dragend', (event) => {
        if (event.latLng) setPickerCoordinates(event.latLng);
      });
      setPickerCoordinates(nextPosition);
    };

    const syncManualCoordinates = () => {
      const lat = Number(latitudeInput && latitudeInput.value);
      const lng = Number(longitudeInput && longitudeInput.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setPickerStatus('Latitude and longitude must be valid map coordinates.');
        return;
      }
      if (pickerMap) pickerMap.panTo({ lat, lng });
      placePickerMarker({ lat, lng });
    };

    const setPickerMapType = (type) => {
      if (!pickerMap) return;
      const nextType = type === 'satellite' ? 'satellite' : 'roadmap';
      pickerMap.setMapTypeId(nextType);
      pickerMapButtons.forEach((button) => {
        const isActive = button.dataset.pickerMapType === type;
        button.classList.toggle('is-active', isActive);
      });
    };

    const initPicker = async () => {
      try {
        await loadPickerMaps();
        if (!window.google || !window.google.maps) {
          setPickerStatus('Map configuration is unavailable. Add a valid GOOGLE_MAPS_API_KEY and enable the required Google Maps APIs before using the location picker.');
          return;
        }
        pickerMap = new google.maps.Map(pickerMapNode, {
          center: pickerCenter,
          zoom: 13,
          mapId: pickerMapId || 'GGZ_RADAR_MAP',
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
          },
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        const existingLat = Number(latitudeInput && latitudeInput.value);
        const existingLng = Number(longitudeInput && longitudeInput.value);
        if (Number.isFinite(existingLat) && Number.isFinite(existingLng)) placePickerMarker({ lat: existingLat, lng: existingLng });
        pickerMap.addListener('click', (event) => { if (event.latLng) placePickerMarker({ lat: event.latLng.lat(), lng: event.latLng.lng() }); });
        pickerMapButtons.forEach((button) => {
          button.addEventListener('click', () => setPickerMapType(button.dataset.pickerMapType));
        });
        setPickerMapType('roadmap');
        setPickerStatus('Search an address, click the map, or use current location to place the marker.');
      } catch (error) {
        setPickerStatus(getPickerFailureMessage());
      }
    };

    const geocodeAddress = async (query) => {
      const useGoogleGeocoder = window.google && window.google.maps && google.maps.Geocoder;
      if (useGoogleGeocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: query }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const result = results[0];
            pickerSearch.value = result.formatted_address;
            pickerMap.setZoom(16);
            placePickerMarker({ lat: result.geometry.location.lat(), lng: result.geometry.location.lng() });
            setPickerStatus(`Location selected: ${result.formatted_address} — ${result.geometry.location.lat().toFixed(5)}, ${result.geometry.location.lng().toFixed(5)}`);
            return;
          }
          fallbackToNominatim(query);
        });
        return;
      }
      fallbackToNominatim(query);
    };

    const fallbackToNominatim = async (query) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
          headers: { 'Accept-Language': 'en' },
        });
        if (!response.ok) throw new Error('Address lookup failed');
        const results = await response.json();
        if (!results || !results[0]) {
          setPickerStatus('No address found. Try a nearby landmark or city.');
          return;
        }
        const result = results[0];
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setPickerStatus('No address found. Try a nearby landmark or city.');
          return;
        }
        pickerSearch.value = result.display_name;
        if (pickerMap) {
          pickerMap.setZoom(16);
          pickerMap.panTo({ lat, lng });
        }
        placePickerMarker({ lat, lng });
        setPickerStatus(`Location selected: ${result.display_name} — ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch (error) {
        setPickerStatus('No address found. Try a nearby landmark or city.');
      }
    };

    if (pickerButton && pickerSearch) {
      pickerButton.addEventListener('click', async () => {
        if (!pickerMap || !window.google || !window.google.maps) return setPickerStatus(getPickerFailureMessage());
        const query = pickerSearch.value.trim();
        if (!query) return setPickerStatus('Enter an address to search.');
        await geocodeAddress(query);
      });
    }

    if (currentLocationButton) {
      currentLocationButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
          setPickerStatus('Browser geolocation is unavailable. You can still click the map or enter coordinates manually.');
          return;
        }
        setPickerStatus('Requesting your current location…');
        navigator.geolocation.getCurrentPosition((position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (pickerMap) {
            pickerMap.setCenter({ lat, lng });
            pickerMap.setZoom(15);
          }
          placePickerMarker({ lat, lng });
          setPickerStatus(`Current location selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }, () => {
          setPickerStatus('Current location access was denied. You can still use the map or enter coordinates manually.');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
      });
    }

    if (latitudeInput) latitudeInput.addEventListener('change', syncManualCoordinates);
    if (longitudeInput) longitudeInput.addEventListener('change', syncManualCoordinates);

    initPicker();
  }
})();