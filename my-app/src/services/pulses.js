import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  setDoc,
  getDoc,
  where,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Live pulses (latest first).
 */
export function subscribeToPulses(onData) {
  const q = query(
    collection(db, "pulses"),
    orderBy("pinned", "desc"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onData(items);
  });
}

export async function createPulse({ type, urgency, title, text, location, createdBy, systemTag = null }) {
  const ref = await addDoc(collection(db, "pulses"), {
    type,
    urgency,
    title,
    text,
    location,
    createdBy,
    status: "open",
    pinned: false,
    verifiedInfo: false,
    confirmationsCount: 0,
    systemTag: systemTag || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Confirm pulse:
 * - 1 confirm / user
 * - increments confirmationsCount
 * - if >= 3 => verifiedInfo true
 * - sends notification to pulse owner (if not self)
 */
export async function confirmPulse(pulseId, uid) {
  const pulseRef = doc(db, "pulses", pulseId);
  const pulseSnap = await getDoc(pulseRef);
  if (!pulseSnap.exists()) throw new Error("Postarea nu există.");

  const pulse = pulseSnap.data();
  const ownerUid = pulse.createdBy;

  await runTransaction(db, async (tx) => {
    const cRef = doc(db, "pulses", pulseId, "confirmations", uid);
    const cSnap = await tx.get(cRef);
    if (cSnap.exists()) return; // deja confirmat

    tx.set(cRef, { createdAt: serverTimestamp() });

    const pSnap = await tx.get(pulseRef);
    if (!pSnap.exists()) throw new Error("Postarea nu există.");

    const current = pSnap.data();
    const currentCount = Number(current.confirmationsCount || 0);
    const nextCount = currentCount + 1;

    tx.update(pulseRef, {
      confirmationsCount: increment(1),
      verifiedInfo: nextCount >= 3 ? true : (current.verifiedInfo || false),
      updatedAt: serverTimestamp(),
    });
  });

  // Notificare către owner
  if (ownerUid && ownerUid !== uid) {
    await addDoc(collection(db, "notifications", ownerUid, "items"), {
      kind: "confirm",
      pulseId,
      byUid: uid,
      title: pulse.title || "",
      createdAt: serverTimestamp(),
      read: false,
    });
  }
}

/**
 * Severe Weather => ensure pinned "Safety Check-in".
 * We store it as a pulse with systemTag = "safety-checkin".
 */
export async function ensureSafetyCheckin({ location, createdBy = "system", severeTitle = "Severe Weather" }) {
  const q = query(
    collection(db, "pulses"),
    where("systemTag", "==", "safety-checkin")
  );
  const snap = await getDocs(q);

  const payload = {
    type: "Emergency",
    urgency: 3,
    title: "Safety Check-in",
    text: `⚠️ ${severeTitle}. Scrie “Sunt OK” / “Am nevoie de ajutor” + detalii.`,
    location,
    status: "open",
    pinned: true,
    systemTag: "safety-checkin",
    updatedAt: serverTimestamp(),
  };

  if (snap.empty) {
    await addDoc(collection(db, "pulses"), {
      ...payload,
      createdBy,
      verifiedInfo: true,
      confirmationsCount: 0,
      createdAt: serverTimestamp(),
    });
    return;
  }

  // update first existing
  const first = snap.docs[0];
  await updateDoc(doc(db, "pulses", first.id), payload);
}