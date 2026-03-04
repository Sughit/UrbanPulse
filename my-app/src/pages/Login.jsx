import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      nav("/");
    } catch (e2) {
      setErr(e2?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h1 className="mt-1 text-2xl font-extrabold">Conectează-te</h1>
          <div className="mt-1 text-sm text-zinc-400">
            Bine ai revenit!
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-200">
              <span className="font-extrabold">Eroare:</span> {err}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300">
                Email
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplu@email.com"
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
            </div>

            <button
              disabled={busy}
              className="w-full rounded-3xl bg-yellow-400 px-5 py-3 text-base font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50"
            >
              {busy ? "Se conectează..." : "Conectează-te"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-zinc-400">
            Nu ai un cont?{" "}
            <Link className="font-extrabold text-yellow-300 hover:text-yellow-200" to="/register">
              Înregistrează-te
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}