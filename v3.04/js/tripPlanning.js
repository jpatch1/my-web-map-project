const editingControlsDiv = document.getElementById('editingControls');
const saveTripChangesButton = document.getElementById('saveTripChangesButton');
const discardTripChangesButton = document.getElementById('discardTripChangesButton');
const exitEditTripButton = document.getElementById('exitEditTripButton');
const openDeleteTripModalButton = document.getElementById('openDeleteTripModalButton');
const deleteTripModal = document.getElementById('deleteTripModal');
const deleteTripSelect = document.getElementById('deleteTripSelect');
const confirmDeleteTrip = document.getElementById('confirmDeleteTrip');
const cancelDeleteTripModal = document.getElementById('cancelDeleteTripModal');

planFutureTripButton.addEventListener('click', () => {
  futureTripModal.style.display = 'block';
  futureTripSelect.innerHTML = '<option value="new">New Trip</option>';
  futureTrips.forEach(trip => {
    const opt = document.createElement('option');
    opt.value = trip.id;
    opt.textContent = trip.name;
    futureTripSelect.appendChild(opt);
  });
  futureTripNameInput.style.display = 'none';
  tripNameLabel.style.display = 'none';
  futureTripNameInput.value = '';
  futureTripSelect.dispatchEvent(new Event('change'));
});

futureTripSelect.addEventListener('change', () => {
  if (futureTripSelect.value === 'new') {
    tripNameLabel.style.display = 'block';
    futureTripNameInput.style.display = 'block';
  } else {
    tripNameLabel.style.display = 'none';
    futureTripNameInput.style.display = 'none';
  }
});

futureTripEnter.addEventListener('click', () => {
  const selectedValue = futureTripSelect.value;
  if (selectedValue === 'new') {
    currentTripName = futureTripNameInput.value.trim();
    if (!currentTripName) {
      alert('Please enter a trip name.');
      return;
    }
    futureTripPoints = [];
  } else {
    const trip = futureTrips.find(t => t.id == selectedValue);
    currentTripName = trip.name;
    futureTripPoints = trip.points.map((pt, index) => {
      const point = createTripPoint(pt.latitude, pt.longitude, pt.name || '', pt.date || '', pt.comments || '', index + 1, true);
      return point;
    });
    updateMarkerNumbers();
  }
  isPlanningFutureTrip = true;
  futureTripModal.style.display = 'none';
  map.getCanvas().style.cursor = 'crosshair';
  planFutureTripButton.textContent = 'Editing Trip';
  planFutureTripButton.disabled = true;
  editingControlsDiv.style.display = 'block';
  drawRoutes();
});

futureTripCancel.addEventListener('click', () => {
  futureTripModal.style.display = 'none';
});

saveTripChangesButton.addEventListener('click', () => {
  if (futureTripPoints.length < 2) {
    alert('Please add at least 2 points for the trip.');
    return;
  }
  const trip = {
    name: currentTripName,
    points: futureTripPoints.filter(p => p.isStop).map(p => ({
      longitude: p.longitude,
      latitude: p.latitude,
      name: p.name,
      date: p.date,
      comments: p.comments
    }))
  };
  const existingTrip = futureTrips.find(t => t.name === currentTripName);
  const url = existingTrip && existingTrip.id ? `/api/future-trips/${existingTrip.id}` : '/api/future-trips';
  const method = existingTrip && existingTrip.id ? 'PUT' : 'POST';
  fetch(`http://24.144.64.81:3001${url}`, { // Updated port
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip)
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to save trip');
      return response.json();
    })
    .then(data => {
      if (!existingTrip) futureTrips.push(data);
      else Object.assign(existingTrip, data);
      unsavedChanges = false;
      updateTripSelect();
      drawRoutes();
      alert('Trip saved permanently!');
    })
    .catch(error => alert('Failed to save trip: ' + error.message));
});

discardTripChangesButton.addEventListener('click', () => {
  if (confirm("Are you sure you want to discard all unsaved changes?")) {
    cleanupFutureTripPlanning();
  }
});

exitEditTripButton.addEventListener('click', () => {
  if (unsavedChanges && !confirm('You have unsaved changes. Exit without saving?')) return;
  cleanupFutureTripPlanning();
});

function cleanupFutureTripPlanning() {
  isPlanningFutureTrip = false;
  futureTripPoints.forEach(point => {
    if (point.marker) point.marker.remove();
  });
  futureTripPoints = [];
  map.getCanvas().style.cursor = '';
  planFutureTripButton.textContent = 'Plan/Edit New Trips';
  planFutureTripButton.disabled = false;
  editingControlsDiv.style.display = 'none';
  document.getElementById('tripDistances').innerHTML = '';
  editingRouteLegs = null;
  unsavedChanges = false;
}

