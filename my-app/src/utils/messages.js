import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
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

  await addDoc(collection(db, "threads", threadId, "messages"), {
    text: t,
    from: fromUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "threads", threadId),
    {
      updatedAt: serverTimestamp(),
      lastMessage: t.slice(0, 200),
      lastFrom: fromUid,
    },
    { merge: true }
  );
}