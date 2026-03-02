import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  async function onLogout() {
    await logout();
    nav("/login");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Profil</h1>
      <p className="text-gray-400 mt-2">Setări cont și detalii.</p>

      <div className="mt-4 max-w-md bg-gray-900/60 border border-gray-800 rounded-3xl p-5">
        <Row k="Username" v={user?.username || "-"} />
        <Row k="Email" v={user?.email || "-"} />
        <Row k="Role" v={user?.role || "user"} />

        <button
          onClick={onLogout}
          className="mt-5 w-full h-12 rounded-2xl bg-gray-950/60 border border-gray-800 text-gray-100
                     hover:border-gray-600 hover:text-white transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-b-0">
      <div className="text-sm text-gray-400">{k}</div>
      <div className="text-sm font-semibold">{v}</div>
    </div>
  );
}