openDeleteTripModalButton.addEventListener('click', () => {
  deleteTripSelect.innerHTML = '';
  futureTrips.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    deleteTripSelect.appendChild(opt);
  });
  if (futureTrips.length > 0) {
    deleteTripSelect.selectedIndex = 0;
  }
  deleteTripModal.style.display = 'block';
});

cancelDeleteTripModal.addEventListener('click', () => {
  deleteTripModal.style.display = 'none';
});

confirmDeleteTrip.addEventListener('click', () => {
  const tripId = deleteTripSelect.value;
  if (!tripId) {
    alert("No future trip selected.");
    return;
  }
  if (!confirm(`Are you sure you want to delete "${deleteTripSelect.options[deleteTripSelect.selectedIndex].text}"?`)) {
    return;
  }
  fetch(`http://24.144.64.81:3001/api/future-trips/${tripId}`, { method: 'DELETE' }) // Updated port
    .then(response => {
      if (!response.ok) throw new Error('Failed to delete trip');
      futureTrips = futureTrips.filter(t => t.id != tripId);
      updateTripSelect();
      drawRoutes();
      deleteTripModal.style.display = 'none';
    })
    .catch(error => alert('Failed to delete trip: ' + error.message));
});

function createTripPoint(latitude, longitude, name, date, comments, number, isStop = true) {
  const markerEl = document.createElement('div');
  markerEl.className = isStop ? 'stop-marker' : 'waypoint-marker';
  if (isStop) {
    const numberEl = document.createElement('div');
    numberEl.className = 'marker-number';
    numberEl.textContent = number;
    markerEl.appendChild(numberEl);
  }
  const marker = new mapboxgl.Marker(markerEl, { draggable: true, anchor: 'bottom' })
    .setLngLat([longitude, latitude])
    .addTo(map);
  const point = { latitude, longitude, name, date, comments, marker, number, isStop };
  marker.on('dragend', () => {
    const coords = marker.getLngLat();
    point.latitude = coords.lat;
    point.longitude = coords.lng;
    unsavedChanges = true;
    drawRoutes();
  });
  markerEl.addEventListener('click', () => {
    if (isPlanningFutureTrip && isStop) {
      editTripPointModal.style.display = 'block';
      editPointName.value = point.name || '';
      editPointDate.value = point.date || '';
      editPointComments.value = point.comments || '';
      editPointOrder.value = point.number;
      editTripPointSave.onclick = () => {
        point.name = editPointName.value.trim();
        point.date = editPointDate.value;
        point.comments = editPointComments.value.trim();
        const newOrder = parseInt(editPointOrder.value);
        if (!isNaN(newOrder) && newOrder > 0 && newOrder !== point.number) {
          reorderTripPoint(point, newOrder);
        }
        unsavedChanges = true;
        editTripPointModal.style.display = 'none';
        updateMarkerNumbers();
        drawRoutes();
      };
      editTripPointCancel.onclick = () => {
        editTripPointModal.style.display = 'none';
      };
    }
  });
  return point;
}

function reorderTripPoint(point, newOrder) {
  futureTripPoints = futureTripPoints.filter(p => p !== point);
  newOrder = Math.min(newOrder, futureTripPoints.length + 1);
  futureTripPoints.splice(newOrder - 1, 0, point);
  unsavedChanges = true;
}

function updateMarkerNumbers() {
  futureTripPoints.forEach((point, index) => {
    if (point.isStop) {
      point.number = index + 1;
      const numberEl = point.marker.getElement().querySelector('.marker-number');
      if (numberEl) numberEl.textContent = point.number;
    }
  });
}

function handleFutureTripRightClick(e) {
  if (!isPlanningFutureTrip) return;
  const { lng, lat } = e.lngLat;
  const newPoint = createTripPoint(lat, lng, '', '', '', futureTripPoints.length + 1, true);
  futureTripPoints.push(newPoint);
  unsavedChanges = true;
  updateMarkerNumbers();
  drawRoutes();
}

document.getElementById('addWaypointButton').addEventListener('click', () => {
  if (!isPlanningFutureTrip) return;
  map.once('click', (e) => {
    const newPoint = createTripPoint(e.lngLat.lat, e.lngLat.lng, '', '', '', futureTripPoints.length + 1, false);
    futureTripPoints.push(newPoint);
    unsavedChanges = true;
    drawRoutes();
  });
});

window.addEventListener('beforeunload', (e) => {
  if (unsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved trip changes. Are you sure you want to leave?';
  }
});