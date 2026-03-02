import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

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
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-sm text-neutral-500">UrbanPulse</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            Intră în cont
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Folosește emailul și parola.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-5">
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
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            )}

            <button
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-neutral-900 text-white font-semibold active:scale-[0.99]
                         disabled:opacity-60 disabled:active:scale-100"
            >
              {busy ? "Se verifică..." : "Login"}
            </button>

            <div className="text-center text-sm text-neutral-600">
              N-ai cont?{" "}
              <Link to="/register" className="font-semibold text-neutral-900 underline underline-offset-4">
                Creează cont
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-4 text-xs text-neutral-500 text-center">
          Dacă ai uitat parola, facem după reset (pasul următor).
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
      <div className="mb-1.5 text-sm font-medium text-neutral-800">{label}</div>
      <input
        className="w-full h-12 rounded-2xl bg-neutral-50 border border-neutral-200 px-4 text-neutral-900
                   placeholder:text-neutral-400 outline-none
                   focus:bg-white focus:border-neutral-400 focus:ring-4 focus:ring-neutral-200/60 transition"
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