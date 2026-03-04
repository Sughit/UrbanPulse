import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";

function parseTags(input) {
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 30);
}
function clampNum(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export default function Profile() {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [neighborhoodName, setNeighborhoodName] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [distanceLimitMeters, setDistanceLimitMeters] = useState(2000);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [skillTagsInput, setSkillTagsInput] = useState("");
  const [home, setHome] = useState(null);

  const [confirmText, setConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const nav = useNavigate();

  async function logout() {
    try {
      await signOut(auth);
      nav("/login");
    } catch (e) {
      setErr(e?.message || "Logout failed.");
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setMsg("");
      setErr("");

      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const uRef = doc(db, "users", u.uid);
        const uSnap = await getDoc(uRef);
        setDisplayName(uSnap.exists() ? (uSnap.data().displayName || u.displayName || "") : (u.displayName || ""));

        const pRef = doc(db, "profiles", u.uid);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const p = pSnap.data();
          setNeighborhoodName(p.neighborhoodName || "");
          setRadiusMeters(p.radiusMeters ?? 500);
          setDistanceLimitMeters(p.distanceLimitMeters ?? 2000);
          setQuietStart(p.quietHours?.start || "22:00");
          setQuietEnd(p.quietHours?.end || "07:00");
          setHome(p.home || null);
          setSkillTagsInput((p.skillTags || []).join(", "));
        } else {
          setNeighborhoodName("");
          setRadiusMeters(500);
          setDistanceLimitMeters(2000);
          setQuietStart("22:00");
          setQuietEnd("07:00");
          setHome(null);
          setSkillTagsInput("");
        }
      } catch (e) {
        setErr(e?.message || "Eroare la încărcarea profilului.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const skillTags = useMemo(() => parseTags(skillTagsInput), [skillTagsInput]);

  function useMyLocation() {
    setErr("");
    setMsg("");
    if (!navigator.geolocation) {
      setErr("Geolocația nu este suportată.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHome({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMsg("Locația domiciliului setată.");
      },
      () => setErr("Nu am putut obține permisiunea pentru a accesa locația."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const uid = user.uid;
      const safeRadius = clampNum(radiusMeters, 100, 5000, 500);
      const safeDist = clampNum(distanceLimitMeters, 100, 20000, 2000);

      await setDoc(
        doc(db, "users", uid),
        {
          displayName: displayName?.trim() || user.displayName || "",
          email: user.email || "",
          role: "user",
          verifiedNeighbor: false,
          trustScore: 0,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "profiles", uid),
        {
          neighborhoodName: neighborhoodName.trim(),
          radiusMeters: safeRadius,
          distanceLimitMeters: safeDist,
          quietHours: { start: quietStart, end: quietEnd },
          skillTags,
          home: home || null,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMsg("Profil salvat.");
    } catch (e) {
      setErr(e?.message || "Eroare la salvarea profilului.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDataOnly() {
    if (!user) return;
    setErr("");
    setMsg("");
    setDeleting(true);
    try {
      const uid = user.uid;
      await deleteDoc(doc(db, "profiles", uid));
      await deleteDoc(doc(db, "users", uid));
      setMsg("Datele au fost șterse (contul încă există).");
    } catch (e) {
      setErr(e?.message || "Eroare la ștergerea datelor.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteAccountAndData() {
    if (!user) return;
    setErr("");
    setMsg("");

    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setErr('Scrie "DELETE" pentru a confirma.');
      return;
    }
    if (!user.email) {
      setErr("Acest cont nu are email, re-autentificarea cu parolă nu este permisă.");
      return;
    }
    if (!deletePassword) {
      setErr("Întroduce-ți parola.");
      return;
    }

    setDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      const uid = user.uid;
      await deleteDoc(doc(db, "profiles", uid));
      await deleteDoc(doc(db, "users", uid));
      await deleteUser(user);
    } catch (e) {
      setErr(e?.message || "Eroare la ștergerea contului.");
    } finally {
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-xl px-4 py-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-300">
            Trebuie să te conectezi.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold">Profil</h1>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-right">
            <div className="text-[11px] text-zinc-500">Conectat</div>
            <div className="text-sm font-bold text-zinc-200">{user.email}</div>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
            Se încarcă...
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {msg ? (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                <span className="font-extrabold">OK:</span> {msg}
              </div>
            ) : null}
            {err ? (
              <div className="rounded-3xl border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-200">
                <span className="font-extrabold">Error:</span> {err}
              </div>
            ) : null}

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-lg font-extrabold">General</div>

              <label className="mt-4 block text-sm font-bold text-zinc-200">
                Numele afișat
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Numele tău"
                maxLength={50}
              />

              <label className="mt-4 block text-sm font-bold text-zinc-200">
                Cartier
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={neighborhoodName}
                onChange={(e) => setNeighborhoodName(e.target.value)}
                placeholder="Ex: Copou"
                maxLength={60}
              />

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-zinc-200">
                    Raza pentru postări (m)
                  </label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(e.target.value)}
                    min={100}
                    max={5000}
                  />
                  <div className="mt-1 text-[11px] text-zinc-500">
                    100–5000m
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-200">
                    Raza pentru alerte (m)
                  </label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                    value={distanceLimitMeters}
                    onChange={(e) => setDistanceLimitMeters(e.target.value)}
                    min={100}
                    max={20000}
                  />
                  <div className="mt-1 text-[11px] text-zinc-500">
                    100–20000m
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-lg font-extrabold">Ore de liniște</div>
              <div className="mt-1 text-sm text-zinc-400">
                În acest interval alertele vor fi oprite.
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-zinc-200">
                    Început
                  </label>
                  <input
                    type="time"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-200">
                    Sfârșit
                  </label>
                  <input
                    type="time"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-lg font-extrabold">Listă de abilități</div>
              <div className="mt-1 text-sm text-zinc-400">
                Separate prin virgulă (de exemplu: electrician)
              </div>

              <input
                className="mt-4 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                value={skillTagsInput}
                onChange={(e) => setSkillTagsInput(e.target.value)}
                placeholder="electrician"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {skillTags.length ? (
                  skillTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-xs font-bold text-zinc-200"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500">Nicio abilitate setată.</span>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-lg font-extrabold">Domiciliul</div>
              <div className="mt-1 text-sm text-zinc-400">
                Folosit pentru filtrarea postărilor.
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300"
                >
                  Folosește-mi locația.
                </button>

                {home ? (
                  <div className="text-xs text-zinc-400">
                    {home.lat.toFixed(5)}, {home.lng.toFixed(5)}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">Nicio locație salvată.</div>
                )}
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving || deleting}
              className="w-full rounded-3xl bg-yellow-400 px-5 py-3 text-base font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50"
            >
              {saving ? "Se salvează..." : "Salvează schimbările"}
            </button>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-lg font-extrabold">Sesiunea contului</div>
              <div className="mt-1 text-sm text-zinc-400">
                Deconectează-te de pe acest dispozitiv.
              </div>

              <button
                onClick={logout}
                disabled={saving || deleting}
                className="mt-4 w-full rounded-3xl border border-zinc-800 bg-zinc-950/30 px-5 py-3 text-base font-extrabold text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-50"
              >
                Deconectare
              </button>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-lg font-extrabold">Șterge contul</div>
              <div className="mt-1 text-sm text-zinc-400">
                Șterge doar datele contului, sau întregul cont.
              </div>

              <button
                onClick={deleteDataOnly}
                disabled={deleting || saving}
                className="mt-4 w-full rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-2 text-sm font-extrabold text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-50"
              >
                Șterge-mi datele (păstrează contul).
              </button>

              <div className="mt-5 border-t border-zinc-800 pt-4">
                <div className="text-sm font-extrabold text-zinc-200">
                  Șterge contul (necesită parolă).
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">
                      Scrie DELETE
                    </label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">
                      Parola
                    </label>
                    <input
                      type="password"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 outline-none focus:border-yellow-400"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  onClick={deleteAccountAndData}
                  disabled={deleting || saving}
                  className="mt-3 w-full rounded-2xl border border-red-600/30 bg-red-600/10 px-4 py-2 text-sm font-extrabold text-red-200 hover:bg-red-600/15 disabled:opacity-50"
                >
                  Șterge contul și datele acestuia.
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}