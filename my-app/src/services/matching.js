import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { canReceivePulse, isNowInQuietHours, isRelevantSkill } from "../utils/matching";
import { pushNotification } from "./notifications";

export async function notifyMatchingUsers(pulse) {
  if (!pulse || pulse.mode !== "need") return;

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
    if (isNowInQuietHours(profile.quietHours) && !(pulse.type === "Emergency" && pulse.urgency === 3)) {
      continue;
    }
    if (!isRelevantSkill(pulse, profile.skillTags || [])) continue;

    await pushNotification(uid, {
      kind: "hero_alert",
      pulseId: pulse.id,
      title: pulse.title || "",
      body: "Ai fost selectat pentru că ai skill relevant și ești aproape.",
    });
  }
}