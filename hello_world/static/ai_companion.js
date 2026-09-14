document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('companion-form');
  const textarea = document.getElementById('companion-message');
  const responseBox = document.getElementById('companion-response');
  const resetButton = document.querySelector('[data-companion-reset]');
  const historyKey = 'ggz-companion-history';
  if (!form || !textarea || !responseBox) return;

  const history = () => { try { return JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch (error) { return []; } };
  const saveHistory = (entry) => { try { localStorage.setItem(historyKey, JSON.stringify([...history().slice(-9), entry])); } catch (error) { /* Storage is optional. */ } };
  const historyList = document.querySelector('[data-companion-history-list]');
  const renderHistory = () => {
    if (!historyList) return;
    const items = history();
    historyList.replaceChildren();
    if (!items.length) {
      const current = document.createElement('span');
      current.className = 'companion-history-item is-active';
      current.textContent = 'Current conversation';
      historyList.append(current);
      return;
    }
    items.slice(-6).reverse().forEach((entry) => {
      const item = document.createElement('span');
      item.className = 'companion-history-item';
      item.title = entry.message;
      item.textContent = entry.message.length > 26 ? entry.message.slice(0, 26) + '…' : entry.message;
      item.addEventListener('click', () => { textarea.value = entry.message; textarea.focus(); });
      historyList.append(item);
    });
  };
  renderHistory();
  document.querySelectorAll('[data-companion-prompt]').forEach((prompt) => prompt.addEventListener('click', () => { textarea.value = prompt.dataset.companionPrompt; textarea.focus(); form.requestSubmit(); }));
  resetButton?.addEventListener('click', () => {
    const csrfToken = form.querySelector('input[name="csrfmiddlewaretoken"]')?.value || '';
    fetch(form.action, { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'reset=1' })
      .catch(() => {})
      .finally(() => { try { localStorage.removeItem(historyKey); } catch (error) { /* Storage is optional. */ } renderHistory(); responseBox.replaceChildren(); const reset = document.createElement('p'); reset.textContent = 'New chat ready. What should we explore?'; responseBox.append(reset); textarea.value = ''; textarea.focus(); });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const message = textarea.value.trim();
    if (!message) {
      responseBox.replaceChildren();
      const notice = document.createElement('p');
      notice.textContent = 'Please ask a question so GGz Companion can help.';
      responseBox.append(notice);
      textarea.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Searching...';

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error || 'Unable to get a response.');
        }
        responseBox.replaceChildren();
        const reply = document.createElement('p');
        reply.textContent = result.response || 'I can help you with that.';
        responseBox.append(reply);
        const results = document.createElement('div');
        results.className = 'companion-results';
        Object.entries(result.results || {}).forEach(([kind, items]) => {
          items.forEach((item) => {
            const link = document.createElement('a');
            link.className = 'companion-result';
            link.href = item.url;
            link.textContent = item.name || item.title || item.gamer_tag;
            results.append(link);
          });
        });
        responseBox.append(results);
        if (result.action) {
          const action = document.createElement('div');
          action.className = 'companion-action-card';
          action.innerHTML = `<strong></strong><div><button type="button" class="button button-primary" data-companion-confirm>Confirm</button><button type="button" class="button button-secondary" data-companion-cancel>Cancel</button></div>`;
          action.querySelector('strong').textContent = result.action.label;
          action.querySelector('[data-companion-confirm]').addEventListener('click', async () => {
            const confirmButton = action.querySelector('[data-companion-confirm]');
            confirmButton.disabled = true;
            try {
              const response = await fetch(result.action.url, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ csrfmiddlewaretoken: form.querySelector('input[name="csrfmiddlewaretoken"]')?.value || '' }) });
              const payload = await response.json();
              if (!response.ok || payload.ok === false) throw new Error(payload.error || 'The action could not be completed.');
              action.replaceChildren();
              const done = document.createElement('span'); done.textContent = `Confirmed: ${result.action.target} is now followed.`; action.append(done);
            } catch (error) { confirmButton.disabled = false; confirmButton.textContent = error.message; }
          });
          action.querySelector('[data-companion-cancel]').addEventListener('click', () => action.remove());
          responseBox.append(action);
        }
        saveHistory({ message, response: result.response || '' });
        renderHistory();
        textarea.value = '';
      })
      .catch((error) => {
        responseBox.replaceChildren();
        const failure = document.createElement('p');
        failure.textContent = error.message || 'A quick assist is unavailable right now.';
        responseBox.append(failure);
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = originalText;
        textarea.focus();
      });
  });
});