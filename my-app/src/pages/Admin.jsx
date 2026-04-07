import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export default function Admin() {
  const [pulses, setPulses] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, "pulses"), orderBy("createdAt", "desc")),
      (snap) => setPulses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsub2 = onSnapshot(collection(db, "users"), (snap) =>
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  async function toggleVerifyUser(uid, current) {
    await updateDoc(doc(db, "users", uid), { verifiedNeighbor: !current });
  }

  async function closePulse(id) {
    await updateDoc(doc(db, "pulses", id), { status: "closed" });
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-950 text-zinc-100 px-4 py-5">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-extrabold">Admin Dashboard</h1>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-lg font-extrabold">Utilizatori</div>
          <div className="mt-4 space-y-3">
            {users.map((u) => (
              <div key={u.id} className="rounded-2xl border border-zinc-800 p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{u.displayName || u.email || u.id}</div>
                  <div className="text-xs text-zinc-500">
                    Trust: {u.trustScore || 0} | {u.verifiedNeighbor ? "Verified" : "Neverificat"}
                  </div>
                </div>
                <button
                  onClick={() => toggleVerifyUser(u.id, !!u.verifiedNeighbor)}
                  className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950"
                >
                  Schimbați verificarea
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-lg font-extrabold">Postări</div>
          <div className="mt-4 space-y-3">
            {pulses.map((p) => (
              <div key={p.id} className="rounded-2xl border border-zinc-800 p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{p.title}</div>
                  <div className="text-xs text-zinc-500">
                    {p.type} | {p.mode} | {p.status} | confirmări: {p.confirmationsCount || 0}
                  </div>
                </div>
                <button
                  onClick={() => closePulse(p.id)}
                  className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-extrabold text-zinc-200"
                >
                  Închide
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}