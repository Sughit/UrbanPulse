import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function AdminRoute() {
  const [allowed, setAllowed] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAllowed(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", u.uid));
      setAllowed(snap.exists() && snap.data().role === "admin");
    });

    return () => unsub();
  }, []);

  if (allowed === undefined) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}