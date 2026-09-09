#!/usr/bin/env bash
set -euo pipefail

# Run from the root of GGz-Zimbabwe at the efcdb99-or-newer checkout.
# This patch never runs migrations or changes the database.

python - <<'PY'
from pathlib import Path

ROOT = Path.cwd()
BASE = ROOT / 'hello_world/templates/base.html'
INDEX = ROOT / 'hello_world/templates/index.html'
CSS = ROOT / 'hello_world/static/ggz_stability.css'
JS = ROOT / 'hello_world/static/ggz_stability.js'

for p in (BASE, INDEX):
    if not p.exists():
        raise SystemExit(f'Missing expected file: {p}')

base = BASE.read_text(encoding='utf-8')
index = INDEX.read_text(encoding='utf-8')

link = "    <link rel=\"stylesheet\" href=\"{% static 'ggz_stability.css' %}\">"
anchor = '    <link rel="stylesheet" href="{% static \'main.css\' %}">'
if 'ggz_stability.css' not in base:
    if anchor not in base:
        raise SystemExit('main.css link anchor not found in base.html')
    base = base.replace(anchor, anchor + '\n' + link, 1)

script = "    <script src=\"{% static 'ggz_stability.js' %}\" defer></script>"
anchor_script = "    <script src=\"{% static 'main.js' %}\" defer></script>"
if 'ggz_stability.js' not in base:
    if anchor_script not in base:
        raise SystemExit('main.js script anchor not found in base.html')
    base = base.replace(anchor_script, anchor_script + '\n' + script, 1)

hero_old = '    <section class="hero-shell">\n        <div class="hero-copy">'
hero_new = '''    <section class="hero-shell">\n        {% if ambient_media %}\n            <div class="ggz-hero-media" aria-hidden="true">\n                {% for media_url in ambient_media %}\n                    <img src="{{ media_url }}" alt=""{% if not forloop.first %} loading="lazy"{% endif %} referrerpolicy="no-referrer">\n                {% endfor %}\n            </div>\n        {% endif %}\n        <div class="hero-copy">'''
if 'ggz-hero-media' not in index:
    if hero_old not in index:
        raise SystemExit('Hero anchor not found in index.html')
    index = index.replace(hero_old, hero_new, 1)

BASE.write_text(base, encoding='utf-8')
INDEX.write_text(index, encoding='utf-8')

CSS.write_text(r'''/* GGz stability layer: loaded after main.css. */
.ggz-ambient-media { z-index: 0 !important; pointer-events: none !important; }
.site-nav { position: sticky; z-index: 1000 !important; }
.site-nav .nav-container,
.site-nav .nav-menu,
.site-nav .nav-tools,
.site-nav .nav-dropdown,
.site-nav .nav-profile { position: relative; z-index: 1001; }
.site-nav .nav-dropdown-panel,
.site-nav .nav-profile-panel { z-index: 1100 !important; }
.site-shell,
.site-footer { position: relative; z-index: 2; }

.ggz-home .hero-shell { isolation: isolate; overflow: hidden; }
.ggz-home .hero-shell::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
        radial-gradient(circle at 76% 18%, rgba(139,92,246,.28), transparent 38%),
        linear-gradient(90deg, rgba(10,14,17,.10), rgba(10,14,17,0) 45%, rgba(10,14,17,.34));
}
.ggz-hero-media {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: grid;
    grid-template-columns: 1.4fr 1fr .82fr;
    gap: .55rem;
    overflow: hidden;
    opacity: .50;
    pointer-events: none;
}
.ggz-hero-media::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    background:
        linear-gradient(90deg, rgba(83,48,158,.34), rgba(83,48,158,.05) 42%, rgba(7,9,13,.26)),
        linear-gradient(180deg, rgba(10,12,18,.02), rgba(10,12,18,.62));
}
.ggz-hero-media img {
    width: 100%;
    height: 100%;
    min-width: 0;
    object-fit: cover;
    filter: saturate(.92) contrast(1.05);
    transform: scale(1.03);
}
.ggz-home .hero-copy,
.ggz-home .hero-panel { position: relative; z-index: 3; }
.ggz-home .hero-copy { text-shadow: 0 1px 18px rgba(0,0,0,.28); }
.ggz-home .hero-panel {
    background: rgba(10,14,20,.74);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}
@media (max-width: 800px) {
    .ggz-hero-media { grid-template-columns: 1fr .82fr; opacity: .36; }
    .ggz-hero-media img:nth-child(3) { display: none; }
}
@media (prefers-reduced-motion: reduce) {
    .ggz-hero-media img { transform: none; }
}
''', encoding='utf-8')

JS.write_text(r'''(() => {
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
      if (result.following) {
        form.action = form.action.replace('/follow/', '/unfollow/');
        if (label) label.textContent = 'Following';
      } else {
        form.action = form.action.replace('/unfollow/', '/follow/');
        if (label) label.textContent = 'Follow';
      }
      if (button) {
        button.innerHTML = result.following ? '<span aria-hidden="true">✓</span> <span data-follow-label>Following</span>' : '<span aria-hidden="true">+</span> <span data-follow-label>Follow</span>';
        button.setAttribute('aria-pressed', String(Boolean(result.following)));
      }
      updateBadge('[data-followers-count]', result.follower_count);
      const container = form.closest('[data-profile-actions]');
      if (container && result.message_state) renderMessageActions(container, result);
      showStatus(form, '');
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
''', encoding='utf-8')

print('GGz stability patch files written.')
PY

echo "Patch prepared. In your Codespace run:"
echo "  cd /workspaces/GGz-Zimbabwe"
echo "  bash /mnt/data/GGz_stability_patch.sh"
echo "  python manage.py check"
echo "  python manage.py check --deploy"
echo "  python manage.py makemigrations --check"
echo "  python manage.py test"
echo "  git diff --check"
echo "  node --check hello_world/static/main.js"
echo "  node --check hello_world/static/ggz_stability.js"
echo "  python manage.py collectstatic --noinput"
echo "  git status --short"
echo "  git diff --stat"
echo "  git add . && git commit -m 'fix: stabilize social actions and home media layering' && git push origin main"
