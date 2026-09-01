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
      const actionUrl = item.url && item.url !== '#'
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
      if (!mapReadyPromise) {
        mapReadyPromise = new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-ggz-google-map]');
          if (existing) {
            existing.addEventListener('load', () => resolve(window.google), { once: true });
            existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker&loading=async`;
          script.async = true;
          script.defer = true;
          script.dataset.ggzGoogleMap = 'true';
          script.addEventListener('load', () => resolve(window.google), { once: true });
          script.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true });
          document.head.appendChild(script);
        });
      }
      return mapReadyPromise;
    }

    function ensureClustererLibrary() {
      if (window.MarkerClusterer || (window.markerClusterer && window.markerClusterer.MarkerClusterer)) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-ggz-marker-clusterer]');
        if (existing) {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', () => reject(new Error('Clusterer failed')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.5.3/dist/index.umd.min.js';
        script.async = true;
        script.defer = true;
        script.dataset.ggzMarkerClusterer = 'true';
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', () => reject(new Error('Clusterer failed')), { once: true });
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
            if (map) {
              map.setCenter({ lat, lng });
              map.setZoom(12);
            }
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
        map.addListener('bounds_changed', () => {
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
})();