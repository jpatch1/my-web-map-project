/* js/markers.js */
const routeLegsMap = {};
let changesMade = false; // Track if changes were made during edit mode

function updateMarkers() {
  console.log('updateMarkers called, isEditingCampgrounds:', isEditingCampgrounds);
  csvMarkers.forEach(m => m.remove());
  csvMarkers = [];
  if (!globalData || globalData.length === 0 || !markerToggle.checked) return;

  // Get the current label selection
  const labelSelect = document.getElementById('labelSelect');
  const labelType = labelSelect ? labelSelect.value : '';

  globalData.forEach(row => {
    const lat = cleanCoord(row.latitude);
    const lon = cleanCoord(row.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    const el = document.createElement('div');
    // Use green markers if in edit mode, red markers otherwise
    el.className = isEditingCampgrounds ? 'edit-marker' : 'marker';

    const marker = new mapboxgl.Marker(el, { 
      anchor: 'bottom',
      draggable: isEditingCampgrounds // Make draggable only in edit mode
    })
      .setLngLat([lon, lat])
      .addTo(map);

    marker.__campgroundData = {
      id: row.id,
      name: row.name,
      address: row.address,
      latitude: lat,
      longitude: lon,
      year: row.year
    };

    // Add popup for hover label if a label type is selected
    if (labelType && marker.__campgroundData[labelType]) {
      const popupContent = marker.__campgroundData[labelType].toString();
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setText(popupContent);
      
      marker.setPopup(popup);

      // Add hover event listeners
      el.addEventListener('mouseenter', () => marker.togglePopup());
      el.addEventListener('mouseleave', () => marker.togglePopup());
    }

    // Add edit mode event listeners if in edit mode
    if (isEditingCampgrounds) {
      el.addEventListener('click', () => {
        if (!isEditingCampgrounds) return;
        handleCampgroundMarkerClick(marker);
      });

      marker.on('dragend', () => handleCampgroundDragEnd(marker));
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
    opt.value = `future-${trip.name}`;
    opt.textContent = `Future: ${trip.name}`;
    tripSelect.appendChild(opt);
  });
}

function drawRoutes() {
  routes.forEach(route => {
    if (map.getLayer(route)) map.removeLayer(route);
    if (map.getSource(route)) map.removeSource(route);
  });
  routes = [];

  const tripSelectElem = document.getElementById('tripSelect');
  const selectedTrips = Array.from(tripSelectElem.selectedOptions)
    .map(o => o.value)
    .filter(y => y !== "");

  if (isPlanningFutureTrip && futureTripPoints.length >= 2) {
    const routeId = 'route-editing';
    routes.push(routeId);
    const coordinates = futureTripPoints.map(point => [point.longitude, point.latitude]);
    const waypoints = coordinates.map(coord => ({ coordinates: coord }));
    fetchRoute(waypoints, routeId, 0, "Currently Editing Trip");
  }

  selectedTrips.forEach((selectedTrip, index) => {
    let coordinates = [];
    let routeLabel = "";
    if (selectedTrip.startsWith('future-')) {
      const tripName = selectedTrip.replace('future-', '');
      routeLabel = "Future Trip: " + tripName;
      const trip = futureTrips.find(t => t.name === tripName);
      if (trip && trip.points.length >= 2) {
        coordinates = trip.points.map(point => [point.longitude, point.latitude]);
      }
    } else {
      routeLabel = "Past Trip: " + selectedTrip;
      const yearData = globalData.filter(row => String(row.year) === String(selectedTrip));
      if (yearData.length >= 2) {
        coordinates = yearData.map(row => [parseFloat(row.longitude), parseFloat(row.latitude)])
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      }
    }
    if (coordinates.length >= 2) {
      const routeId = `route-${selectedTrip}`;
      routes.push(routeId);
      const waypoints = coordinates.map(coord => ({ coordinates: coord }));
      fetchRoute(waypoints, routeId, index, routeLabel);
    }
  });
}

function fetchRoute(waypoints, routeId, colorIndex, routeLabel) {
  const coordsString = waypoints.map(wp => wp.coordinates.join(',')).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`;
  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        routeLegsMap[routeId] = {
          label: routeLabel || routeId,
          legs: route.legs || []
        };
        if (routeId === 'route-editing') {
          editingRouteLegs = route.legs || null;
        }
        if (!map.getSource(routeId)) {
          map.addSource(routeId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });
        }
        if (!map.getLayer(routeId)) {
          map.addLayer({
            id: routeId,
            type: 'line',
            source: routeId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#ffa500', '#800080'][colorIndex % 6],
              'line-width': 4
            }
          });
        }
      }
      updateTripDistancesDisplay();
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
    let html = `<strong>${label}</strong><br>`;
    legs.forEach((leg, i) => {
      const distMiles = leg.distance / 1609.34;
      html += `Segment ${i+1}: ${distMiles.toFixed(1)} mi<br>`;
      total += distMiles;
    });
    html += `<em>Total: ${total.toFixed(1)} mi</em><br><br>`;
    distancesDiv.innerHTML += html;
  });
}

// Add this at the very bottom of markers.js:
document.addEventListener('DOMContentLoaded', () => {
  const labelEl = document.getElementById('labelSelect');
  if (labelEl) {
    labelEl.addEventListener('change', updateMarkers);
  }

  const editButton = document.getElementById('editCampgroundButton');
  if (editButton) {
    editButton.addEventListener('click', toggleEditCampgroundMode);
  }
});

function toggleEditCampgroundMode() {
  if (!isEditingCampgrounds) {
    enterEditCampgroundMode();
  } else {
    exitEditCampgroundMode();
  }
}

function enterEditCampgroundMode() {
  console.log('Entering edit mode');
  isEditingCampgrounds = true;
  changesMade = false; // Reset changes flag when entering edit mode
  document.getElementById('editCampgroundButton').textContent = "Exit Edit Mode";
  updateMarkers(); // Refresh markers in edit mode
  map.on('contextmenu', handleMapRightClickForCampgroundAdd);
}

function exitEditCampgroundMode() {
  console.log('Exiting edit mode, isEditingCampgrounds before:', isEditingCampgrounds);
  isEditingCampgrounds = false;
  console.log('isEditingCampgrounds after:', isEditingCampgrounds);
  document.getElementById('editCampgroundButton').textContent = "Edit Campground";

  // Display a message based on whether changes were made
  if (changesMade) {
    alert('Changes saved successfully!');
  } else {
    alert('No changes were made.');
  }

  // Refresh markers (should use red, non-draggable markers since isEditingCampgrounds is false)
  updateMarkers();

  // Remove the contextmenu event listener
  map.off('contextmenu', handleMapRightClickForCampgroundAdd);
}

function handleMapRightClickForCampgroundAdd(e) {
  if (!isEditingCampgrounds) return;
  const coords = e.lngLat;
  const markerEl = document.createElement('div');
  markerEl.className = 'edit-marker'; // green
  const newMarker = new mapboxgl.Marker(markerEl, { draggable: true, anchor: 'bottom' })
    .setLngLat([coords.lng, coords.lat])
    .addTo(map);

  // We'll store data for a "new" campground with no ID yet
  newMarker.__campgroundData = {
    id: null,
    name: "",
    address: "",
    latitude: coords.lat,
    longitude: coords.lng,
    year: null
  };

  newMarker.setDraggable(true);
  newMarker.on('dragend', () => handleCampgroundDragEnd(newMarker));

  // Left-click => open modal
  newMarker.getElement().addEventListener('click', () => {
    if (!isEditingCampgrounds) return;
    handleCampgroundMarkerClick(newMarker);
  });

  // Immediately open the modal for new info
  handleCampgroundMarkerClick(newMarker);
}

function handleCampgroundMarkerClick(marker) {
  const data = marker.__campgroundData;
  if (!data) return;

  // Fill the modal fields
  document.getElementById('editCampgroundName').value = data.name || "";
  document.getElementById('editCampgroundAddress').value = data.address || "";
  document.getElementById('editCampgroundLatitude').value = data.latitude || "";
  document.getElementById('editCampgroundLongitude').value = data.longitude || "";
  document.getElementById('editCampgroundYear').value = data.year || "";

  document.getElementById('editCampgroundModal').style.display = 'block';

  // On Save => POST if no ID, else PUT
  document.getElementById('editCampgroundSubmit').onclick = () => {
    const name = document.getElementById('editCampgroundName').value.trim();
    const address = document.getElementById('editCampgroundAddress').value.trim();
    const latitude = parseFloat(document.getElementById('editCampgroundLatitude').value);
    const longitude = parseFloat(document.getElementById('editCampgroundLongitude').value);
    const year = document.getElementById('editCampgroundYear').value.trim() || null;

    // Validate inputs
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

    // Update the data object
    data.name = name;
    data.address = address;
    data.latitude = latitude;
    data.longitude = longitude;
    data.year = year;

    if (!data.id) {
      createCampgroundInDB(data)
        .then(updated => {
          data.id = updated.id; // store new ID
          // Add the new campground to globalData
          globalData.push(updated);
          updateMarkers();
          changesMade = true; // Mark that changes were made
          alert('Campground added successfully!');
          document.getElementById('editCampgroundModal').style.display = 'none';
        })
        .catch(err => alert('Failed to add campground: ' + err.message));
    } else {
      updateCampgroundInDB(data)
        .then(() => {
          changesMade = true; // Mark that changes were made
          alert('Campground updated successfully!');
          document.getElementById('editCampgroundModal').style.display = 'none';
        })
        .catch(err => alert('Failed to update campground: ' + err.message));
    }
  };

  // On Cancel => close
  document.getElementById('editCampgroundCancel').onclick = () => {
    document.getElementById('editCampgroundModal').style.display = 'none';
  };
}

function handleCampgroundDragEnd(marker) {
  const data = marker.__campgroundData;
  if (!data) return;
  const coords = marker.getLngLat();
  data.latitude = coords.lat;
  data.longitude = coords.lng;

  // If new (no ID), do nothing until user hits Save
  if (!data.id) {
    console.log("New marker dragged; waiting for user to Save in the modal.");
    return;
  }
  // If existing => PUT
  updateCampgroundInDB(data)
    .then(() => {
      console.log('Campground location updated.');
      changesMade = true; // Mark that changes were made
    })
    .catch(err => {
      console.error('Error updating location:', err);
      alert('Failed to update campground location: ' + err.message);
    });
}

function createCampgroundInDB(data) {
  return fetch('http://24.144.64.81:3000/api/campgrounds', {
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
    if (!r.ok) throw new Error('Failed to create campground');
    return r.json();
  });
}

function updateCampgroundInDB(data) {
  if (!data.id) {
    return Promise.reject(new Error("No ID for update."));
  }

  // Validate data before sending
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

  console.log('Sending update request with data:', {
    name: data.name,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    year: data.year
  });

  return fetch(`http://24.144.64.81:3000/api/campgrounds/${data.id}`, {
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
    if (!r.ok) {
      return r.json().then(err => {
        throw new Error(err.error || 'Failed to update campground');
      });
    }
    return r.json();
  })
  .then(updatedData => {
    // Update globalData with the new data
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
    // Refresh markers to reflect the updated data (will preserve edit mode)
    updateMarkers();
    return updatedData;
  });
}

