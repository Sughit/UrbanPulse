import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export function threadIdFor(a, b) {
  return [a, b].sort().join("_");
}

export async function getOrCreateThread(uid, otherUid) {
  const id = threadIdFor(uid, otherUid);

  await setDoc(
    doc(db, "threads", id),
    {
      participants: [uid, otherUid].sort(),
      updatedAt: serverTimestamp(),
      lastMessage: "",
      lastFrom: "",
    },
    { merge: true }
  );

  return id;
}

export async function sendMessage(threadId, fromUid, text) {
  const t = text.trim();
  if (!t) return;

  const threadRef = doc(db, "threads", threadId);
  const threadSnap = await getDoc(threadRef);
  if (!threadSnap.exists()) throw new Error("Conversația nu există.");

  const thread = threadSnap.data();
  const participants = Array.isArray(thread.participants)
    ? thread.participants
    : [];
  const toUid = participants.find((p) => p !== fromUid);

  await addDoc(collection(db, "threads", threadId, "messages"), {
    text: t,
    from: fromUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    threadRef,
    {
      updatedAt: serverTimestamp(),
      lastMessage: t.slice(0, 200),
      lastFrom: fromUid,
    },
    { merge: true }
  );

  if (toUid) {
    await addDoc(collection(db, "notifications", toUid, "items"), {
      kind: "message",
      threadId,
      title: "Mesaj nou",
      text: t.slice(0, 120),
      byUid: fromUid,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
}