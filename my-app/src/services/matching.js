import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  canReceivePulse,
  isNowInQuietHours,
  isRelevantSkill,
} from "../utils/matching";
import { pushNotification } from "./notifications";

export async function notifyMatchingUsers(pulse) {
  if (!pulse) return;

  const usersSnap = await getDocs(collection(db, "users"));
  const profilesSnap = await getDocs(collection(db, "profiles"));

  const users = new Map(usersSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const profiles = profilesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  for (const profile of profiles) {
    const uid = profile.id;
    if (!uid || uid === pulse.createdBy) continue;

    const user = users.get(uid);
    if (!user) continue;
    if (!canReceivePulse(profile, pulse)) continue;

    const isEmergencyUrgent = pulse.type === "Emergency" && Number(pulse.urgency) === 3;
    if (isNowInQuietHours(profile.quietHours) && !isEmergencyUrgent) continue;

    if (pulse.mode === "need" && isRelevantSkill(pulse, profile.skillTags || [])) {
      await pushNotification(uid, {
        kind: "hero_alert",
        pulseId: pulse.id,
        title: pulse.title || "",
        text: "Ai fost selectat pentru că ai skill relevant și ești aproape.",
      });
      continue;
    }

    if (isEmergencyUrgent) {
      await pushNotification(uid, {
        kind: "urgent-pulse",
        pulseId: pulse.id,
        title: pulse.title || "Urgență în apropiere",
        text: "Există o urgență aproape de tine.",
      });
    }
  }
}