const routeLegsMap = {};
let changesMade = false;

function updateMarkers() {
  console.log('updateMarkers called, isEditingStops:', isEditingStops);
  console.log('globalData:', globalData);
  csvMarkers.forEach(m => m.remove());
  csvMarkers = [];
  if (!globalData || globalData.length === 0 || !markerToggle.checked) return;

  const labelSelect = document.getElementById('labelSelect');
  const labelType = labelSelect ? labelSelect.value : '';

  globalData.forEach(row => {
    const lat = cleanCoord(row.latitude);
    const lon = cleanCoord(row.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    const el = document.createElement('div');
    el.className = isEditingStops ? 'edit-marker' : 'marker';

    const marker = new mapboxgl.Marker(el, { 
      anchor: 'bottom',
      draggable: isEditingStops
    })
      .setLngLat([lon, lat])
      .addTo(map);

    marker.__stopData = {
      id: row.id,
      name: row.name,
      address: row.address,
      latitude: lat,
      longitude: lon,
      year: row.year
    };

    if (labelType && marker.__stopData[labelType]) {
      const popupContent = marker.__stopData[labelType].toString();
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setText(popupContent);
      marker.setPopup(popup);
      el.addEventListener('mouseenter', () => marker.togglePopup());
      el.addEventListener('mouseleave', () => marker.togglePopup());
    }

    if (isEditingStops) {
      el.addEventListener('click', () => {
        if (!isEditingStops) return;
        handleStopMarkerClick(marker);
      });
      marker.on('dragend', () => handleStopDragEnd(marker));
    }

    csvMarkers.push(marker);
  });
}

function updateTripSelect() {
  const tripSelect = document.getElementById('tripSelect');
  tripSelect.innerHTML = '<option value="">None</option>';
  const years = [...new Set(globalData.map(row => row.year).filter(y => y))];
  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    tripSelect.appendChild(opt);
  });
  futureTrips.forEach(trip => {
    const opt = document.createElement('option');
    opt.value = `future-${trip.id}`;
    opt.textContent = `Future: ${trip.name}`;
    tripSelect.appendChild(opt);
  });
}

function drawRoutes() {
  console.log('drawRoutes called');
  routes.forEach(route => {
    if (map.getLayer(route)) {
      map.removeLayer(route);
      console.log(`Removed layer: ${route}`);
    }
    if (map.getSource(route)) {
      map.removeSource(route);
      console.log(`Removed source: ${route}`);
    }
  });
  routes = [];

  const tripSelectElem = document.getElementById('tripSelect');
  const selectedTrips = Array.from(tripSelectElem.selectedOptions)
    .map(o => o.value)
    .filter(y => y !== "");
  console.log('Selected trips:', selectedTrips);

  if (isPlanningFutureTrip && futureTripPoints.length >= 2) {
    const routeId = 'route-editing';
    routes.push(routeId);
    const coordinates = futureTripPoints.map(point => [point.longitude, point.latitude]);
    console.log('Future trip coordinates:', coordinates);
    const waypoints = coordinates.map(coord => ({ coordinates: coord }));
    fetchRoute(waypoints, routeId, 0, "Currently Editing Trip");
  }

  selectedTrips.forEach((selectedTrip, index) => {
    let coordinates = [];
    let routeLabel = "";
    if (selectedTrip.startsWith('future-')) {
      const tripId = selectedTrip.replace('future-', '');
      routeLabel = "Future Trip: " + (futureTrips.find(t => t.id == tripId)?.name || '');
      const trip = futureTrips.find(t => t.id == tripId);
      if (trip && trip.points.length >= 2) {
        coordinates = trip.points.map(point => [point.longitude, point.latitude]);
        console.log(`Coordinates for future trip ${tripId}:`, coordinates);
      } else {
        console.log(`Not enough points for future trip ${tripId}:`, trip?.points?.length || 0);
      }
    } else {
      routeLabel = "Past Trip: " + selectedTrip;
      const yearData = globalData.filter(row => String(row.year) === String(selectedTrip));
      console.log(`Year ${selectedTrip} has ${yearData.length} stops:`, yearData);
      if (yearData.length >= 2) {
        coordinates = yearData.map(row => [parseFloat(row.longitude), parseFloat(row.latitude)])
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        console.log(`Coordinates for past trip ${selectedTrip}:`, coordinates);
      } else {
        console.log(`Not enough points for past trip ${selectedTrip}:`, yearData.length);
      }
    }
    if (coordinates.length >= 2) {
      const routeId = `route-${selectedTrip}`;
      routes.push(routeId);
      const waypoints = coordinates.map(coord => ({ coordinates: coord }));
      fetchRoute(waypoints, routeId, index, routeLabel);
    } else {
      console.log(`Skipping route for ${selectedTrip}: not enough valid coordinates`);
    }
  });
}

