import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { ensureSafetyCheckin, confirmPulse, reportPulse } from "../services/pulses";
import { fetchWeatherAlerts } from "../utils/weather";
import { makeEventKeyFromAlert, hasCheckedIn, safetyCheckIn } from "../utils/safety";
import { getOrCreateThread } from "../utils/messages";
import { distanceMeters } from "../utils/geo";
import { markPulseResolved, leavePositiveFeedback } from "../services/trust";

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

function typePill(type) {
  if (type === "Emergency") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (type === "Skill") return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function modeLabel(mode) {
  return mode === "offer" ? "Oferă" : "Are nevoie";
}

async function handleResolve(pulseId) {
  if (!uid) return;
  try {
    await markPulseResolved(pulseId, uid);
    alert("Postarea a fost marcată ca rezolvată.");
  } catch (e) {
    alert(e?.message || "Nu am putut marca postarea ca rezolvată.");
  }
}

async function handlePositiveFeedback(ownerUid, pulseId) {
  if (!uid || !ownerUid || ownerUid === uid) return;

  try {
    await leavePositiveFeedback({
      fromUid: uid,
      toUid: ownerUid,
      pulseId,
    });
    alert("Feedback pozitiv trimis.");
  } catch (e) {
    alert(e?.message || "Nu am putut trimite feedback.");
  }
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
  const feedCenter = profile?.home || myPos;
  const nav = useNavigate();

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

  useEffect(() => {
    if (!uid || pulses.length === 0) {
      setMyConfirmations(new Set());
      return;
    }

    let cancelled = false;

    (async () => {
      const checks = await Promise.all(
        pulses.map(async (p) => {
          const cRef = doc(db, "pulses", p.id, "confirmations", uid);
          const cSnap = await getDoc(cRef);
          return cSnap.exists() ? p.id : null;
        })
      );

      if (cancelled) return;
      setMyConfirmations(new Set(checks.filter(Boolean)));
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, pulses]);

  useEffect(() => {
    if (!myPos) return;

    let cancelled = false;

    (async () => {
      try {
        const { severeAlert } = await fetchWeatherAlerts(myPos.lat, myPos.lng);
        if (cancelled) return;

        if (severeAlert) {
          const eventKey = makeEventKeyFromAlert(severeAlert);

          await ensureSafetyCheckin({
            eventKey,
            location: myPos,
            severeTitle: severeAlert.event || "Severe Weather",
          });

          setSevereAlert(severeAlert);
          setSafetyHidden(false);

          if (uid) {
            const already = await hasCheckedIn(eventKey, uid);
            if (!cancelled && already) setSafetyHidden(true);
          }
        } else {
          setSevereAlert(null);
          setSafetyHidden(true);
        }
      } catch (e) {
        console.warn("Weather alerts failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [myPos, uid]);

  const filtered = useMemo(() => {
    const valid = pulses.filter(
      (p) =>
        p?.location &&
        typeof p.location.lat === "number" &&
        typeof p.location.lng === "number"
    );

    if (!feedCenter) return valid;
    return valid.filter((p) => distanceMeters(feedCenter, p.location) <= radiusMeters);
  }, [pulses, feedCenter, radiusMeters]);

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

  async function handleConfirm(pulseId) {
    if (!uid) return;

    try {
      await confirmPulse(pulseId, uid);
      setMyConfirmations((prev) => new Set(prev).add(pulseId));
    } catch (e) {
      alert(e?.message || "Confirmarea a eșuat.");
    }
  }

  async function handleReport(pulseId) {
  if (!uid) return;

  const reason = window.prompt("Motivul raportării:");
    if (reason === null) return;

    try {
      await reportPulse({ pulseId, uid, reason });
      alert("Postarea a fost raportată.");
    } catch (e) {
      alert(e?.message || "Raportarea a eșuat.");
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold">Acasă</h1>
            <div className="mt-1 text-sm text-zinc-400">
              Postări din zona setată în profil.
            </div>
          </div>

          <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 sm:w-auto sm:min-w-[180px] sm:text-right">
            <div className="text-xs text-zinc-400">Rază profil</div>
            <div className="text-sm font-bold text-yellow-300">{radiusMeters}m</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {profile?.home
                ? "Centru: domiciliu profil"
                : myPos
                ? "Centru: locație curentă"
                : "Centru indisponibil"}
            </div>
          </div>
        </div>

        {severeAlert && !safetyHidden ? (
          <div className="mt-4 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-blue-200">
                  Alertă meteo: {severeAlert.event || "Severe Weather"}
                </div>
                <div className="mt-1 text-sm text-zinc-200">
                  Apasă „Sunt OK” ca să apari în Safety Check-in.
                </div>
              </div>

              <button
                onClick={onSafetyCheckin}
                disabled={!uid || checking}
                className="w-full rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50 sm:w-auto sm:shrink-0"
              >
                {checking ? "Se salvează..." : "Sunt OK"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
              Se încarcă postările...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
              Nicio postare în zona ta.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const confirmed = myConfirmations.has(p.id);

                return (
                  <div
                    key={p.id}
                    className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 shadow-sm"
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.pinned ? (
                          <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-3 py-1 text-[11px] font-bold text-blue-200">
                            FIXAT
                          </span>
                        ) : null}

                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-bold ${urgencyPill(
                            p.urgency
                          )}`}
                        >
                          {urgencyLabel(p.urgency)}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-bold ${typePill(
                            p.type
                          )}`}
                        >
                          {p.type}
                        </span>

                        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-[11px] font-bold text-zinc-200">
                          {modeLabel(p.mode)}
                        </span>

                        {p.verifiedInfo ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-200">
                            Verificat
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-3 text-lg font-extrabold break-words">
                        {p.title}
                      </h2>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                        {p.text}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
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

                        {feedCenter && p.location ? (
                          <span>
                            Distanță:{" "}
                            <span className="font-semibold text-zinc-300">
                              {Math.round(distanceMeters(feedCenter, p.location))}m
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 bg-zinc-950/20 p-3">
                      <div className="flex flex-wrap gap-2">
                        {uid && p.createdBy && p.createdBy !== uid ? (
                          <button
                            onClick={async () => {
                              const tid = await getOrCreateThread(uid, p.createdBy);
                              nav(`/notifications?tab=chat&thread=${tid}`);
                            }}
                            className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900/70"
                          >
                            Mesaj
                          </button>
                        ) : null}

                        {uid && p.createdBy && p.createdBy !== uid ? (
                          <button
                            onClick={() => handlePositiveFeedback(p.createdBy, p.id)}
                            className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900/70"
                          >
                            Feedback +
                          </button>
                        ) : null}

                        {uid && p.createdBy === uid && p.status !== "resolved" ? (
                          <button
                            onClick={() => handleResolve(p.id)}
                            className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900/70"
                          >
                            Marchează rezolvat
                          </button>
                        ) : null}

                        <button
                          onClick={() => handleConfirm(p.id)}
                          disabled={!uid || confirmed}
                          className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                            confirmed
                              ? "border border-zinc-700 bg-zinc-800/60 text-zinc-400"
                              : "bg-yellow-400 text-zinc-950 hover:bg-yellow-300"
                          } ${!uid ? "opacity-50" : ""}`}
                        >
                          {confirmed ? "Aprobat" : "Aprobă"}
                        </button>

                        <button
                          onClick={() => handleReport(p.id)}
                          disabled={!uid}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900/70 disabled:opacity-50"
                        >
                          Raportează
                        </button>
                      </div>
                    </div>
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