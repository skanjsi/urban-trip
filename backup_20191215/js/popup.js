map.on("click", function onClick(event) {
  var geometry = event.point;
  var parameters = {
    layers: ["hipplacedb"]
  };
  var features = map.queryRenderedFeatures(geometry, parameters);
  console.log(features);
  var db__name = features[0].properties.name;
  var db__facilityType = features[0].properties.facilityType;
  var db__description = features[0].properties.description;
  var db__imageURL = features[0].properties.imageURL;
  console.log(db__name);
  console.log(db__facilityType);
  console.log(db__description);
  console.log(db__imageURL);

  var popup = new mapboxgl.Popup()
    .setLngLat(event.lngLat)
    .setHTML(
      `<h2 class="db__name">${db__name}</h2>
        <div class="db__facilityType">${db__facilityType}</div>
        <div class="db__description">${db__description}</div>
        <img class="db__imageURL" src="${db__imageURL}" />
        <button class="db__btn"> + 여행 일정에 추가 </button>`
    )
    .addTo(map);
});