function fetchRoute(waypoints, routeId, colorIndex, routeLabel) {
  const coordsString = waypoints.map(wp => wp.coordinates.join(',')).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`;
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log(`Mapbox Directions API response for ${routeId}:`, data);
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        console.log(`Route legs for ${routeId}:`, route.legs);
        routeLegsMap[routeId] = {
          label: routeLabel || routeId,
          legs: route.legs || []
        };
        if (routeId === 'route-editing') {
          editingRouteLegs = route.legs || null;
        }
        if (!map.isStyleLoaded()) {
          map.on('styledata', () => {
            console.log(`Map style loaded, adding route for ${routeId}`);
            route.legs.forEach((leg, i) => {
              console.log(`Leg ${i} geometry:`, leg.geometry);
              const segmentId = `${routeId}-segment-${i}`;
              map.addSource(segmentId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: leg.geometry
                }
              });
              map.addLayer({
                id: segmentId,
                type: 'line',
                source: segmentId,
                paint: {
                  'line-color': '#FF0000', // Bright red
                  'line-width': 6, // Thicker line
                  'line-opacity': 1, // Ensure fully opaque
                  'line-dasharray': i % 2 === 0 ? [2, 2] : [1, 1]
                }
              }); // Omit beforeId to place on top
              console.log(`Added route layer for ${segmentId}`);
              const layer = map.getLayer(segmentId);
              console.log(`Layer ${segmentId} visibility:`, layer ? layer.visibility : 'not found');
            });
            updateTripDistancesDisplay();
            map.triggerRepaint();
          });
        } else {
          route.legs.forEach((leg, i) => {
            console.log(`Leg ${i} geometry:`, leg.geometry);
            const segmentId = `${routeId}-segment-${i}`;
            map.addSource(segmentId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: leg.geometry
              }
            });
            map.addLayer({
              id: segmentId,
              type: 'line',
              source: segmentId,
              paint: {
                'line-color': '#FF0000', // Bright red
                'line-width': 6, // Thicker line
                'line-opacity': 1, // Ensure fully opaque
                'line-dasharray': i % 2 === 0 ? [2, 2] : [1, 1]
              }
            }); // Omit beforeId to place on top
            console.log(`Added route layer for ${segmentId}`);
            const layer = map.getLayer(segmentId);
            console.log(`Layer ${segmentId} visibility:`, layer ? layer.visibility : 'not found');
          });
          updateTripDistancesDisplay();
          map.triggerRepaint();
        }
      } else {
        console.log(`No routes found for ${routeId}`);
      }
    })
    .catch(error => console.error(`Error fetching route for ${routeId}:`, error));
}

function updateTripDistancesDisplay() {
  const distancesDiv = document.getElementById('tripDistances');
  distancesDiv.innerHTML = '';
  if (routes.length === 0) return;
  routes.forEach(routeId => {
    if (!routeLegsMap[routeId]) return;
    const { label, legs } = routeLegsMap[routeId];
    if (!legs || legs.length === 0) return;
    let total = 0;
    let html = `<strong>${label}</strong><ul>`;
    legs.forEach((leg, i) => {
      const distMiles = leg.distance / 1609.34;
      html += `<li onmouseover="highlightSegment('${routeId}-segment-${i}')" onmouseout="unhighlightSegment('${routeId}-segment-${i}')">Segment ${i+1}: ${distMiles.toFixed(1)} mi</li>`;
      total += distMiles;
    });
    html += `</ul><em>Total: ${total.toFixed(1)} mi</em><br><br>`;
    distancesDiv.innerHTML += html;
  });
}

function highlightSegment(segmentId) {
  if (map.getLayer(segmentId)) map.setPaintProperty(segmentId, 'line-width', 6);
}

function unhighlightSegment(segmentId) {
  if (map.getLayer(segmentId)) map.setPaintProperty(segmentId, 'line-width', 4);
}

document.addEventListener('DOMContentLoaded', () => {
  const labelEl = document.getElementById('labelSelect');
  if (labelEl) labelEl.addEventListener('change', updateMarkers);

  const editButton = document.getElementById('editStopButton');
  if (editButton) editButton.addEventListener('click', toggleEditStopMode);
});

function toggleEditStopMode() {
  if (!isEditingStops) enterEditStopMode();
  else exitEditStopMode();
}

function enterEditStopMode() {
  console.log('Entering edit mode');
  isEditingStops = true;
  changesMade = false;
  document.getElementById('editStopButton').textContent = "Exit Edit Mode";
  updateMarkers();
  map.on('contextmenu', handleMapRightClickForStopAdd);
}

function exitEditStopMode() {
  console.log('Exiting edit mode, isEditingStops before:', isEditingStops);
  isEditingStops = false;
  console.log('isEditingStops after:', isEditingStops);
  document.getElementById('editStopButton').textContent = "Edit Stops";
  if (changesMade) alert('Changes saved successfully!');
  else alert('No changes were made.');
  updateMarkers();
  map.off('contextmenu', handleMapRightClickForStopAdd);
}

function handleMapRightClickForStopAdd(e) {
  if (!isEditingStops) return;
  const coords = e.lngLat;
  const markerEl = document.createElement('div');
  markerEl.className = 'edit-marker';
  const newMarker = new mapboxgl.Marker(markerEl, { draggable: true, anchor: 'bottom' })
    .setLngLat([coords.lng, coords.lat])
    .addTo(map);

  newMarker.__stopData = {
    id: null,
    name: "",
    address: "",
    latitude: coords.lat,
    longitude: coords.lng,
    year: null
  };

  newMarker.setDraggable(true);
  newMarker.on('dragend', () => handleStopDragEnd(newMarker));
  newMarker.getElement().addEventListener('click', () => {
    if (!isEditingStops) return;
    handleStopMarkerClick(newMarker);
  });

  handleStopMarkerClick(newMarker);
}

function handleStopMarkerClick(marker) {
  const data = marker.__stopData;
  if (!data) return;

  document.getElementById('editStopName').value = data.name || "";
  document.getElementById('editStopAddress').value = data.address || "";
  document.getElementById('editStopLatitude').value = data.latitude || "";
  document.getElementById('editStopLongitude').value = data.longitude || "";
  document.getElementById('editStopYear').value = data.year || "";

  document.getElementById('editStopModal').style.display = 'block';

  document.getElementById('editStopSubmit').onclick = () => {
    const name = document.getElementById('editStopName').value.trim();
    const address = document.getElementById('editStopAddress').value.trim();
    const latitude = parseFloat(document.getElementById('editStopLatitude').value);
    const longitude = parseFloat(document.getElementById('editStopLongitude').value);
    const year = document.getElementById('editStopYear').value.trim() || null;

    if (!name) {
      alert('Name is required and must be a non-empty string');
      return;
    }
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      alert('Latitude must be a number between -90 and 90');
      return;
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      alert('Longitude must be a number between -180 and 180');
      return;
    }
    if (year && (isNaN(parseInt(year)) || parseInt(year) < 1900 || parseInt(year) > 2100)) {
      alert('Year must be an integer between 1900 and 2100');
      return;
    }

    data.name = name;
    data.address = address;
    data.latitude = latitude;
    data.longitude = longitude;
    data.year = year;

    if (!data.id) {
      createStopInDB(data)
        .then(updated => {
          data.id = updated.id;
          globalData.push(updated);
          updateMarkers();
          changesMade = true;
          alert('Stop added successfully!');
          document.getElementById('editStopModal').style.display = 'none';
        })
        .catch(err => alert('Failed to add stop: ' + err.message));
    } else {
      updateStopInDB(data)
        .then(() => {
          changesMade = true;
          alert('Stop updated successfully!');
          document.getElementById('editStopModal').style.display = 'none';
        })
        .catch(err => alert('Failed to update stop: ' + err.message));
    }
  };

  document.getElementById('editStopCancel').onclick = () => {
    document.getElementById('editStopModal').style.display = 'none';
  };
}

function handleStopDragEnd(marker) {
  const data = marker.__stopData;
  if (!data) return;
  const coords = marker.getLngLat();
  data.latitude = coords.lat;
  data.longitude = coords.lng;

  if (!data.id) {
    console.log("New marker dragged; waiting for user to Save in the modal.");
    return;
  }
  updateStopInDB(data)
    .then(() => {
      console.log('Stop location updated.');
      changesMade = true;
    })
    .catch(err => {
      console.error('Error updating location:', err);
      alert('Failed to update stop location: ' + err.message);
    });
}

function createStopInDB(data) {
  return fetch('http://24.144.64.81:3001/api/stops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      year: data.year ? parseInt(data.year) : null
    })
  })
  .then(r => {
    if (!r.ok) throw new Error('Failed to create stop');
    return r.json();
  });
}

function updateStopInDB(data) {
  if (!data.id) return Promise.reject(new Error("No ID for update."));
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    return Promise.reject(new Error("Name is required and must be a non-empty string"));
  }
  if (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90 || isNaN(data.latitude)) {
    return Promise.reject(new Error("Latitude must be a number between -90 and 90"));
  }
  if (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180 || isNaN(data.longitude)) {
    return Promise.reject(new Error("Longitude must be a number between -180 and 180"));
  }
  if (data.year !== null && data.year !== undefined && (!Number.isInteger(parseInt(data.year)) || parseInt(data.year) < 1900 || parseInt(data.year) > 2100)) {
    return Promise.reject(new Error("Year must be an integer between 1900 and 2100"));
  }

  return fetch(`http://24.144.64.81:3001/api/stops/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      address: data.address !== undefined ? data.address : null,
      latitude: data.latitude,
      longitude: data.longitude,
      year: data.year ? parseInt(data.year) : null
    })
  })
  .then(r => {
    if (!r.ok) return r.json().then(err => { throw new Error(err.error || 'Failed to update stop'); });
    return r.json();
  })
  .then(updatedData => {
    const index = globalData.findIndex(item => item.id === data.id);
    if (index !== -1) {
      globalData[index] = {
        ...globalData[index],
        name: data.name,
        address: data.address !== undefined ? data.address : null,
        latitude: data.latitude,
        longitude: data.longitude,
        year: data.year ? parseInt(data.year) : null
      };
    }
    updateMarkers();
    return updatedData;
  });
}

document.getElementById('deleteStop').onclick = () => {
  const lat = document.getElementById('editStopLatitude').value;
  const lon = document.getElementById('editStopLongitude').value;
  const marker = csvMarkers.find(m => {
    const d = m.__stopData;
    return d && d.latitude == lat && d.longitude == lon;
  });
  if (!marker) {
    alert('Marker not found to delete.');
    return;
  }
  const data = marker.__stopData;
  if (!data.id) {
    marker.remove();
    document.getElementById('editStopModal').style.display = 'none';
    alert('New marker was never saved, so just removed.');
    return;
  }
  if (!confirm(`Are you sure you want to delete ${data.name}?`)) return;
  fetch(`http://24.144.64.81:3001/api/stops/${data.id}`, { method: 'DELETE' })
    .then(r => {
      if (!r.ok) throw new Error('Failed to delete stop');
      return r.json();
    })
    .then(() => {
      globalData = globalData.filter(item => item.id !== data.id);
      updateMarkers();
      changesMade = true;
      alert('Stop deleted successfully.');
      marker.remove();
      csvMarkers = csvMarkers.filter(m => m !== marker);
      document.getElementById('editStopModal').style.display = 'none';
    })
    .catch(err => alert('Failed to delete stop: ' + err.message));
};