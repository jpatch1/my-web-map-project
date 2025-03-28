/* js/mapSetup.js */
let map = null;
let directions = null;

map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-98.5795, 39.8283],
  zoom: 3
});

map.on('load', () => {
  try {
    map.setProjection('globe');
  } catch (e) {
    console.error("Globe projection error:", e);
  }
  map.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: 'imperial' }));

  class ZoomScaleControl {
    onAdd(map) {
      this._map = map;
      this._container = document.createElement('div');
      this._container.className = 'zoom-scale-control';
      this.update();
      this._map.on('zoom', () => this.update());
      return this._container;
    }
    onRemove() {
      this._map.off('zoom', this.update);
      this._container.parentNode.removeChild(this._container);
      this._map = undefined;
    }
    update() {
      const zoom = this._map.getZoom();
      const scaleDenom = 591657527.591 / Math.pow(2, zoom);
      this._container.innerHTML = "1:" + Math.round(scaleDenom).toLocaleString();
    }
  }
  map.addControl(new ZoomScaleControl(), 'bottom-left');

  // Use the global geocoder (no declaration here)
  map.addControl(geocoder, 'top-right');

  directions = new MapboxDirections({
    accessToken: mapboxgl.accessToken,
    unit: 'imperial',
    profile: 'mapbox/driving',
    controls: { inputs: true, instructions: false }
  });
  directions.on('route', (e) => {
    if (e.route && e.route.length > 0) {
      const route = e.route[0];
      const distance = (route.distance / 1609.34).toFixed(1);
      const duration = (route.duration / 3600).toFixed(1);
      document.getElementById('route-info').innerHTML = `Distance: ${distance} mi | Time: ${duration} hr`;
    } else {
      document.getElementById('route-info').innerHTML = '';
    }
  });

  fetch('http://24.144.64.81:3000/api/campgrounds')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load campgrounds');
      return response.json();
    })
    .then(data => {
      globalData = data;
      updateTripSelect();
      updateMarkers();
    })
    .catch(error => {
      console.error("Error fetching campgrounds:", error);
      alert("Could not load campgrounds from database.");
    });

  fetch('rv-map/national_parks.geojson')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load national_parks.geojson');
      return response.json();
    })
    .then(data => {
      nationalParksData = {
        type: "FeatureCollection",
        features: data.features.filter(feature => {
          const unit = feature.properties.unit_type;
          return (unit === "National Park" || unit === "National Parks" || (unit && unit.includes("National Park")));
        })
      };
      if (document.getElementById('parksToggle').checked) {
        loadNationalParks();
      }
    })
    .catch(error => {
      console.error("Error fetching national_parks.geojson:", error);
    });
});

function loadNationalParks() {
  if (!nationalParksData) return;
  if (!map.getSource('national-parks')) {
    map.addSource('national-parks', {
      type: 'geojson',
      data: nationalParksData
    });
    map.addLayer({
      id: 'national-parks',
      type: 'fill',
      source: 'national-parks',
      paint: {
        'fill-color': '#008000',
        'fill-opacity': 0.4,
        'fill-outline-color': '#006400'
      }
    });
  }
}

basemapSelect.addEventListener('change', (e) => {
  const tripSelectElem = document.getElementById('tripSelect');
  const selectedTrips = Array.from(tripSelectElem.selectedOptions).map(o => o.value);
  const markerState = markerToggle.checked;
  const newStyle = e.target.value;
  map.setStyle(newStyle);
  map.once('styledata', () => {
    if (!document.querySelector('.mapboxgl-ctrl-geocoder')) {
      map.addControl(geocoder, 'top-right');
    }
    if (document.getElementById('routingToggle').checked && !document.querySelector('.mapboxgl-ctrl-directions')) {
      map.addControl(directions, 'bottom-right');
    }
    updateMarkers();
    drawRoutes();
    Array.from(tripSelectElem.options).forEach(option => {
      if (selectedTrips.includes(option.value)) option.selected = true;
    });
    markerToggle.checked = markerState;
    photoMarkers.forEach(marker => marker.addTo(map));
    if (document.getElementById('parksToggle').checked && nationalParksData) {
      loadNationalParks();
    }
  });
});

document.getElementById('routingToggle').addEventListener('change', (e) => {
  if (e.target.checked) {
    map.addControl(directions, 'bottom-right');
    document.getElementById('route-info').style.display = 'block';
  } else {
    map.removeControl(directions);
    document.getElementById('route-info').style.display = 'none';
    document.getElementById('route-info').innerHTML = '';
  }
});

markerToggle.addEventListener('change', (e) => {
  if (e.target.checked) {
    updateMarkers();
  } else {
    csvMarkers.forEach(marker => marker.remove());
    csvMarkers = [];
  }
});

parksToggle.addEventListener('change', (e) => {
  if (e.target.checked) {
    if (nationalParksData) loadNationalParks();
  } else {
    if (map.getLayer('national-parks')) map.removeLayer('national-parks');
    if (map.getSource('national-parks')) map.removeSource('national-parks');
  }
});

map.on('mousemove', (e) => {
  document.getElementById('cursor-coords').innerHTML = `Lat: ${e.lngLat.lat.toFixed(4)}, Lng: ${e.lngLat.lng.toFixed(4)}`;
});

// Tab switching logic
const tabItems = document.querySelectorAll('.sidebar-tabs ul li');
const tabContents = document.querySelectorAll('.tab-content');
tabItems.forEach(item => {
  item.addEventListener('click', () => {
    tabItems.forEach(i => i.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(item.dataset.tab).classList.add('active');
  });
});

document.getElementById('tripSelect').addEventListener('change', () => {
  drawRoutes();
});

// Sidebar toggle logic
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const toggleSidebar = document.getElementById('toggleSidebar');
  const showControls = document.getElementById('showControls');

  // Initially, the sidebar is visible, so hide the "Show Controls" button
  showControls.style.display = 'none';

  // Close the sidebar (slide it off)
  if (toggleSidebar) {
    toggleSidebar.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      showControls.style.display = 'block'; // Show the "Show Controls" button
    });
  }

  // Open the sidebar (slide it back in)
  if (showControls) {
    showControls.addEventListener('click', () => {
      sidebar.classList.remove('collapsed');
      showControls.style.display = 'none'; // Hide the "Show Controls" button
    });
  }
});