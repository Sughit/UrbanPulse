import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(form);
      nav("/profile");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-xs tracking-widest text-gray-400">URBANPULSE</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Intră în cont</h1>
          <p className="mt-1 text-sm text-gray-400">
            Folosește emailul și parola ca să continui.
          </p>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 shadow-xl">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="ex: robert@gmail.com"
              value={form.email}
              onChange={onChange}
              autoComplete="email"
            />
            <Field
              label="Parolă"
              name="password"
              type="password"
              placeholder="parola ta"
              value={form.password}
              onChange={onChange}
              autoComplete="current-password"
            />

            {err && (
              <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}

            <button
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-green-500 text-black font-semibold
                         hover:bg-green-400 active:scale-[0.99]
                         disabled:opacity-60 disabled:active:scale-100"
            >
              {busy ? "Se verifică..." : "Login"}
            </button>

            <div className="text-center text-sm text-gray-400">
              N-ai cont?{" "}
              <Link
                to="/register"
                className="font-semibold text-green-400 hover:text-green-300"
              >
                Creează cont
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Tip: dacă îți sare logout la refresh, e fix-ul de “/me + credentials”.
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-gray-200">{label}</div>
      <input
        className="w-full h-12 rounded-2xl bg-gray-950/60 border border-gray-800 px-4 text-white
                   placeholder:text-gray-500 outline-none
                   focus:border-gray-600 focus:ring-4 focus:ring-gray-800/60 transition"
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
      />
    </label>
  );
}