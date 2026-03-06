import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from "react-leaflet";
import { auth, db } from "../firebase";
import { subscribeToPulses } from "../services/pulses";
import {
  distanceMeters,
  resolveAnchorLabel,
  resolveAnchorPosition,
} from "../utils/geo";

function urgencyRadius(u) {
  if (u === 3) return 28;
  if (u === 2) return 22;
  return 16;
}

export default function Map() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);

  const [livePos, setLivePos] = useState(null);
  const [pulses, setPulses] = useState([]);

  const radiusMeters = profile?.radiusMeters ?? 500;
  const anchorPos = resolveAnchorPosition(livePos, profile?.home || null);
  const anchorLabel = resolveAnchorLabel(livePos, profile?.home || null);

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
      (pos) => {
        setLivePos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const unsub = subscribeToPulses(setPulses);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!anchorPos) return pulses;
    return pulses.filter(
      (p) => distanceMeters(anchorPos, p.location) <= radiusMeters
    );
  }, [pulses, anchorPos, radiusMeters]);

  const center = anchorPos || { lat: 47.1622, lng: 27.5889 };

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold">Hartă</h1>
            <div className="mt-1 text-sm text-zinc-400">
              Pulses din raza ta, cu density circles.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-right">
            <div className="text-xs text-zinc-400">Rază</div>
            <div className="text-sm font-bold text-yellow-300">
              {radiusMeters}m
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">{anchorLabel}</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
          Harta este centrată după:{" "}
          <span className="font-bold text-zinc-200">{anchorLabel}</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-zinc-800">
          <div className="h-[70vh] w-full">
            <MapContainer center={[center.lat, center.lng]} zoom={15} className="h-full w-full">
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {anchorPos ? (
                <Circle
                  center={[anchorPos.lat, anchorPos.lng]}
                  radius={radiusMeters}
                  pathOptions={{}}
                />
              ) : null}

              {filtered.map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.location?.lat || 0, p.location?.lng || 0]}
                  radius={urgencyRadius(p.urgency)}
                  pathOptions={{}}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold">{p.title}</div>
                      <div className="opacity-80">{p.text}</div>
                      <div className="mt-2 text-xs opacity-70">
                        Urgency: {p.urgency} | Confirmări: {p.confirmationsCount || 0}
                      </div>
                      {anchorPos ? (
                        <div className="mt-1 text-xs opacity-70">
                          Distanță: {Math.round(distanceMeters(anchorPos, p.location))}m
                        </div>
                      ) : null}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {!uid ? (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
            Conectează-te ca să folosești raza din profil.
          </div>
        ) : null}
      </div>
    </div>
  );
}