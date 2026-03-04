import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const TYPES = ["Emergency", "Skill", "Item"];
const TYPES_BTN = ["Urgență", "Abilitate", "Obiect"];
function validate({ title, text, type, urgency, location }) {
  if (!type) return "Selectați un tip de anunț.";
  if (![1, 2, 3].includes(Number(urgency))) return "Gradul de urgență trebuie să fie 1, 2 or 3.";
  if (!title || title.trim().length < 3) return "Titlul este prea scurt.";
  if (!text || text.trim().length < 5) return "Descrierea este prea scurtă.";
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number")
    return "Locația lipsește. Folosiți 'Folosiți-mi locația'.";
  return null;
}

export default function Create() {
  const [uid, setUid] = useState(null);

  const [type, setType] = useState("Emergency");
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
    const err = validate({ title, text, type, urgency, location });
    return !err && !!uid && !submitting;
  }, [title, text, type, urgency, location, uid, submitting]);

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
        setError("Nu am putut obține geolocația. Activați permisiunile de locație.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!uid) {
      setError("Trebuie să fi conectat pentru a publica o postare.");
      return;
    }

    const v = validate({ title, text, type, urgency, location });
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "pulses"), {
        type,
        urgency: Number(urgency),
        title: title.trim(),
        text: text.trim(),
        location,
        createdBy: uid,
        status: "open",
        pinned: false,
        verifiedInfo: false,
        confirmationsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTitle("");
      setText("");
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
        <div>
          <h1 className="mt-1 text-2xl font-extrabold">Crează o postare</h1>
          <div className="mt-1 text-sm text-zinc-400">
            Postați o necesitate, un obiect de împrumutat/oferit - apar instant.
          </div>
        </div>

        {!uid ? (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-300">
            Trebuie să fi conectat pentru a face o postare.
          </div>
        ) : null}

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

            <div className="mt-4">
              <label className="block text-sm font-bold text-zinc-200">
                Gradul de urgență
              </label>
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
            <label className="block text-sm font-bold text-zinc-200">
              Titlu
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-100 outline-none focus:border-yellow-400"
              placeholder='Exemplu: "Am nevoie de o bormașină!"'
              maxLength={80}
            />

            <label className="mt-4 block text-sm font-bold text-zinc-200">
              Descriere
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-100 outline-none focus:border-yellow-400"
              placeholder="Explică de ce ai nevoie / ce oferi."
              maxLength={600}
            />

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={useMyLocation}
                className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300"
              >
                Folosește-mi locația.
              </button>
              <div className="text-xs text-zinc-400">{locStatus}</div>
            </div>

            {/* {location ? (
              <div className="mt-3 text-[11px] text-zinc-500">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
            ) : null} */}
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