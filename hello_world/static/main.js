(() => {
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

  const mapContainer = document.getElementById('ggz-map');
  if (mapContainer) {
    const statusNode = document.getElementById('map-status');
    const insightsNode = document.getElementById('map-insights');
    const layerInputs = Array.from(document.querySelectorAll('[data-layer]'));
    const defaultLat = Number(mapContainer.dataset.defaultLat || '-17.8252');
    const defaultLng = Number(mapContainer.dataset.defaultLng || '31.0335');
    const mapDataUrl = mapContainer.dataset.mapDataUrl || '/map-data/';
    const provider = mapContainer.dataset.mapProvider || 'osm';
    const apiKey = mapContainer.dataset.mapKey || '';

    function updateStatus(message) {
      if (statusNode) statusNode.textContent = message;
    }

    function renderInsights(items) {
      if (!insightsNode) return;
      insightsNode.innerHTML = items.length ? items.map((item) => `<li>${item}</li>`).join('') : '<li>No public map markers in this view yet.</li>';
    }

    function createMarker(icon, label, lat, lng, detail) {
      const marker = document.createElement('div');
      marker.className = 'marker-pin';
      marker.textContent = icon;
      marker.title = label;
      marker.dataset.detail = detail;
      marker.style.left = '50%';
      marker.style.top = '50%';
      marker.style.position = 'absolute';
      marker.style.transform = 'translate(-50%, -50%)';
      marker.style.fontSize = '1.1rem';
      marker.style.cursor = 'pointer';
      marker.style.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,.35))';
      return marker;
    }

    function drawMap(data) {
      const activeLayers = new Set(layerInputs.filter((input) => input.checked).map((input) => input.dataset.layer));
      mapContainer.innerHTML = '';
      mapContainer.style.position = 'relative';
      mapContainer.style.minHeight = '460px';
      mapContainer.style.background = 'linear-gradient(135deg, #0b1012 0%, #0f1d1d 100%)';
      mapContainer.style.border = '1px solid var(--line)';
      mapContainer.style.borderRadius = '18px';
      mapContainer.style.overflow = 'hidden';
      mapContainer.style.boxShadow = 'var(--shadow)';

      const world = document.createElement('div');
      world.style.position = 'absolute';
      world.style.inset = '0';
      world.style.background = 'radial-gradient(circle at center, rgba(200, 241, 105, 0.12), transparent 52%), linear-gradient(180deg, rgba(23,30,33,.2), rgba(9,12,13,.2))';
      mapContainer.appendChild(world);

      if (!activeLayers.size) {
        updateStatus('No layers enabled');
        renderInsights(['Enable one or more map layers to reveal the GGz discovery board.']);
        return;
      }

      const items = [];
      if (activeLayers.has('hotspots')) items.push(...(data.hotspots || []).map((hotspot) => ({ ...hotspot, category: 'hotspot', icon: '🔥', label: 'Gamer Hotspot' })));
      if (activeLayers.has('venues')) items.push(...(data.venues || []).map((venue) => ({ ...venue, category: 'venue', icon: '🎮', label: venue.name })));
      if (activeLayers.has('tournaments')) items.push(...(data.tournaments || []).map((tournament) => ({ ...tournament, category: 'tournament', icon: '🏆', label: tournament.name })));
      if (activeLayers.has('events')) items.push(...(data.events || []).map((event) => ({ ...event, category: 'event', icon: '📅', label: event.name })));
      if (activeLayers.has('organizations')) items.push(...(data.organizations || []).map((organization) => ({ ...organization, category: 'organization', icon: '🏢', label: organization.name })));

      if (!items.length) {
        updateStatus('No public map markers right now');
        renderInsights(['The map is healthy and empty. Add public venue, tournament, event, or hotspot data to populate it.']);
        return;
      }

      const bounds = items.reduce((acc, item) => {
        acc.minLat = Math.min(acc.minLat, Number(item.latitude));
        acc.maxLat = Math.max(acc.maxLat, Number(item.latitude));
        acc.minLng = Math.min(acc.minLng, Number(item.longitude));
        acc.maxLng = Math.max(acc.maxLng, Number(item.longitude));
        return acc;
      }, { minLat: Number.MAX_SAFE_INTEGER, maxLat: Number.MIN_SAFE_INTEGER, minLng: Number.MAX_SAFE_INTEGER, maxLng: Number.MIN_SAFE_INTEGER });

      const centerX = ((bounds.minLng + bounds.maxLng) / 2 - defaultLng) * 110000;
      const centerY = ((defaultLat - ((bounds.minLat + bounds.maxLat) / 2)) * 110000) * 0.7;

      items.forEach((item) => {
        const x = ((Number(item.longitude) - defaultLng) * 110000) - centerX + 18;
        const y = ((defaultLat - Number(item.latitude)) * 110000 * 0.7) - centerY + 18;
        const marker = createMarker(item.icon, item.label, Number(item.latitude), Number(item.longitude), item);
        marker.style.position = 'absolute';
        marker.style.left = `${Math.min(Math.max((x / 420) * 100, 4), 96)}%`;
        marker.style.top = `${Math.min(Math.max((y / 300) * 100, 4), 96)}%`;
        marker.style.zIndex = '2';
        marker.addEventListener('click', () => {
          if (item.category === 'hotspot') {
            const games = item.popular_games && item.popular_games.length ? item.popular_games.join(', ') : 'Local gaming culture';
            updateStatus(`${item.gamer_count} gamers nearby`);
            renderInsights([`Gamer Hotspot · ${item.gamer_count} gamers nearby`, `Popular games: ${games}`]);
          } else if (item.url && item.url !== '#') {
            window.location.href = item.url;
          } else {
            updateStatus(`${item.name}`);
            renderInsights([`${item.label || item.name} is on the map.`]);
          }
        });
        mapContainer.appendChild(marker);
      });

      updateStatus(`${items.length} public markers shown`);
      renderInsights([
        `${(data.hotspots || []).length} gamer hotspot${(data.hotspots || []).length === 1 ? '' : 's'} visible`,
        `${(data.venues || []).length} venue${(data.venues || []).length === 1 ? '' : 's'}`,
        `${(data.events || []).length} event${(data.events || []).length === 1 ? '' : 's'}`,
        `${(data.tournaments || []).length} tournament${(data.tournaments || []).length === 1 ? '' : 's'}`,
      ]);
    }

    async function loadMapData() {
      updateStatus('Loading map data…');
      if (!provider || provider === 'google' && !apiKey) {
        updateStatus('No external provider key configured');
      }
      try {
        const response = await fetch(mapDataUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!response.ok) throw new Error('Map request failed');
        const data = await response.json();
        drawMap(data);
      } catch (error) {
        updateStatus('Map data unavailable');
        renderInsights(['The map is available with graceful fallback, but no public data was loaded.']);
      }
    }

    layerInputs.forEach((input) => input.addEventListener('change', loadMapData));
    loadMapData();
  }
})();