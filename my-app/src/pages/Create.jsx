import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "../firebase";
import { createPulse } from "../services/pulses";

const TYPES = ["Emergency", "Skill", "Item"];
const TYPES_BTN = ["Urgență", "Abilitate", "Obiect"];

const MODES = [
  { value: "need", label: "Am nevoie" },
  { value: "offer", label: "Pot oferi" },
];

function validate({ title, text, type, mode, urgency, location }) {
  if (!type) return "Selectează tipul postării.";
  if (!mode) return "Selectează dacă ai nevoie sau oferi.";
  if (![1, 2, 3].includes(Number(urgency))) return "Urgența trebuie să fie 1, 2 sau 3.";
  if (!title || title.trim().length < 3) return "Titlul este prea scurt.";
  if (!text || text.trim().length < 5) return "Descrierea este prea scurtă.";
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    return "Locația lipsește. Apasă pe «Folosește-mi locația».";
  }
  return null;
}

export default function Create() {
  const [uid, setUid] = useState(null);

  const [type, setType] = useState("Emergency");
  const [mode, setMode] = useState("need");
  const [urgency, setUrgency] = useState(3);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [location, setLocation] = useState(null);
  const [locStatus, setLocStatus] = useState("Nu este pornită geolocația.");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  const canSubmit = useMemo(() => {
    const err = validate({ title, text, type, mode, urgency, location });
    return !err && !!uid && !submitting;
  }, [title, text, type, mode, urgency, location, uid, submitting]);

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocația nu este acceptată de browser.");
      return;
    }

    setLocStatus("Obținem locația...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("Locație setată.");
      },
      () => {
        setLocStatus("Eroare");
        setError("Nu am putut obține geolocația.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!uid) {
      setError("Trebuie să fii conectat pentru a publica.");
      return;
    }

    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists() && userSnap.data().blocked) {
      setError("Contul tău este restricționat și nu poate publica.");
      return;
    }

    const v = validate({ title, text, type, mode, urgency, location });
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    try {
      await createPulse({
        type,
        mode,
        urgency: Number(urgency),
        title: title.trim(),
        text: text.trim(),
        location,
        createdBy: uid,
      });

      setTitle("");
      setText("");
      setMode("need");
      setUrgency(type === "Emergency" ? 3 : 2);
      setLocation(null);
      setLocStatus("Nu este pornită geolocația.");
    } catch (err) {
      setError(err?.message || "Eroare la crearea postării.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="mt-1 text-2xl font-extrabold">Crează o postare</h1>
        <div className="mt-1 text-sm text-zinc-400">
          Creează o cerere sau o ofertă pentru vecinii din zona ta.
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-sm font-bold text-zinc-200">Tip</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TYPES_BTN.map((t, i) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(TYPES[i])}
                  className={`rounded-2xl px-4 py-2 text-sm font-extrabold transition ${
                    type === TYPES[i]
                      ? "bg-yellow-400 text-zinc-950"
                      : "border border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900/70"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm font-bold text-zinc-200">Mod</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`rounded-2xl px-4 py-2 text-sm font-extrabold transition ${
                    mode === m.value
                      ? "bg-yellow-400 text-zinc-950"
                      : "border border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900/70"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-bold text-zinc-200">Grad de urgență</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-100 outline-none focus:border-yellow-400"
              >
                <option value={1}>Scăzut</option>
                <option value={2}>Mediu</option>
                <option value={3}>Urgent</option>
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <label className="block text-sm font-bold text-zinc-200">Titlu</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-100 outline-none focus:border-yellow-400"
              placeholder='Ex.: "Am nevoie de o scară"'
              maxLength={80}
            />

            <label className="mt-4 block text-sm font-bold text-zinc-200">Descriere</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-100 outline-none focus:border-yellow-400"
              placeholder="Explică ce ai nevoie sau ce poți oferi."
              maxLength={600}
            />

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={useMyLocation}
                className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300"
              >
                Folosește-mi locația
              </button>
              <div className="text-xs text-zinc-400">{locStatus}</div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-200">
              <span className="font-extrabold">Eroare:</span> {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-3xl bg-yellow-400 px-5 py-3 text-base font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50"
          >
            {submitting ? "Se postează..." : "Crează postarea"}
          </button>
        </form>
      </div>
    </div>
  );
}