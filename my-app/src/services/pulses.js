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
} from "firebase/firestore";
import { db } from "../firebase";
import { pushNotification } from "./notifications";
import { notifyMatchingUsers } from "./matching";

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
  mode,
  urgency,
  title,
  text,
  location,
  createdBy,
  systemTag = null,
}) {
  const ref = await addDoc(collection(db, "pulses"), {
    type,
    mode,
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

  const pulseId = ref.id;

  const pulseData = {
    id: pulseId,
    type,
    mode,
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
  };

  try {
    await notifyMatchingUsers(pulseData);
  } catch (e) {
    console.warn("Matching notification failed:", e);
  }

  return pulseId;
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
    const nextCount = Number(current.confirmationsCount || 0) + 1;

    tx.update(pulseRef, {
      confirmationsCount: increment(1),
      verifiedInfo: nextCount >= 3 ? true : !!current.verifiedInfo,
      updatedAt: serverTimestamp(),
    });
  });

  if (ownerUid && ownerUid !== uid) {
    await pushNotification(ownerUid, {
      kind: "confirm",
      pulseId,
      byUid: uid,
      title: pulse.title || "",
    });
  }
}

export async function ensureSafetyCheckin({
  eventKey,
  location,
  createdBy = "system",
  severeTitle = "Severe Weather",
}) {
  const tag = `safety-checkin-${eventKey}`;

  const q = query(collection(db, "pulses"), where("systemTag", "==", tag));
  const snap = await getDocs(q);

  const payload = {
    type: "Emergency",
    mode: "need",
    urgency: 3,
    title: "Safety Check-in",
    text: `⚠️ ${severeTitle}. Scrie “Sunt OK” / “Am nevoie de ajutor” + detalii.`,
    location,
    status: "open",
    pinned: true,
    systemTag: tag,
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

  const first = snap.docs[0];
  await updateDoc(doc(db, "pulses", first.id), payload);
}

export async function reportPulse({ pulseId, uid, reason }) {
  if (!pulseId || !uid) return;

  const reportRef = doc(db, "pulses", pulseId, "reports", uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(reportRef);
    if (snap.exists()) return;

    tx.set(reportRef, {
      uid,
      reason: (reason || "").trim().slice(0, 300),
      createdAt: serverTimestamp(),
    });

    tx.update(doc(db, "pulses", pulseId), {
      reportsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });
}