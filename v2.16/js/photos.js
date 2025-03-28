/* js/photos.js */

photoInput.addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file && file.type.match('image.*')) {
    processPhoto(file);
  }
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.addEventListener(eventName, e => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});
['dragenter', 'dragover'].forEach(eventName => {
  document.addEventListener(eventName, () => {
    dropZone.style.display = 'flex';
  }, false);
});
['dragleave', 'drop'].forEach(eventName => {
  document.addEventListener(eventName, () => {
    dropZone.style.display = 'none';
  }, false);
});
document.addEventListener('drop', function(e) {
  const files = e.dataTransfer.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.match('image.*')) {
      processPhoto(file);
    }
  }
}, false);

function processPhoto(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      EXIF.getData(img, function() {
        const latDMS = EXIF.getTag(this, "GPSLatitude");
        const lonDMS = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
        const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "W";
        if (latDMS && lonDMS) {
          const dmsToDecimal = (dms, ref) => {
            const [degrees, minutes, seconds] = dms;
            let dd = degrees + minutes / 60 + seconds / 3600;
            if (ref === "S" || ref === "W") dd = dd * -1;
            return dd;
          };
          const latitude = dmsToDecimal(latDMS, latRef);
          const longitude = dmsToDecimal(lonDMS, lonRef);
          const markerEl = document.createElement('div');
          markerEl.className = 'photo-marker';
          const thumbnailSrc = e.target.result;
          const popupContent = `<img src="${thumbnailSrc}" alt="Photo Thumbnail" class="thumbnail" style="max-width:200px; cursor: pointer;"><br><strong>${file.name}</strong>`;
          const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent);
          const marker = new mapboxgl.Marker(markerEl, { anchor: 'bottom' })
            .setLngLat([longitude, latitude])
            .setPopup(popup)
            .addTo(map);
          photoMarkers.push(marker);
          markerEl.addEventListener('mouseenter', () => marker.togglePopup());
          markerEl.addEventListener('mouseleave', () => marker.togglePopup());
          let attempts = 0;
          const maxAttempts = 10;
          const checkPopup = () => {
            const popupElement = popup.getElement();
            if (popupElement) {
              const thumbImg = popupElement.querySelector('.thumbnail');
              if (thumbImg) {
                thumbImg.addEventListener('click', (event) => {
                  event.preventDefault();
                  largePhoto.src = thumbnailSrc;
                  photoModal.style.display = 'block';
                });
              }
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkPopup, 500);
            }
          };
          checkPopup();
          closeModal.addEventListener('click', () => photoModal.style.display = 'none');
          window.addEventListener('click', (event) => {
            if (event.target === photoModal) photoModal.style.display = 'none';
          });
          window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && photoModal.style.display === 'block') {
              photoModal.style.display = 'none';
            }
          });
        } else {
          alert("No GPS data found in " + file.name);
        }
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
