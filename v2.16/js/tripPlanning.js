/* js/tripPlanning.js */
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
    opt.value = trip.name;
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
    const trip = futureTrips.find(t => t.name === selectedValue);
    currentTripName = trip.name;
    futureTripPoints = trip.points.map((pt, index) => {
      const point = createTripPoint(pt.latitude, pt.longitude, pt.name || '', pt.date || '', pt.comments || '', index + 1);
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
    points: futureTripPoints.map(p => ({
      longitude: p.longitude,
      latitude: p.latitude,
      name: p.name,
      date: p.date,
      comments: p.comments
    }))
  };
  const existingIndex = futureTrips.findIndex(t => t.name === currentTripName);
  if (existingIndex >= 0) {
    futureTrips[existingIndex] = trip;
  } else {
    futureTrips.push(trip);
  }
  localStorage.setItem('futureTrips', JSON.stringify(futureTrips));
  updateTripSelect();
  drawRoutes();
  alert('Trip saved! You can continue editing or click "Exit Edit Mode" to finish.');
});

discardTripChangesButton.addEventListener('click', () => {
  if (confirm("Are you sure you want to discard all unsaved changes?")) {
    cleanupFutureTripPlanning();
  }
});

exitEditTripButton.addEventListener('click', () => {
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
}

openDeleteTripModalButton.addEventListener('click', () => {
  deleteTripSelect.innerHTML = '';
  futureTrips.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
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
  const tripName = deleteTripSelect.value;
  if (!tripName) {
    alert("No future trip selected.");
    return;
  }
  if (!confirm(`Are you sure you want to delete "${tripName}"?`)) {
    return;
  }
  futureTrips = futureTrips.filter(t => t.name !== tripName);
  localStorage.setItem('futureTrips', JSON.stringify(futureTrips));
  updateTripSelect();
  drawRoutes();
  deleteTripModal.style.display = 'none';
});

function createTripPoint(latitude, longitude, name, date, comments, number) {
  const markerEl = document.createElement('div');
  markerEl.className = 'future-marker';
  const numberEl = document.createElement('div');
  numberEl.className = 'marker-number';
  numberEl.textContent = number;
  markerEl.appendChild(numberEl);
  const marker = new mapboxgl.Marker(markerEl, { draggable: true, anchor: 'bottom' })
    .setLngLat([longitude, latitude])
    .addTo(map);
  const point = { latitude, longitude, name, date, comments, marker, number };
  marker.on('dragend', () => {
    const coords = marker.getLngLat();
    point.latitude = coords.lat;
    point.longitude = coords.lng;
    drawRoutes();
  });
  markerEl.addEventListener('click', () => {
    if (isPlanningFutureTrip) {
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
}

function updateMarkerNumbers() {
  futureTripPoints.forEach((point, index) => {
    point.number = index + 1;
    const numberEl = point.marker.getElement().querySelector('.marker-number');
    if (numberEl) numberEl.textContent = point.number;
  });
}

function handleFutureTripRightClick(e) {
  if (!isPlanningFutureTrip) return;
  const { lng, lat } = e.lngLat;
  const newPoint = createTripPoint(lat, lng, '', '', '', futureTripPoints.length + 1);
  futureTripPoints.push(newPoint);
  updateMarkerNumbers();
  drawRoutes();
}
