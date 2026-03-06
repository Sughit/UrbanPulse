import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { sendMessage } from "../utils/messages";

function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function alertHeading(kind) {
  if (kind === "confirm") return "Confirmare la postare";
  if (kind === "message") return "Mesaj nou";
  if (kind === "urgent-pulse") return "Urgență în apropiere";
  return "Alertă";
}

function ArrowLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function Notifications() {
  const nav = useNavigate();
  const qp = useQueryParams();

  const [uid, setUid] = useState(null);

  const [tab, setTab] = useState(qp.get("tab") || "alerts");
  const [threadId, setThreadId] = useState(qp.get("thread") || "");

  const [alerts, setAlerts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [msgs, setMsgs] = useState([]);

  const [typing, setTyping] = useState("");
  const [sending, setSending] = useState(false);
  const [userLabels, setUserLabels] = useState({});

  const isChatDetail = tab === "chat" && !!threadId;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "chat" && threadId) params.set("thread", threadId);
    nav(`/notifications?${params.toString()}`, { replace: true });
  }, [tab, threadId, nav]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    const q1 = query(
      collection(db, "notifications", uid, "items"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q1, (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const q2 = query(
      collection(db, "threads"),
      where("participants", "array-contains", uid)
    );

    const unsub = onSnapshot(q2, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      items.sort((a, b) => {
        const ta = a.updatedAt?.seconds || 0;
        const tb = b.updatedAt?.seconds || 0;
        return tb - ta;
      });

      setThreads(items);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid || !threadId) {
      setMsgs([]);
      return;
    }

    const q3 = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q3, (snap) => {
      setMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [uid, threadId]);

  async function resolveUserLabel(userId) {
    if (!userId) return "Unknown";
    if (userLabels[userId]) return userLabels[userId];

    try {
      const uSnap = await getDoc(doc(db, "users", userId));
      const label = uSnap.exists()
        ? uSnap.data().displayName || uSnap.data().email || userId
        : userId;

      setUserLabels((prev) => ({ ...prev, [userId]: label }));
      return label;
    } catch {
      return userId;
    }
  }

  useEffect(() => {
    const ids = [
      ...new Set([
        ...alerts.map((a) => a.byUid).filter(Boolean),
        ...threads
          .flatMap((t) => t.participants || [])
          .filter((id) => id && id !== uid),
      ]),
    ];

    ids.forEach((id) => {
      resolveUserLabel(id);
    });
  }, [alerts, threads, uid]);

  async function markRead(alertId) {
    if (!uid) return;
    await updateDoc(doc(db, "notifications", uid, "items", alertId), {
      read: true,
    });
  }

  async function handleSendMessage() {
    const text = typing.trim();
    if (!threadId || !uid || !text || sending) return;

    const sentText = text;
    setTyping("");
    setSending(true);

    try {
      await sendMessage(threadId, uid, sentText);
    } catch (e) {
      setTyping(sentText);
      alert(e?.message || "Nu am putut trimite mesajul.");
    } finally {
      setSending(false);
    }
  }

  if (!uid) {
    return (
      <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-300">
            Trebuie să te conectezi ca să vezi notificările și conversațiile.
          </div>
        </div>
      </div>
    );
  }

  const activeThread = threads.find((t) => t.id === threadId) || null;
  const otherUid = activeThread?.participants?.find((p) => p !== uid) || "";
  const otherLabel = otherUid ? userLabels[otherUid] || otherUid : "";

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-5 pb-28">
        {!isChatDetail ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="mt-1 text-2xl font-extrabold">Notificări</h1>
                <div className="mt-1 text-sm text-zinc-400">
                  Alerte din sistem + conversații cu vecinii.
                </div>
              </div>
            </div>

            {tab === "alerts" ? (
              <div className="mt-5 space-y-3">
                {alerts.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-400">
                    Nicio alertă încă.
                  </div>
                ) : (
                  alerts.map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 ${
                        a.read ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold">
                            {alertHeading(a.kind)}
                          </div>

                          <div className="mt-1 text-sm text-zinc-300">
                            {a.title ? `"${a.title}"` : "—"}
                          </div>

                          {a.text ? (
                            <div className="mt-2 text-sm text-zinc-400">
                              {a.text}
                            </div>
                          ) : null}

                          {a.byUid ? (
                            <div className="mt-2 text-xs text-zinc-500">
                              De la: {userLabels[a.byUid] || a.byUid}
                            </div>
                          ) : null}

                          <div className="mt-2 text-xs text-zinc-500">
                            {a.read ? "Citit" : "Necitit"}
                          </div>
                        </div>

                        {!a.read ? (
                          <button
                            onClick={() => markRead(a.id)}
                            className="shrink-0 rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300"
                          >
                            Marchează citit
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="mt-5">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="px-2 text-sm font-extrabold text-zinc-200">
                    Conversații
                  </div>

                  <div className="mt-2 space-y-2">
                    {threads.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-zinc-400">
                        Nicio conversație încă. Apasă „Mesaj” pe o postare.
                      </div>
                    ) : (
                      threads.map((t) => {
                        const other = t.participants?.find((p) => p !== uid) || "";
                        const otherText = userLabels[other] || other || "—";

                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setThreadId(t.id);
                              setTab("chat");
                            }}
                            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/30 px-3 py-3 text-left transition hover:bg-zinc-900/60"
                          >
                            <div className="text-sm font-extrabold">
                              Cu: {otherText}
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">
                              {t.lastMessage || "—"}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[70vh] flex-col">
            <div className="sticky top-0 z-20 -mx-1 mb-3 border-b border-zinc-800 bg-zinc-950/95 px-1 pb-3 pt-1 backdrop-blur">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setThreadId("");
                    setTab("chat");
                  }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-200 hover:bg-zinc-800"
                  aria-label="Înapoi"
                  title="Înapoi"
                >
                  <ArrowLeftIcon />
                </button>

                <div className="min-w-0">
                  <div className="text-lg font-extrabold">Chat</div>
                  <div className="truncate text-sm text-zinc-400">
                    {otherLabel || "Conversație"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-auto pr-1">
              {msgs.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
                  Niciun mesaj încă.
                </div>
              ) : (
                msgs.map((m) => (
                  <div
                    key={m.id}
                    className={`flex w-full ${
                      m.from === uid ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl border px-3 py-2 text-sm ${
                        m.from === uid
                          ? "border-yellow-400/30 bg-yellow-400/15 text-zinc-100"
                          : "border-zinc-800 bg-zinc-950/30 text-zinc-200"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="sticky bottom-16 mt-4 border-t border-zinc-800 bg-zinc-950/95 pt-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <input
                  value={typing}
                  onChange={(e) => setTyping(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Scrie un mesaj..."
                  className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-100 outline-none focus:border-yellow-400"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!typing.trim() || sending}
                  className="rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-extrabold text-zinc-950 hover:bg-yellow-300 disabled:opacity-50"
                >
                  {sending ? "..." : "Trimite"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isChatDetail ? (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-3">
          <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-950/80 p-2 backdrop-blur">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTab("chat");
                  setThreadId("");
                }}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                  tab === "chat"
                    ? "bg-yellow-400 text-zinc-950"
                    : "border border-zinc-800 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-900/70"
                }`}
              >
                Conversații
              </button>

              <button
                onClick={() => {
                  setTab("alerts");
                  setThreadId("");
                }}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                  tab === "alerts"
                    ? "bg-yellow-400 text-zinc-950"
                    : "border border-zinc-800 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-900/70"
                }`}
              >
                Alerte
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}