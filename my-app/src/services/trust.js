import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export async function leavePositiveFeedback({ fromUid, toUid, pulseId }) {
  if (!fromUid || !toUid || !pulseId || fromUid === toUid) return;

  await addDoc(collection(db, "feedback"), {
    fromUid,
    toUid,
    pulseId,
    positive: true,
    createdAt: serverTimestamp(),
  });

  const q = query(
    collection(db, "feedback"),
    where("toUid", "==", toUid),
    where("positive", "==", true)
  );

  const snap = await getDocs(q);
  const total = snap.size;
  const trustScore = Math.floor(total / 3);
  const verifiedNeighbor = trustScore >= 3;

  await setDoc(
    doc(db, "users", toUid),
    {
      trustScore,
      verifiedNeighbor,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markPulseResolved(pulseId, helperUid) {
  await updateDoc(doc(db, "pulses", pulseId), {
    status: "resolved",
    resolvedBy: helperUid || null,
    updatedAt: serverTimestamp(),
  });
}