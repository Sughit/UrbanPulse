import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function pushNotification(uid, payload) {
  if (!uid) return;

  await addDoc(collection(db, "notifications", uid, "items"), {
    read: false,
    createdAt: serverTimestamp(),
    ...payload,
  });
}