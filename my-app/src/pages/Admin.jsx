import { useEffect, useMemo, useState } from "react";
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
  const [filter, setFilter] = useState("all");

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
    await updateDoc(doc(db, "users", uid), {
      verifiedNeighbor: !current,
    });
  }

  async function closePulse(id) {
    await updateDoc(doc(db, "pulses", id), {
      status: "closed",
    });
  }

  async function toggleVerifyPulse(id, current) {
    await updateDoc(doc(db, "pulses", id), {
      verifiedInfo: !current,
    });
  }

  async function togglePinnedPulse(id, current) {
    await updateDoc(doc(db, "pulses", id), {
      pinned: !current,
    });
  }

  async function toggleUserBlocked(uid, current) {
    await updateDoc(doc(db, "users", uid), {
      blocked: !current,
    });
  }

  const filteredPulses = useMemo(() => {
    if (filter === "open") return pulses.filter((p) => p.status === "open");
    if (filter === "closed") return pulses.filter((p) => p.status === "closed");
    if (filter === "verified") return pulses.filter((p) => p.verifiedInfo);
    if (filter === "emergency") return pulses.filter((p) => p.type === "Emergency");
    return pulses;
  }, [pulses, filter]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-950 text-zinc-100 px-4 py-5">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-extrabold">Admin Dashboard</h1>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-lg font-extrabold">Utilizatori</div>
          <div className="mt-4 space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="rounded-2xl border border-zinc-800 p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold">{u.displayName || u.email || u.id}</div>
                  <div className="text-xs text-zinc-500">
                    Trust: {u.trustScore || 0} | {u.verifiedNeighbor ? "Verified" : "Neverificat"} |{" "}
                    {u.blocked ? "Blocat" : "Activ"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleVerifyUser(u.id, !!u.verifiedNeighbor)}
                    className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950"
                  >
                    Verificare
                  </button>

                  <button
                    onClick={() => toggleUserBlocked(u.id, !!u.blocked)}
                    className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-extrabold text-zinc-200"
                  >
                    {u.blocked ? "Deblochează" : "Blochează"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-lg font-extrabold">Postări</div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
            >
              <option value="all">Toate</option>
              <option value="open">Deschise</option>
              <option value="closed">Închise</option>
              <option value="verified">Verificate</option>
              <option value="emergency">Urgențe</option>
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {filteredPulses.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-zinc-800 p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold">{p.title}</div>
                  <div className="text-xs text-zinc-500">
                    {p.type} | {p.mode} | {p.status} | confirmări: {p.confirmationsCount || 0} |{" "}
                    {p.verifiedInfo ? "Verificat" : "Neverificat"} | {p.pinned ? "Fixat" : "Nefixat"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => closePulse(p.id)}
                    className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-extrabold text-zinc-200"
                  >
                    Închide
                  </button>

                  <button
                    onClick={() => toggleVerifyPulse(p.id, !!p.verifiedInfo)}
                    className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950"
                  >
                    {p.verifiedInfo ? "Scoate verificarea" : "Verifică"}
                  </button>

                  <button
                    onClick={() => togglePinnedPulse(p.id, !!p.pinned)}
                    className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-extrabold text-zinc-200"
                  >
                    {p.pinned ? "Unpin" : "Pin"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}