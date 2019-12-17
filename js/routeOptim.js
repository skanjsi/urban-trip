var truckLocation = [127.056934, 37.544118];
var warehouseLocation = [127.056934, 37.544118];
var lastQueryTime = 0;
var lastAtRestaurant = 0;
var keepTrack = [];
var currentSchedule = [];
var currentRoute = null;
var pointHopper = {};
var pause = true;
var speedFactor = 50;

mapboxgl.accessToken =
  "pk.eyJ1IjoidXJiYW5pbiIsImEiOiJjazMya3huZmowMnoyM21waWJiZmJhcXhmIn0.ji6EuAtrz23QDiP-gdw-Yw";
var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/urbanin/ck3mp0q6s0r791cqo3v2hx7x5",
  center: [127.051954, 37.544775], // 지도 중심 경위도
  zoom: 13 // 지도 줌 레벨
});
/*--------------------------------------------------------------------------
---------------------------------------------------------------------------*/

var warehouse = turf.featureCollection([turf.point(warehouseLocation)]);
var dropoffs = turf.featureCollection([]);
var nothing = turf.featureCollection([]);

/*--------------------------------------------------------------------------
---------------------------------------------------------------------------*/

map.on("load", function() {
  var marker = document.createElement("div");
  marker.classList = "truck";

  // Create a new marker
  truckMarker = new mapboxgl.Marker(marker).setLngLat(truckLocation).addTo(map);

  // Listen for a click on the map
  map.on("click", function(e) {
    // When the map is clicked, add a new drop-off point
    // and update the `dropoffs-symbol` layer
    newDropoff(map.unproject(e.point));
    updateDropoffs(dropoffs);
  });

  /*---------------------스타일-------------------------*/

  map.addLayer({
    id: "warehouse",
    type: "circle",
    source: {
      data: warehouse,
      type: "geojson"
    },
    paint: {
      "circle-radius": 13,
      "circle-color": "white",
      "circle-stroke-color": "rgb(0, 176, 80)",
      "circle-stroke-width": 3
    }
  });

  // Create a symbol layer on top of circle layer
  map.addLayer({
    id: "warehouse-symbol",
    type: "symbol",
    source: {
      data: warehouse,
      type: "geojson"
    },
    layout: {
      "icon-image": "bicycle-15",
      "icon-size": 1.2
    },
    paint: {
      "text-color": "red"
    }
  });
  map.addLayer({
    id: "dropoffs-symbol",
    type: "symbol",
    source: {
      data: dropoffs,
      type: "geojson"
    },
    layout: {
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-image": "marker-15",
      "icon-size": 1.2
    }
  });

  map.addSource("route", {
    type: "geojson",
    data: nothing
  });

  map.addLayer(
    {
      id: "routeline-active",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "rgb(0, 88, 40)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 22, 8]
      }
    },
    "waterway-label"
  );
  map.addLayer(
    {
      id: "routearrows",
      type: "symbol",
      source: "route",
      layout: {
        "symbol-placement": "line",
        "text-field": "▶",
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 16, 22, 40],
        "symbol-spacing": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          20,
          22,
          110
        ],
        "text-keep-upright": false
      },
      paint: {
        "text-color": "rgb(0, 176, 80)",
        "text-halo-color": "hsl(55, 11%, 96%)",
        "text-halo-width": 2
      }
    },
    "waterway-label"
  );
});

/*-----------------outside of map.on('load', function()) ---------------------*/

function newDropoff(coords) {
  // Store the clicked point as a new GeoJSON feature with
  // two properties: `orderTime` and `key`
  var pt = turf.point([coords.lng, coords.lat], {
    orderTime: Date.now(),
    key: Math.random()
  });
  dropoffs.features.push(pt);
  pointHopper[pt.properties.key] = pt;

  // Make a request to the Optimization API
  $.ajax({
    method: "GET",
    url: assembleQueryURL()
  }).done(function(data) {
    // Create a GeoJSON feature collection
    var routeGeoJSON = turf.featureCollection([
      turf.feature(data.trips[0].geometry)
    ]);

    // If there is no route provided, reset
    if (!data.trips[0]) {
      routeGeoJSON = nothing;
    } else {
      // Update the `route` source by getting the route source
      // and setting the data equal to routeGeoJSON
      map.getSource("route").setData(routeGeoJSON);
    }

    if (data.waypoints.length === 12) {
      window.alert(
        "Maximum number of points reached. Read more at docs.mapbox.com/api/navigation/#optimization."
      );
    }
  });
}

function updateDropoffs(geojson) {
  map.getSource("dropoffs-symbol").setData(geojson);
}

/*------------------------------------------------------------------------*/

// Here you'll specify all the parameters necessary for requesting a response from the Optimization API
function assembleQueryURL() {
  // Store the location of the truck in a variable called coordinates
  var coordinates = [truckLocation];
  var distributions = [];
  keepTrack = [truckLocation];

  // Create an array of GeoJSON feature collections for each point
  var restJobs = objectToArray(pointHopper);

  // If there are any orders from this restaurant
  if (restJobs.length > 0) {
    // Check to see if the request was made after visiting the restaurant
    var needToPickUp =
      restJobs.filter(function(d, i) {
        return d.properties.orderTime > lastAtRestaurant;
      }).length > 0;

    // If the request was made after picking up from the restaurant,
    // Add the restaurant as an additional stop
    if (needToPickUp) {
      var restaurantIndex = coordinates.length;
      // Add the restaurant as a coordinate
      coordinates.push(warehouseLocation);
      // push the restaurant itself into the array
      keepTrack.push(pointHopper.warehouse);
    }

    restJobs.forEach(function(d, i) {
      // Add dropoff to list
      keepTrack.push(d);
      coordinates.push(d.geometry.coordinates);
      // if order not yet picked up, add a reroute
      if (needToPickUp && d.properties.orderTime > lastAtRestaurant) {
        distributions.push(restaurantIndex + "," + (coordinates.length - 1));
      }
    });
  }

  // Set the profile to `driving`
  // Coordinates will include the current location of the truck,
  return (
    "https://api.mapbox.com/optimized-trips/v1/mapbox/cycling/" +
    coordinates.join(";") +
    "?distributions=" +
    distributions.join(";") +
    "&overview=full&steps=true&geometries=geojson&source=first&access_token=" +
    mapboxgl.accessToken
  );
}

function objectToArray(obj) {
  var keys = Object.keys(obj);
  var routeGeoJSON = keys.map(function(key) {
    return obj[key];
  });
  return routeGeoJSON;
}
