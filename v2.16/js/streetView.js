/* js/streetView.js */

streetViewButton.addEventListener('click', () => {
  if (!isStreetViewMode) {
    isStreetViewMode = true;
    streetViewButton.textContent = "Exit Street View Mode";
    const center = map.getCenter();
    if (streetViewMarker) streetViewMarker.remove();
    const markerEl = document.createElement('div');
    markerEl.className = 'street-view-marker';
    streetViewMarker = new mapboxgl.Marker(markerEl, { draggable: true, anchor: 'bottom' })
      .setLngLat([center.lng, center.lat])
      .addTo(map);
    streetViewMarker.getElement().addEventListener('click', () => {
      providerSelect.value = 'google';
      streetViewProviderModal.style.display = 'block';
    });
    streetViewMarker.on('dragend', () => {
      providerSelect.value = 'google';
      streetViewProviderModal.style.display = 'block';
    });
  } else {
    isStreetViewMode = false;
    streetViewButton.textContent = "Street View";
    if (streetViewMarker) {
      streetViewMarker.remove();
      streetViewMarker = null;
    }
    streetViewProviderModal.style.display = 'none';
  }
});

providerConfirm.addEventListener('click', () => {
  const provider = providerSelect.value;
  const coords = streetViewMarker.getLngLat();
  streetViewProviderModal.style.display = 'none';
  if (provider === 'google') {
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords.lat},${coords.lng}`, '_blank');
  } else if (provider === 'apple') {
    window.open(`https://maps.apple.com/?ll=${coords.lat},${coords.lng}&z=15&t=k&q=Look+Around`, '_blank');
  } else if (provider === 'bing') {
    window.open(`https://www.bing.com/maps?cp=${coords.lat}~${coords.lng}&lvl=18&style=x`, '_blank');
  } else if (provider === 'kartaview') {
    window.open(`https://kartaview.org/map/@${coords.lat},${coords.lng},18z`, '_blank');
  } else if (provider === 'mapillary') {
    window.open(`https://www.mapillary.com/app/?lat=${coords.lat}&lng=${coords.lng}&z=17`, '_blank');
  }
  isStreetViewMode = false;
  streetViewButton.textContent = "Street View";
  if (streetViewMarker) {
    streetViewMarker.remove();
    streetViewMarker = null;
  }
});

providerCancel.addEventListener('click', () => {
  streetViewProviderModal.style.display = 'none';
});
