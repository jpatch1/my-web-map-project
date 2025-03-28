/* js/globals.js */

// Your Mapbox access token
mapboxgl.accessToken = 'TOKEN';


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
let futureTrips = JSON.parse(localStorage.getItem('futureTrips')) || [];
let isPlanningFutureTrip = false;
let futureTripPoints = [];
let currentTripName = '';
let editingRouteLegs = null;
let isEditingCampgrounds = false; // track if we are in "campground edit mode"


const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  marker: false,
  placeholder: "Search for campgrounds..."
});

function cleanCoord(val) {
  return parseFloat(String(val).replace(/[–—]/g, '-').trim());
}
