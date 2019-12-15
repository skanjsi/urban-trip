mapboxgl.accessToken =
  "pk.eyJ1IjoidXJiYW5pbiIsImEiOiJjazMya3huZmowMnoyM21waWJiZmJhcXhmIn0.ji6EuAtrz23QDiP-gdw-Yw";
var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/urbanin/ck3d0b69w2so61cqd919x1rjh",
  center: [127.051954, 37.544775], // 지도 중심 경위도
  zoom: 13 // 지도 줌 레벨
});
