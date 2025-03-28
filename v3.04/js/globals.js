mapboxgl.accessToken = 'TOKEN HERE';

let globalData = [];
let csvMarkers = [];
let photoMarkers = [];
let routes = [];
let nationalParksData = null;
let newMarker = null;
let editMarkers = new Map();
let isAddingMarker = false;
let isEditingMode = false;
let isStreetViewMode = false;
let streetViewMarker = null;
let futureTrips = []; // Now loaded from server
let isPlanningFutureTrip = false;
let futureTripPoints = [];
let currentTripName = '';
let editingRouteLegs = null;
let isEditingStops = false; // Renamed from isEditingCampgrounds
let unsavedChanges = false; // Track unsaved trip changes

const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  marker: false,
  placeholder: "Search for stops..." // Renamed
});

function cleanCoord(val) {
  return parseFloat(String(val).replace(/[–—]/g, '-').trim());
}
