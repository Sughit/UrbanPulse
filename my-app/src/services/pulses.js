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
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * MVP: fetch live pulses (latest first).
 * Pasul 2: filtrare pe raza cu query + calcul distanță în client (sau geofire).
 */
export function subscribeToPulses(onData) {
  const q = query(collection(db, "pulses"), orderBy("pinned", "desc"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onData(items);
  });
}

export async function createPulse({ type, urgency, title, text, location, createdBy }) {
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function confirmPulse(pulseId, uid) {
  // scrie confirmation doc (1 confirm per user)
  const cRef = doc(db, "pulses", pulseId, "confirmations", uid);
  const exists = await getDoc(cRef);
  if (exists.exists()) return;

  await setDoc(cRef, { createdAt: serverTimestamp() });

  // crește counter
  const pRef = doc(db, "pulses", pulseId);
  await updateDoc(pRef, { confirmationsCount: increment(1), updatedAt: serverTimestamp() });
}