import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ensureSafetyCheckin } from "../services/pulses";
import { fetchWeatherAlerts } from "../utils/weather";  
import { makeEventKeyFromAlert, hasCheckedIn, safetyCheckIn } from "../utils/safety";
import { getOrCreateThread } from "../utils/messages";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

function toRad(x) {
  return (x * Math.PI) / 180;
}
function distanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function urgencyLabel(u) {
  if (u === 3) return "URGENT";
  if (u === 2) return "MEDIE";
  return "SCĂZUTĂ";
}

function urgencyPill(u) {
  if (u === 3) return "bg-red-600/20 text-red-200 border-red-600/30";
  if (u === 2) return "bg-yellow-500/15 text-yellow-200 border-yellow-500/30";
  return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
}

export default function Home() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [pulses, setPulses] = useState([]);
  const [myPos, setMyPos] = useState(null);
  const [myConfirmations, setMyConfirmations] = useState(new Set());

  const [severeAlert, setSevereAlert] = useState(null);
  const [safetyHidden, setSafetyHidden] = useState(false);
  const [checking, setChecking] = useState(false);

  const radiusMeters = profile?.radiusMeters ?? 500;

  const nav = useNavigate();

  const TYPE_LABEL = {
    Emergecy: "Emergency",
    Skill: "Skill",
    Item: "Item",
  }

  const TYPE_LABEL_BTN = {
    Emergency: "Urgență",
    Skill: "Abilitate",
    Item: "Obiect",
  }

  async function onSafetyCheckin() {
    if (!uid || !severeAlert) return;
    setChecking(true);
    try {
      const eventKey = makeEventKeyFromAlert(severeAlert);
      await safetyCheckIn(eventKey, uid);
      setSafetyHidden(true); 
    } catch (e) {
      alert(e?.message || "Nu am putut salva Safety Check-in.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!uid) {
      setMyConfirmations(new Set());
      return;
    }
    if (pulses.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const checks = await Promise.all(
          pulses.map(async (p) => {
            const cRef = doc(db, "pulses", p.id, "confirmations", uid);
            const cSnap = await getDoc(cRef);
            return cSnap.exists() ? p.id : null;
          })
        );

        if (cancelled) return;

        const confirmedIds = new Set(checks.filter(Boolean));
        setMyConfirmations(confirmedIds);
      } catch (e) {
        console.error("Failed to load confirmations:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, pulses]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);

      if (!user) {
        setProfile(null);
        return;
      }

      const pRef = doc(db, "profiles", user.uid);
      const snap = await getDoc(pRef);
      setProfile(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (!myPos) return;

    let cancelled = false;

    (async () => {
      try {
        const { severe } = await fetchWeatherAlerts(myPos.lat, myPos.lng);
        if (cancelled) return;

        if (severe) {
          await ensureSafetyCheckin({
            location: myPos,
            severeTitle: severe,
          });
        }
      } catch (e) {
        console.warn("Weather alerts failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [myPos]);

  useEffect(() => {
    if (!myPos) return;

    let cancelled = false;

    (async () => {
      try {
        const { severeAlert } = await fetchWeatherAlerts(myPos.lat, myPos.lng);
        if (cancelled) return;

        setSevereAlert(severeAlert);
        setSafetyHidden(false);

        if (severeAlert && uid) {
          const eventKey = makeEventKeyFromAlert(severeAlert);
          const already = await hasCheckedIn(eventKey, uid);
          if (!cancelled && already) setSafetyHidden(true);
        }
      } catch (e) {
        console.warn("Weather alerts failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [myPos, uid]);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "pulses"),
      orderBy("pinned", "desc"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPulses(items);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!myPos) return pulses;
    return pulses.filter((p) => distanceMeters(myPos, p.location) <= radiusMeters);
  }, [pulses, myPos, radiusMeters]);

  async function handleConfirm(pulseId) {
    if (!uid) return;

    try {
      const cRef = doc(db, "pulses", pulseId, "confirmations", uid);

      await setDoc(cRef, { createdAt: serverTimestamp() }, { merge: false });

      const pRef = doc(db, "pulses", pulseId);
      await updateDoc(pRef, {
        confirmationsCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      setMyConfirmations((prev) => new Set(prev).add(pulseId));
    } catch (e) {
      console.error("Confirmarea a eșuat:", e);
      alert(e?.message || "Confirmarea a eșuat.");
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold">Acasă</h1>
            <div className="mt-1 text-sm text-zinc-400">
              Postări din cartierul tău.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-right">
            <div className="text-xs text-zinc-400">Rază</div>
            <div className="text-sm font-bold text-yellow-300">
              {radiusMeters}m
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {myPos ? "Geolocația PORNITĂ" : "Geolocația OPRITĂ"}
            </div>
          </div>
        </div>

        {severeAlert && !safetyHidden ? (
          <div className="mt-4 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-blue-200">
                  Alertă meteo: {severeAlert.event || "Severe Weather"}
                </div>
                <div className="mt-1 text-sm text-zinc-200">
                  Apasă "Sunt OK" ca să apari în Safety Check-up pentru acest eveniment.
                </div>
              </div>

              <button
                onClick={onSafetyCheckin}
                disabled={!uid || checking}
                className="shrink-0 rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50"
                title={!uid ? "Trebuie să fii conectat" : "Confirmă Safety Check-in"}
              >
                {checking ? "Se salvează..." : "Sunt OK"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Feed */}
        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
              Se încarcă postările...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
              Nicio postarea în zona ta.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const confirmed = myConfirmations.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {p.pinned ? (
                            <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200">
                              FIXAT
                            </span>
                          ) : null}

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${urgencyPill(
                              p.urgency
                            )}`}
                          >
                            {urgencyLabel(p.urgency)}
                          </span>

                          <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-xs font-bold text-zinc-200">
                            {TYPE_LABEL_BTN[p.type] ?? p.type}
                          </span>

                          {p.verifiedInfo ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">
                              Verificat
                            </span>
                          ) : null}
                        </div>

                        <h2 className="mt-3 truncate text-lg font-extrabold">
                          {p.title}
                        </h2>

                        <p className="mt-1 text-sm text-zinc-300">{p.text}</p>

                        <div className="w-max mt-3 grid grid-flow-col items-center gap-2 text-xs text-zinc-500">
                          <span>
                            Status:{" "}
                            <span className="font-semibold text-zinc-300">
                              {p.status}
                            </span>
                          </span>
                          <span>
                            Confirmări:{" "}
                            <span className="font-semibold text-zinc-300">
                              {p.confirmationsCount ?? 0}
                            </span>
                          </span>
                          {myPos && p.location ? (
                            <span>
                              Distanța:{" "}
                              <span className="font-semibold text-zinc-300">
                                {Math.round(distanceMeters(myPos, p.location))}m
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {uid && p.createdBy && p.createdBy !== uid ? (
                        <button
                          onClick={async () => {
                            const tid = await getOrCreateThread(uid, p.createdBy);
                            nav(`/notifications?tab=chat&thread=${tid}`);
                          }}
                          className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-2 text-sm font-extrabold text-zinc-200 hover:bg-zinc-900/70"
                        >
                          Mesaj
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleConfirm(p.id)}
                        disabled={!uid || confirmed}
                        className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-extrabold transition
                          ${
                            confirmed
                              ? "border border-zinc-700 bg-zinc-800/60 text-zinc-400"
                              : "bg-yellow-400 text-zinc-950 hover:bg-yellow-300"
                          }
                          ${!uid ? "opacity-50" : ""}`}
                        title={!uid ? "Necesită conectare" : "Aprobi"}
                      >
                        {confirmed ? "Aprobat" : "Aprobează"}
                      </button>
                    </div>

                    {/* {p.location?.lat && p.location?.lng ? (
                      <div className="mt-3 text-[11px] text-zinc-600">
                        {p.location.lat.toFixed(5)}, {p.location.lng.toFixed(5)}
                      </div>
                    ) : null} */}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}