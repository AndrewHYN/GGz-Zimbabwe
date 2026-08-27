(() => {
  const menuButton = document.querySelector('.mobile-menu-toggle');
  const nav = document.querySelector('#primary-navigation');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('is-open', !expanded);
    });
    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target) && !menuButton.contains(event.target)) {
        menuButton.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        menuButton.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  document.querySelectorAll('.account-menu, .nav-more').forEach((menu) => {
    menu.addEventListener('click', (event) => event.stopPropagation());
    menu.addEventListener('toggle', () => {
      const summary = menu.querySelector('summary');
      if (summary) summary.setAttribute('aria-expanded', String(menu.open));
      if (!menu.open) return;
      document.querySelectorAll('.account-menu, .nav-more').forEach((otherMenu) => {
        if (otherMenu !== menu) otherMenu.removeAttribute('open');
      });
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.account-menu, .nav-more').forEach((menu) => menu.removeAttribute('open'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelectorAll('.account-menu, .nav-more').forEach((menu) => menu.removeAttribute('open'));
  });

  document.querySelectorAll('form[action*="/like/"]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const original = button.innerHTML;
      button.disabled = true;
      try {
        const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!response.ok) throw new Error('Request failed');
        const result = await response.json();
        button.classList.toggle('is-liked', result.liked);
        button.setAttribute('aria-pressed', String(result.liked));
        button.innerHTML = `<span aria-hidden="true">${result.liked ? '&#9829;' : '&#9825;'}</span> ${result.count} ${result.count === 1 ? 'Like' : 'Likes'}`;
      } catch (error) {
        button.innerHTML = original;
        const notice = document.createElement('small');
        notice.className = 'async-error';
        notice.textContent = 'Could not update that action.';
        form.append(notice);
        window.setTimeout(() => notice.remove(), 2500);
      } finally {
        button.disabled = false;
      }
    });
  });
})();