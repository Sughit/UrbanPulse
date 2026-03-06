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
  getDoc,
  where,
  getDocs,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { distanceMeters } from "../utils/geo";

async function createUserNotification(targetUid, payload) {
  if (!targetUid) return;

  await addDoc(collection(db, "notifications", targetUid, "items"), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
}

async function notifyNearbyUsersForUrgentPulse(pulseId, pulse) {
  if (
    pulse.type !== "Emergency" ||
    Number(pulse.urgency) !== 3 ||
    !pulse.location
  ) {
    return;
  }

  const profilesSnap = await getDocs(collection(db, "profiles"));

  const writes = [];

  profilesSnap.forEach((profileDoc) => {
    const targetUid = profileDoc.id;
    const profile = profileDoc.data();

    if (!targetUid || targetUid === pulse.createdBy) return;
    if (!profile?.home) return;

    const limitMeters = Number(profile.distanceLimitMeters ?? 2000);
    const dist = distanceMeters(profile.home, pulse.location);

    if (dist <= limitMeters) {
      writes.push(
        createUserNotification(targetUid, {
          kind: "urgent-pulse",
          pulseId,
          title: pulse.title || "Emergency nearby",
          text: pulse.text || "",
          byUid: pulse.createdBy || "",
        })
      );
    }
  });

  await Promise.all(writes);
}

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

export async function createPulse({
  type,
  urgency,
  title,
  text,
  location,
  createdBy,
  systemTag = null,
}) {
  const payload = {
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
  };

  const ref = await addDoc(collection(db, "pulses"), payload);

  await notifyNearbyUsersForUrgentPulse(ref.id, {
    ...payload,
    createdBy,
  });

  return ref.id;
}

export async function confirmPulse(pulseId, uid) {
  const pulseRef = doc(db, "pulses", pulseId);
  const pulseSnap = await getDoc(pulseRef);
  if (!pulseSnap.exists()) throw new Error("Postarea nu există.");

  const pulse = pulseSnap.data();
  const ownerUid = pulse.createdBy;

  await runTransaction(db, async (tx) => {
    const cRef = doc(db, "pulses", pulseId, "confirmations", uid);
    const cSnap = await tx.get(cRef);
    if (cSnap.exists()) return;

    tx.set(cRef, { createdAt: serverTimestamp() });

    const pSnap = await tx.get(pulseRef);
    if (!pSnap.exists()) throw new Error("Postarea nu există.");

    const current = pSnap.data();
    const currentCount = Number(current.confirmationsCount || 0);
    const nextCount = currentCount + 1;

    tx.update(pulseRef, {
      confirmationsCount: increment(1),
      verifiedInfo: nextCount >= 3 ? true : current.verifiedInfo || false,
      updatedAt: serverTimestamp(),
    });
  });

  if (ownerUid && ownerUid !== uid) {
    await createUserNotification(ownerUid, {
      kind: "confirm",
      pulseId,
      byUid: uid,
      title: pulse.title || "",
    });
  }
}

export async function ensureSafetyCheckin({
  location,
  createdBy = "system",
  severeTitle = "Severe Weather",
}) {
  const q = query(
    collection(db, "pulses"),
    where("systemTag", "==", "safety-checkin")
  );
  const snap = await getDocs(q);

  const payload = {
    type: "Emergency",
    urgency: 3,
    title: "Safety Check-in",
    text: `${severeTitle}. Scrie “Sunt OK” / “Am nevoie de ajutor” + detalii.`,
    location,
    status: "open",
    pinned: true,
    systemTag: "safety-checkin",
    verifiedInfo: true,
    updatedAt: serverTimestamp(),
  };

  if (snap.empty) {
    await addDoc(collection(db, "pulses"), {
      ...payload,
      createdBy,
      confirmationsCount: 0,
      createdAt: serverTimestamp(),
    });
    return;
  }

  const docs = snap.docs;

  await updateDoc(doc(db, "pulses", docs[0].id), payload);

  if (docs.length > 1) {
    const extraUpdates = docs.slice(1).map((d) =>
      updateDoc(doc(db, "pulses", d.id), {
        pinned: false,
        status: "closed",
        updatedAt: serverTimestamp(),
      })
    );
    await Promise.all(extraUpdates);
  }
}