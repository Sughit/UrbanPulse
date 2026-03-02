import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="mt-3 bg-white rounded-2xl shadow p-4 max-w-md">
        <div><b>Username:</b> {user?.username}</div>
        <div><b>Email:</b> {user?.email}</div>
        <div><b>Role:</b> {user?.role}</div>

        <button
          onClick={logout}
          className="mt-4 bg-black text-white rounded-xl px-4 py-2"
        >
          Logout
        </button>
      </div>
    </div>
  );
}