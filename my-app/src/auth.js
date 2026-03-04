import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

export const listenAuth = (cb) => onAuthStateChanged(auth, cb);
export const logout = () => signOut(auth);