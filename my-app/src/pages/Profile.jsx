import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const user = auth.currentUser;

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile(snap.data());
      }
    };

    loadProfile();
  }, [user]);

  const logout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        Nu ești logat.
      </div>
    );
  }

  return (
    <div className="p-6 flex justify-center">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6">

        <h1 className="text-2xl font-semibold mb-4">
          Profil
        </h1>

        <div className="space-y-3">

          <div>
            <span className="opacity-70">Username:</span>
            <div className="font-semibold">
              {profile?.username || "loading..."}
            </div>
          </div>

          <div>
            <span className="opacity-70">Email:</span>
            <div className="font-semibold">
              {user.email}
            </div>
          </div>

          <div>
            <span className="opacity-70">Rol:</span>
            <div className="font-semibold">
              {profile?.role || "USER"}
            </div>
          </div>

        </div>

        <button
          onClick={logout}
          className="mt-6 w-full p-3 rounded-xl bg-red-500 text-white font-semibold"
        >
          Logout
        </button>

      </div>
    </div>
  );
}