document.getElementById('deleteCampground').onclick = () => {
  const lat = document.getElementById('editCampgroundLatitude').value;
  const lon = document.getElementById('editCampgroundLongitude').value;
  // find the marker in csvMarkers
  const marker = csvMarkers.find(m => {
    const d = m.__campgroundData;
    return d && d.latitude == lat && d.longitude == lon;
  });
  if (!marker) {
    alert('Marker not found to delete.');
    return;
  }
  const data = marker.__campgroundData;
  if (!data.id) {
    // never saved => just remove from map
    marker.remove();
    document.getElementById('editCampgroundModal').style.display = 'none';
    alert('New marker was never saved, so just removed.');
    return;
  }
  if (!confirm(`Are you sure you want to delete ${data.name}?`)) return;
  fetch(`http://24.144.64.81:3000/api/campgrounds/${data.id}`, { method: 'DELETE' })
    .then(r => {
      if (!r.ok) throw new Error('Failed to delete campground');
      return r.json();
    })
    .then(() => {
      // Remove the campground from globalData
      globalData = globalData.filter(item => item.id !== data.id);
      updateMarkers();
      changesMade = true; // Mark that changes were made
      alert('Campground deleted successfully.');
      marker.remove();
      csvMarkers = csvMarkers.filter(m => m !== marker);
      document.getElementById('editCampgroundModal').style.display = 'none';
    })
    .catch(err => alert('Failed to delete campground: ' + err.message));
};