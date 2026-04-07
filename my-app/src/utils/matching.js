import { distanceMeters } from "./geo";

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

export function isNowInQuietHours(quietHours) {
  if (!quietHours?.start || !quietHours?.end) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = quietHours.start.split(":").map(Number);
  const [eh, em] = quietHours.end.split(":").map(Number);

  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

export function pulseKeywords(pulse) {
  return `${pulse.title || ""} ${pulse.text || ""} ${pulse.type || ""} ${pulse.mode || ""}`
    .toLowerCase()
    .trim();
}

export function isRelevantSkill(pulse, skillTags = []) {
  const hay = pulseKeywords(pulse);
  return skillTags.some((tag) => hay.includes(normalize(tag)));
}

export function canReceivePulse(candidateProfile, pulse) {
  if (!candidateProfile?.home || !pulse?.location) return false;

  const limit = Number(candidateProfile.distanceLimitMeters || 2000);
  const dist = distanceMeters(candidateProfile.home, pulse.location);

  return dist <= limit;
}