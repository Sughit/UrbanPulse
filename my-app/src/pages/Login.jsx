import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      nav("/");
    } catch (e2) {
      const code = e2?.code || "";
      if (code.includes("invalid-credential") || code.includes("wrong-password"))
        setErr("Email sau parolă greșită.");
      else if (code.includes("invalid-email"))
        setErr("Email invalid.");
      else
        setErr("Eroare la autentificare. Încearcă din nou.");
      console.error(e2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Login</h1>

        {err && <div className="mb-3 text-sm text-red-300">{err}</div>}

        <label className="block text-sm mb-1">Email</label>
        <input
          className="w-full mb-3 p-3 rounded-xl bg-black/20 border border-white/10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ex: robert@email.com"
        />

        <label className="block text-sm mb-1">Parolă</label>
        <input
          type="password"
          className="w-full mb-4 p-3 rounded-xl bg-black/20 border border-white/10"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        <button
          disabled={loading}
          className="w-full p-3 rounded-xl bg-white text-black font-semibold disabled:opacity-60"
        >
          {loading ? "Se conectează..." : "Login"}
        </button>

        <p className="text-sm mt-4 opacity-80">
          N-ai cont? <Link to="/register" className="underline">Register</Link>
        </p>
      </form>
    </div>
  );
}