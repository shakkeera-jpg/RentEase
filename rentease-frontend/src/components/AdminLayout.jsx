import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck, Landmark, LogOut, ShieldCheck, Users } from "lucide-react";
import useAuthStore from "../store/authStore";

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const adminName = localStorage.getItem("name") || "Admin";
  const adminEmail = localStorage.getItem("username") || "";

  const menuItems = [
    { name: "Verification Requests", path: "/admin/verification", icon: BadgeCheck },
    { name: "Settlements", path: "/admin/settlement", icon: Landmark },
    { name: "Users", path: "/admin/users", icon: Users },
  ];

  const handleLogout = () => {
    logout();
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f8f7] p-4 md:p-6">
      <div className="mx-auto max-w-[1400px]">
        <aside className="fixed left-4 top-4 z-[960] hidden h-[calc(100vh-2rem)] w-[290px] overflow-y-auto rounded-3xl border border-white/60 bg-white/70 p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl md:left-6 md:top-6 md:h-[calc(100vh-3rem)] lg:flex lg:flex-col">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Control Panel</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">RentEase Admin</h2>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-teal-600 to-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={17} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logged in as</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-800">{adminName}</p>
              {adminEmail && <p className="truncate text-xs text-slate-500">{adminEmail}</p>}
            </div>
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck size={14} className="text-teal-600" />
              Secure Admin Session
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl shadow-slate-300/30 backdrop-blur-xl md:p-6 lg:ml-[314px]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
