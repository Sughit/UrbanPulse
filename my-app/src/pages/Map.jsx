import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from "react-leaflet";
import { auth, db } from "../firebase";
import { subscribeToPulses } from "../services/pulses";
import { distanceMeters } from "../utils/geo";

function pulseVisual(p) {
  if (p.type === "Emergency") {
    return {
      radius: p.urgency === 3 ? 18 : p.urgency === 2 ? 14 : 11,
      pathOptions: {
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.45,
        weight: p.verifiedInfo ? 4 : 2,
      },
    };
  }

  if (p.type === "Skill") {
    return {
      radius: 14,
      pathOptions: {
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.4,
        weight: p.verifiedInfo ? 4 : 2,
      },
    };
  }

  return {
    radius: p.mode === "offer" ? 15 : 13,
    pathOptions: {
      color: "#22c55e",
      fillColor: "#22c55e",
      fillOpacity: 0.4,
      weight: p.verifiedInfo ? 4 : 2,
    },
  };
}

export default function Map() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [myPos, setMyPos] = useState(null);
  const [pulses, setPulses] = useState([]);

  const radiusMeters = profile?.radiusMeters ?? 500;
  const centerPoint = profile?.home || null;
  const center = centerPoint || myPos || { lat: 47.1622, lng: 27.5889 };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);

      if (!u) {
        setProfile(null);
        return;
      }

      const pRef = doc(db, "profiles", u.uid);
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
    const unsub = subscribeToPulses(setPulses);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const valid = pulses.filter(
      (p) =>
        p?.location &&
        typeof p.location.lat === "number" &&
        typeof p.location.lng === "number"
    );

    if (!centerPoint) return valid;
    return valid.filter((p) => distanceMeters(centerPoint, p.location) <= radiusMeters);
  }, [pulses, centerPoint, radiusMeters]);

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold">Hartă</h1>
            <div className="mt-1 text-sm text-zinc-400">
              Pulse-uri din raza setată în profil, diferențiate pe tipuri.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-right">
            <div className="text-xs text-zinc-400">Rază</div>
            <div className="text-sm font-bold text-yellow-300">{radiusMeters}m</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {profile?.home ? "Centru: domiciliu profil" : myPos ? "Centru: locație curentă" : "Centru indisponibil"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <span className="font-bold text-red-300">Roșu</span> — Urgență
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <span className="font-bold text-blue-300">Albastru</span> — Abilitate
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <span className="font-bold text-emerald-300">Verde</span> — Obiect / Împrumut
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <span className="font-bold text-zinc-100">Contur gros</span> — Verificat
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-zinc-800">
          <div className="h-[56vh] w-full">
            <MapContainer center={[center.lat, center.lng]} zoom={15} className="h-full w-full">
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {centerPoint ? (
                <Circle
                  center={[centerPoint.lat, centerPoint.lng]}
                  radius={radiusMeters}
                  pathOptions={{ color: "#facc15", weight: 2, fillOpacity: 0.04 }}
                />
              ) : null}

              {filtered.map((p) => {
                const style = pulseVisual(p);

                return (
                  <CircleMarker
                    key={p.id}
                    center={[p.location?.lat || 0, p.location?.lng || 0]}
                    radius={style.radius}
                    pathOptions={style.pathOptions}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold">{p.title}</div>
                        <div className="opacity-80">{p.text}</div>
                        <div className="mt-2 text-xs opacity-70">
                          Tip: {p.type} | Mod: {p.mode || "need"} | Urgență: {p.urgency}
                        </div>
                        <div className="mt-1 text-xs opacity-70">
                          Confirmări: {p.confirmationsCount || 0}
                        </div>
                        {centerPoint ? (
                          <div className="mt-1 text-xs opacity-70">
                            Distanță: {Math.round(distanceMeters(centerPoint, p.location))}m
                          </div>
                        ) : null}
                        {p.verifiedInfo ? (
                          <div className="mt-1 text-xs font-bold text-emerald-700">
                            Verificat
                          </div>
                        ) : null}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {!uid ? (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
            Conectează-te ca să folosești raza și centrul din profil.
          </div>
        ) : null}
      </div>
    </div>
  );
}