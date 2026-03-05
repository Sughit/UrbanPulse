import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export function makeEventKeyFromAlert(alert) {
  const e = (alert?.event || "severe-weather")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  const start = Number(alert?.start || 0);
  const end = Number(alert?.end || 0);

  return `${start}_${end}_${e}`;
}

export async function hasCheckedIn(eventKey, uid) {
  if (!uid || !eventKey) return false;
  const ref = doc(db, "safetyCheckins", eventKey, "responses", uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function safetyCheckIn(eventKey, uid) {
  const ref = doc(db, "safetyCheckins", eventKey, "responses", uid);
  await setDoc(ref, {
    status: "ok",
    createdAt: serverTimestamp(),
  });
}