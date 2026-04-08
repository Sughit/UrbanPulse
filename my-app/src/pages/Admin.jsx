import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-zinc-100">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold text-zinc-100">{title}</h2>
        {subtitle ? <div className="mt-1 text-sm text-zinc-400">{subtitle}</div> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function PulseMetaPill({ children, tone = "default" }) {
  const styles = {
    default: "border-zinc-700 bg-zinc-800/60 text-zinc-200",
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${styles[tone] || styles.default}`}>
      {children}
    </span>
  );
}

function ActionButton({ children, variant = "secondary", onClick, disabled }) {
  const styles =
    variant === "primary"
      ? "bg-yellow-400 text-zinc-950 hover:bg-yellow-300"
      : variant === "danger"
      ? "border border-red-600/30 bg-red-600/10 text-red-200 hover:bg-red-600/15"
      : "border border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900/70";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

function PulseCard({
  pulse,
  onClose,
  onToggleVerify,
  onTogglePinned,
  onToggleDuplicate,
}) {
  const typeTone =
    pulse.type === "Emergency"
      ? "red"
      : pulse.type === "Skill"
      ? "blue"
      : "emerald";

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <PulseMetaPill tone={typeTone}>{pulse.type || "Pulse"}</PulseMetaPill>
            <PulseMetaPill>{pulse.mode || "need"}</PulseMetaPill>
            <PulseMetaPill tone={pulse.status === "closed" ? "yellow" : "default"}>
              {pulse.status || "open"}
            </PulseMetaPill>
            {pulse.verifiedInfo ? <PulseMetaPill tone="emerald">Verificat</PulseMetaPill> : null}
            {pulse.pinned ? <PulseMetaPill tone="blue">Fixat</PulseMetaPill> : null}
            {pulse.duplicateOf ? <PulseMetaPill tone="yellow">Duplicat</PulseMetaPill> : null}
            {(pulse.reportsCount || 0) > 0 ? (
              <PulseMetaPill tone="red">Raportări: {pulse.reportsCount || 0}</PulseMetaPill>
            ) : null}
          </div>

          <h3 className="mt-3 break-words text-lg font-extrabold text-zinc-100">
            {pulse.title || "Fără titlu"}
          </h3>

          {pulse.text ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
              {pulse.text}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span>
              Confirmări:{" "}
              <span className="font-semibold text-zinc-300">
                {pulse.confirmationsCount || 0}
              </span>
            </span>
            <span>
              Raportări:{" "}
              <span className="font-semibold text-zinc-300">
                {pulse.reportsCount || 0}
              </span>
            </span>
            <span>
              Creat de:{" "}
              <span className="font-semibold text-zinc-300">
                {pulse.createdBy || "—"}
              </span>
            </span>
          </div>
        </div>

        <div className="w-full lg:w-[260px]">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={() => onClose(pulse.id)}>Închide</ActionButton>

            <ActionButton
              variant={pulse.verifiedInfo ? "secondary" : "primary"}
              onClick={() => onToggleVerify(pulse.id, !!pulse.verifiedInfo)}
            >
              {pulse.verifiedInfo ? "Scoate verific." : "Verifică"}
            </ActionButton>

            <ActionButton onClick={() => onTogglePinned(pulse.id, !!pulse.pinned)}>
              {pulse.pinned ? "Scoate pin" : "Pin"}
            </ActionButton>

            <ActionButton onClick={() => onToggleDuplicate(pulse.id, !!pulse.duplicateOf)}>
              {pulse.duplicateOf ? "Nu e duplicat" : "Duplicat"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserCard({ user, onToggleVerify, onToggleBlock }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {user.verifiedNeighbor ? (
              <PulseMetaPill tone="emerald">Verified Neighbor</PulseMetaPill>
            ) : (
              <PulseMetaPill>Neverificat</PulseMetaPill>
            )}

            {user.blocked ? (
              <PulseMetaPill tone="red">Blocat</PulseMetaPill>
            ) : (
              <PulseMetaPill tone="blue">Activ</PulseMetaPill>
            )}

            <PulseMetaPill>Trust: {user.trustScore || 0}</PulseMetaPill>
            <PulseMetaPill>{user.role || "user"}</PulseMetaPill>
          </div>

          <h3 className="mt-3 break-words text-lg font-extrabold text-zinc-100">
            {user.displayName || "Fără nume"}
          </h3>

          <div className="mt-1 break-all text-sm text-zinc-400">
            {user.email || user.id}
          </div>
        </div>

        <div className="w-full lg:w-[260px]">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              variant={user.verifiedNeighbor ? "secondary" : "primary"}
              onClick={() => onToggleVerify(user.id, !!user.verifiedNeighbor)}
            >
              {user.verifiedNeighbor ? "Scoate verific." : "Verifică"}
            </ActionButton>

            <ActionButton
              variant={user.blocked ? "secondary" : "danger"}
              onClick={() => onToggleBlock(user.id, !!user.blocked)}
            >
              {user.blocked ? "Deblochează" : "Blochează"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [pulses, setPulses] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("reported");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, "pulses"), orderBy("createdAt", "desc")),
      (snap) => setPulses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsub2 = onSnapshot(collection(db, "users"), (snap) =>
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  async function closePulse(id) {
    await updateDoc(doc(db, "pulses", id), {
      status: "closed",
    });
  }

  async function toggleVerifyPulse(id, current) {
    await updateDoc(doc(db, "pulses", id), {
      verifiedInfo: !current,
    });
  }

  async function togglePinnedPulse(id, current) {
    await updateDoc(doc(db, "pulses", id), {
      pinned: !current,
    });
  }

  async function toggleDuplicatePulse(id, current) {
    await updateDoc(doc(db, "pulses", id), {
      duplicateOf: current ? null : "manual-review",
    });
  }

  async function toggleVerifyUser(uid, current) {
    await updateDoc(doc(db, "users", uid), {
      verifiedNeighbor: !current,
    });
  }

  async function toggleBlockUser(uid, current) {
    await updateDoc(doc(db, "users", uid), {
      blocked: !current,
    });
  }

  const normalizedSearch = search.trim().toLowerCase();

  const reportedPulses = useMemo(() => {
    return pulses.filter((p) => (p.reportsCount || 0) > 0);
  }, [pulses]);

  const filteredPulses = useMemo(() => {
    let items = [...pulses];

    if (filter === "open") items = items.filter((p) => p.status === "open");
    if (filter === "closed") items = items.filter((p) => p.status === "closed");
    if (filter === "verified") items = items.filter((p) => p.verifiedInfo);
    if (filter === "reported") items = items.filter((p) => (p.reportsCount || 0) > 0);
    if (filter === "duplicates") items = items.filter((p) => !!p.duplicateOf);
    if (filter === "emergency") items = items.filter((p) => p.type === "Emergency");

    if (normalizedSearch) {
      items = items.filter((p) =>
        `${p.title || ""} ${p.text || ""} ${p.type || ""} ${p.createdBy || ""}`
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    return items;
  }, [pulses, filter, normalizedSearch]);

  const filteredUsers = useMemo(() => {
    let items = [...users];

    if (normalizedSearch) {
      items = items.filter((u) =>
        `${u.displayName || ""} ${u.email || ""} ${u.id || ""}`
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    return items;
  }, [users, normalizedSearch]);

  const stats = useMemo(() => {
    return {
      pulses: pulses.length,
      reported: pulses.filter((p) => (p.reportsCount || 0) > 0).length,
      duplicates: pulses.filter((p) => !!p.duplicateOf).length,
      users: users.length,
      blockedUsers: users.filter((u) => !!u.blocked).length,
    };
  }, [pulses, users]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 py-5 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold">Admin Dashboard</h1>
          <div className="mt-1 text-sm text-zinc-400">
            Review pentru conținut raportat, duplicate și acces utilizatori.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Postări" value={stats.pulses} />
          <StatCard label="Raportate" value={stats.reported} />
          <StatCard label="Duplicate" value={stats.duplicates} />
          <StatCard label="Utilizatori" value={stats.users} />
          <StatCard label="Utilizatori blocați" value={stats.blockedUsers} />
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <button
              onClick={() => setTab("reported")}
              className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                tab === "reported"
                  ? "bg-yellow-400 text-zinc-950"
                  : "border border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              Raportate
            </button>

            <button
              onClick={() => setTab("pulses")}
              className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                tab === "pulses"
                  ? "bg-yellow-400 text-zinc-950"
                  : "border border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              Toate postările
            </button>

            <button
              onClick={() => setTab("users")}
              className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                tab === "users"
                  ? "bg-yellow-400 text-zinc-950"
                  : "border border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              Utilizatori
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după titlu, text, email, uid..."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-yellow-400"
            />

            {tab !== "users" ? (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-yellow-400"
              >
                <option value="all">Toate</option>
                <option value="open">Deschise</option>
                <option value="closed">Închise</option>
                <option value="verified">Verificate</option>
                <option value="reported">Raportate</option>
                <option value="duplicates">Duplicate</option>
                <option value="emergency">Urgențe</option>
              </select>
            ) : null}
          </div>
        </div>

        {tab === "reported" ? (
          <div className="space-y-4">
            <SectionTitle
              title="Conținut raportat"
              subtitle="Moderatorii pot revizui rapid postările marcate de comunitate."
            />

            {reportedPulses.length === 0 ? (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-zinc-400">
                Nu există postări raportate.
              </div>
            ) : (
              <div className="space-y-3">
                {reportedPulses.map((p) => (
                  <PulseCard
                    key={p.id}
                    pulse={p}
                    onClose={closePulse}
                    onToggleVerify={toggleVerifyPulse}
                    onTogglePinned={togglePinnedPulse}
                    onToggleDuplicate={toggleDuplicatePulse}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "pulses" ? (
          <div className="space-y-4">
            <SectionTitle
              title="Administrare postări"
              subtitle="Poți închide, verifica, fixa sau marca duplicatele."
            />

            {filteredPulses.length === 0 ? (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-zinc-400">
                Nu există rezultate pentru filtrul curent.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPulses.map((p) => (
                  <PulseCard
                    key={p.id}
                    pulse={p}
                    onClose={closePulse}
                    onToggleVerify={toggleVerifyPulse}
                    onTogglePinned={togglePinnedPulse}
                    onToggleDuplicate={toggleDuplicatePulse}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="space-y-4">
            <SectionTitle
              title="Administrare utilizatori"
              subtitle="Manage user access: verificare și blocare acces."
            />

            {filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-zinc-400">
                Nu există utilizatori pentru căutarea curentă.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    onToggleVerify={toggleVerifyUser}
                    onToggleBlock={toggleBlockUser}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}