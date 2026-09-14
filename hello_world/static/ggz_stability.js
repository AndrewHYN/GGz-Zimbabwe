(() => {
  'use strict';

  // This file is loaded after main.js but handles submit events in capture phase,
  // so one stable path owns profile follow/message mutations in the browser.
  const cookie = (name) => {
    const prefix = `${name}=`;
    const item = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    return item ? decodeURIComponent(item.slice(prefix.length)) : '';
  };

  const jsonRequest = (form) => fetch(form.action, {
    method: 'POST',
    body: new FormData(form),
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': cookie('csrftoken'),
    },
  }).then(async (response) => {
    const body = await response.text();
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      throw new Error(response.redirected ? 'Your session expired. Refresh the page and try again.' : `Request failed (${response.status}).`);
    }
    let payload;
    try { payload = body ? JSON.parse(body) : {}; }
    catch (_) { throw new Error('The server returned an unexpected response.'); }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return payload;
  });

  const updateBadge = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => {
      const number = Number(value || 0);
      node.textContent = String(number);
      node.hidden = number < 1;
    });
  };

  const renderMessageActions = (container, state) => {
    const actions = container?.querySelector('[data-message-actions]');
    if (!actions) return;
    const urls = container.dataset;
    const token = cookie('csrftoken');
    const input = () => `<input type="hidden" name="csrfmiddlewaretoken" value="${token}">`;
    const form = (action, text) => `<form method="post" action="${action}" class="inline-action" data-ggz-social-mutation>${input()}<button class="icon-action" type="submit">${text}</button></form>`;

    if (state.message_state === 'direct') {
      actions.innerHTML = form(urls.messageUrl, '<span aria-hidden="true">✉</span> Message');
    } else if (state.request_state === 'incoming') {
      actions.innerHTML = form(urls.requestAcceptUrl, 'Accept request') + form(urls.requestDeclineUrl, 'Decline');
    } else if (state.request_state === 'outgoing') {
      actions.innerHTML = '<span class="icon-action" aria-live="polite">Request sent</span>' + form(urls.requestCancelUrl, 'Cancel request');
    } else if (state.message_state === 'blocked') {
      actions.textContent = 'Messaging unavailable';
    } else {
      actions.innerHTML = form(urls.messageUrl, '<span aria-hidden="true">✉</span> Message');
    }
  };

  const showStatus = (form, text, error = false) => {
    let node = form.querySelector('.ggz-async-status');
    if (!node) {
      node = document.createElement('span');
      node.className = 'ggz-async-status';
      form.appendChild(node);
    }
    node.textContent = text || '';
    node.setAttribute('role', error ? 'alert' : 'status');
  };

  const handleFollow = async (form) => {
    const button = form.querySelector('button[type="submit"]');
    const label = form.querySelector('[data-follow-label]');
    const currentFollowing = form.action.includes('/unfollow/');
    if (button) { button.disabled = true; button.classList.add('is-loading'); }
    if (label) label.textContent = currentFollowing ? 'Unfollowing...' : 'Following...';
    try {
      const result = await jsonRequest(form);
      const followText = result.friends ? 'Friends' : result.following ? 'Following' : result.followed_by ? 'Follow back' : 'Follow';
      if (result.following) {
        form.action = form.action.replace('/follow/', '/unfollow/');
      } else {
        form.action = form.action.replace('/unfollow/', '/follow/');
      }
      if (button) {
        button.innerHTML = result.following ? `<span aria-hidden="true">✓</span> <span data-follow-label>${followText}</span>` : `<span aria-hidden="true">+</span> <span data-follow-label>${followText}</span>`;
        button.setAttribute('aria-pressed', String(Boolean(result.following)));
      } else if (label) {
        label.textContent = followText;
      }
      if (result.friends) {
        showStatus(form, "You're now Friends!");
      } else {
        showStatus(form, '');
      }
      updateBadge('[data-followers-count]', result.follower_count);
      const container = form.closest('[data-profile-actions]');
      if (container && result.message_state) renderMessageActions(container, result);
    } catch (error) {
      if (label) label.textContent = currentFollowing ? 'Following' : 'Follow';
      showStatus(form, error.message || 'Could not update the follow state.', true);
    } finally {
      if (button) { button.disabled = false; button.classList.remove('is-loading'); }
    }
  };

  const handleMutation = async (form) => {
    const button = form.querySelector('button[type="submit"]');
    const original = button?.innerHTML || '';
    if (button) { button.disabled = true; button.classList.add('is-loading'); button.textContent = 'Saving...'; }
    try {
      const result = await jsonRequest(form);
      const container = form.closest('[data-profile-actions]');
      if (container && result.message_state) renderMessageActions(container, result);
      if (result.url) window.location.assign(result.url);
      else if (result.conversation_id) window.location.assign(`/messages/${result.conversation_id}/`);
      else showStatus(form, result.message || result.status || 'Saved');
    } catch (error) {
      if (button) { button.innerHTML = original; button.disabled = false; button.classList.remove('is-loading'); }
      showStatus(form, error.message || 'Could not complete that action.', true);
    }
  };

  document.addEventListener('submit', (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) return;
    if (form.matches('[data-async-action][data-follow-form]')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void handleFollow(form);
    } else if (form.matches('[data-async-mutation], [data-ggz-social-mutation]')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void handleMutation(form);
    }
  }, true);

  // Keep profile action markup synchronized after the initial page render.
  const container = document.querySelector('[data-profile-actions]');
  if (container) {
    const state = {
      message_state: container.dataset.messageState || 'request',
      request_state: container.dataset.requestState || 'none',
    };
    renderMessageActions(container, state);
  }
})();

(function () {
  const root = document.documentElement;
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  if (!toggles.length) return;
  const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem('ggz-theme', theme); } catch (e) { /* storage unavailable */ }
    toggles.forEach((btn) => {
      const isLight = theme === 'light';
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    });
  };
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light'));
  });
  applyTheme(currentTheme());
})();
