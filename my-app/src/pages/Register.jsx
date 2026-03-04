import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Register() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const u = username.trim();
    const em = email.trim();

    if (!u) return setErr("Scrie un username.");
    if (!em) return setErr("Scrie un email.");
    if (pass.length < 6) return setErr("Parola trebuie să aibă minim 6 caractere.");
    if (pass !== pass2) return setErr("Parolele nu coincid.");

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, em, pass);

      await updateProfile(cred.user, { displayName: u });

      await setDoc(doc(db, "users", cred.user.uid), {
        username: u,
        email: em,
        role: "USER",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      nav("/"); 
    } catch (e2) {
      const code = e2?.code || "";
      if (code.includes("email-already-in-use")) setErr("Emailul este deja folosit.");
      else if (code.includes("invalid-email")) setErr("Email invalid.");
      else if (code.includes("weak-password")) setErr("Parolă prea slabă.");
      else setErr("Eroare la înregistrare. Încearcă din nou.");
      console.error(e2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Creează cont</h1>

        {err && <div className="mb-3 text-sm text-red-300">{err}</div>}

        <label className="block text-sm mb-1">Username</label>
        <input
          className="w-full mb-3 p-3 rounded-xl bg-black/20 border border-white/10"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex: Robert"
        />

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
          className="w-full mb-3 p-3 rounded-xl bg-black/20 border border-white/10"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="minim 6 caractere"
        />

        <label className="block text-sm mb-1">Confirmă parola</label>
        <input
          type="password"
          className="w-full mb-4 p-3 rounded-xl bg-black/20 border border-white/10"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
        />

        <button
          disabled={loading}
          className="w-full p-3 rounded-xl bg-white text-black font-semibold disabled:opacity-60"
        >
          {loading ? "Se creează..." : "Register"}
        </button>

        <p className="text-sm mt-4 opacity-80">
          Ai deja cont? <Link to="/login" className="underline">Login</Link>
        </p>
      </form>
    </div>
  );
}