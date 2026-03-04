import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });

      // init users/{uid} and profiles/{uid}
      const uid = cred.user.uid;

      await setDoc(
        doc(db, "users", uid),
        {
          displayName: name.trim(),
          email: email.trim(),
          role: "user",
          verifiedNeighbor: false,
          trustScore: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "profiles", uid),
        {
          neighborhoodName: "",
          radiusMeters: 500,
          distanceLimitMeters: 2000,
          quietHours: { start: "22:00", end: "07:00" },
          skillTags: [],
          home: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      nav("/");
    } catch (e2) {
      setErr(e2?.message || "Register failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h1 className="mt-1 text-2xl font-extrabold">Înregistrează-te</h1>
          <div className="mt-1 text-sm text-zinc-400">
            Crează un nou cont.
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-200">
              <span className="font-extrabold">Eroare:</span> {err}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300">
                Nume
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Robert"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300">
                Email
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300">
                Parolă
              </label>
              <input
                type="password"
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <div className="mt-1 text-[11px] text-zinc-500">
                Folosește o parolă puternică (min 6 caractere).
              </div>
            </div>

            <button
              disabled={busy}
              className="w-full rounded-3xl bg-yellow-400 px-5 py-3 text-base font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50"
            >
              {busy ? "Se crează..." : "Crează contul"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-zinc-400">
            Ai deja un cont?{" "}
            <Link className="font-extrabold text-yellow-300 hover:text-yellow-200" to="/login">
              Conectează-te
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}