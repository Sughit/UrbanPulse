export function toRad(x) {
  return (x * Math.PI) / 180;
}

export function distanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;

  const R = 6371000;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

export function resolveAnchorPosition(livePos, profileHome) {
  return livePos || profileHome || null;
}

export function resolveAnchorLabel(livePos, profileHome) {
  if (livePos) return "Locație live";
  if (profileHome) return "Locație profil";
  return "Fără locație";
}