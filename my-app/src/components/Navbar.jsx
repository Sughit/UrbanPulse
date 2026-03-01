import { NavLink } from "react-router-dom";
import { Home, Map, PlusCircle, Bell, User } from "lucide-react";

export default function Navbar() {
  const base = "flex flex-col items-center justify-center text-[11px] gap-1";
  const active = "text-green-400";
  const inactive = "text-gray-400";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-gray-900 border-t border-gray-800">
      <div className="mx-auto h-full max-w-md flex items-center justify-around">
        <NavLink
          to="/"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          <Home size={20} />
          Acasă
        </NavLink>

        <NavLink
          to="/map"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          <Map size={20} />
          Hartă
        </NavLink>

        <NavLink to="/create" className="flex flex-col items-center -mt-6">
          <div className="rounded-full bg-green-500 p-3 shadow-lg">
            <PlusCircle size={24} className="text-black" />
          </div>
          <span className="text-[10px] text-gray-300 mt-1">Crează</span>
        </NavLink>

        <NavLink
          to="/notifications"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          <Bell size={20} />
          Alerte
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          <User size={20} />
          Profil
        </NavLink>
      </div>
    </nav>
  );
}