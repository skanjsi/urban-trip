var startPointLocation = [127.056934, 37.544118];
var endPointLocation = [127.046964, 37.544348];
// i don't know about below lines
var lastQueryTime = 0;
var lastAtRestaurant = 0;
var keepTrack = [];
var currentSchedule = [];
var currentRoute = null;
var pointHopper = {};
var pause = true;
var speedFactor = 50;

//원래 위 코드는 initialize a map 앞에 들어가는 것들

var endPoint = turf.featureCollection([turf.point(endPointLocation)]);
var selectedPlaces = turf.featureCollection([]);
var nothing = turf.featureCollection([]); // why 'nothing'?

map.on("load", function() {
  var marker = document.createElement("div");
  marker.classList = "startPoint";

  startPointMarker = new mapboxgl.Marker(marker)
    .setLngLat(startPointLocation)
    .addTo(map);

  //Create a circle layer
  map.addLayer({
    id: "endPoint",
    type: "circle",
    source: {
      data: endPoint,
      type: "geojson"
    },
    paint: {
      "circle-radius": 20,
      "circle-color": "white",
      "circle-stroke-color": "red",
      "circle-stroke-width": 3
    }
  });

  //Create a symbol layer on top of circle layer
  map.addLayer({
    id: "endPoint-symbol",
    type: "symbol",
    source: {
      data: endPoint,
      type: "geojson"
    },
    layout: {
      "icon-image": "grocery-15",
      "icon-size": 1
    },
    paint: {
      "text-color": "red"
    }
  });
  //route
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
        "line-color": "red",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 22, 12]
      }
    },
    "waterway-label"
  );
  //selectedPlaces symbol layer
  map.addLayer({
    id: "selectedPlaces-symbol",
    type: "symbol",
    source: {
      data: selectedPlaces,
      type: "geojson"
    },
    layout: {
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-image": "marker-15"
    }
  });

  //화살표 스타일
  map.addLayer(
    {
      id: "routearrows",
      type: "symbol",
      source: "route",
      layout: {
        "symbol-placement": "line",
        "text-field": "▶",
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 24, 22, 60],
        "symbol-spacing": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          30,
          22,
          160
        ],
        "text-keep-upright": false
      },
      paint: {
        "text-color": "red",
        "text-halo-color": "hsl(55,11%,96%)",
        "text-halo-width": 3
      }
    },
    "waterway-label"
  );
  //Listen for a click on the map (수정되어야 할 부분)
  map.on("click", function(e) {
    newSelectedPlaces(map.unproject(e.point));
    updateSelectedPlaces(selectedPlaces);

    function newSelectedPlaces(coords) {
      //Store the clicked point as a new GeoJSON feature with
      //two properties: 'orderTime' and 'Key'
      var pt = turf.point([coords.lng, coords.lat], {
        orderTime: Date.now(),
        key: Math.random()
      });
      selectedPlaces.features.push(pt);
      pointHopper[pt.properties.key] = pt;

      //Make a request to the Optimization API
      $.ajax({
        method: "GET",
        url: assembleQueryURL()
      }).done(function(data) {
        // Create a GeoJSON feature collection
        var routeGeoJSON = turf.featureCollection([
          turf.feature(data.trips[0].geometry)
        ]);
        //If there is no route provided, reset
        // !data가 뭘까?
        if (!data.trips[0]) {
          routeGeoJSON = nothing;
        } else {
          // Update the 'route' source by getting the route source
          // and setting the data equal to routeGeoJSON
          map.getSource("route").setData(routeGeoJSON);
        }
        // 경고 메세지 보내기
        if (data.waypoints.length === 12) {
          window.alert("Maximum number of points reached.");
        }
      });
    }

    function updateSelectedPlaces(geojson) {
      map.getSource("selectedPlaces-symbol").setData(geojson);
    }

    //for Optimization API
    function assembleQueryURL() {
      //Store the location of the startPoint in a variable called coordinates
      var coordinates = [startPointLocation];
      var distributions = [];
      keepTrack = [startPointLocation];
      //Create an array of GeoJSON feature collections for each point
      // 아래부터 하나도 모르지만 일단 똑같이 따라써 봄
      var restJobs = objectToArray(pointHopper);
      //if there are any orders from this restaurant
      if (restJobs.length > 0) {
        //Check to see if the request was made after visiting the restaurant
        var needToPickup =
          restJobs.filter(function(d, i) {
            return d.properties.orderTime > lastAtRestaurant;
          }).length > 0;

        //if the request was made after picking up form the restaurant,
        //Add the restaurant as an additional stop
        if (needToPickup) {
          var restaurantIndex = coordinates.length;
          //Add the resaurant as a coordinate
          coordinates.push(endPointLocation);
          //push the restaurant itself into the array
          keepTrack.push(pointHopper.endPoint);
        }

        restJobs.forEach(function(d, i) {
          // Add dropoff to list
          keepTrack.push(d);
          coordinates.push(d.geometry.coordinates);
          // if order not yet picked up, add a reroute
          if (needToPickup && d.properties.orderTime > lastAtRestaurant) {
            distrivutions.push(
              restaurantIndex + "," + (coordinates.length - 1)
            );
          }
        });
      }
      // Set the profile to 'cycling'
      // Coordinates will include the current location of the startPoint,
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
  });
});
