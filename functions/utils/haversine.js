/**
 * Pure JS Haversine — no external library needed.
 * Returns distance in kilometers between two lat/lng points.
 */

function getDistance(point1, point2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
    Math.cos(toRad(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Computes a bounding box around a center point for fast Firestore pre-filtering.
 * @param {{ lat: number, lng: number }} center
 * @param {number} radiusKm
 */
function computeBoundingBox(center, radiusKm) {
  const DEGREES_PER_KM = 1 / 111;
  const delta = radiusKm * DEGREES_PER_KM;
  return {
    lat_min: center.lat - delta,
    lat_max: center.lat + delta,
    lng_min: center.lng - delta,
    lng_max: center.lng + delta,
  };
}

module.exports = { getDistance, toRad, computeBoundingBox };
