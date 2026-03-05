import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { subscribeToPulses } from "../services/pulses";

import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from "react-leaflet";

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

function urgencyRadius(u) {
  if (u === 3) return 28;
  if (u === 2) return 22;
  return 16;
}

export default function Map() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);

  const [myPos, setMyPos] = useState(null);
  const [pulses, setPulses] = useState([]);

  const radiusMeters = profile?.radiusMeters ?? 500;

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
    if (!myPos) return pulses;
    return pulses.filter((p) => distanceMeters(myPos, p.location) <= radiusMeters);
  }, [pulses, myPos, radiusMeters]);

  const center = myPos || { lat: 47.1622, lng: 27.5889 }; // fallback Iași

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold">Hartă</h1>
            <div className="mt-1 text-sm text-zinc-400">
              Pulses din raza ta, cu “density” (cercuri).
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-right">
            <div className="text-xs text-zinc-400">Rază</div>
            <div className="text-sm font-bold text-yellow-300">{radiusMeters}m</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {myPos ? "Geolocația PORNITĂ" : "Geolocația OPRITĂ"}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-zinc-800">
          <div className="h-[70vh] w-full">
            <MapContainer center={[center.lat, center.lng]} zoom={15} className="h-full w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* raza ta */}
              {myPos ? (
                <Circle
                  center={[myPos.lat, myPos.lng]}
                  radius={radiusMeters}
                  pathOptions={{}}
                />
              ) : null}

              {/* “density” circles */}
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
                      {myPos ? (
                        <div className="mt-1 text-xs opacity-70">
                          Distanță: {Math.round(distanceMeters(myPos, p.location))}m
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