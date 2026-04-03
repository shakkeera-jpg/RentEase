
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { BadgeCheck, BookOpenCheck, CreditCard, LayoutGrid, LogOut, MessageCircle } from "lucide-react";
import useUnreadMessages from "../hooks/useUnreadMessages";


const Sidebar = () => {
  const unreadCount = useUnreadMessages();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    localStorage.clear();
    navigate("/login");
  };


  const navClass = (path) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${location.pathname.toLowerCase() === path.toLowerCase()
      ? "bg-gradient-to-r from-teal-600 to-emerald-500 text-white shadow-md shadow-emerald-200"
      : "text-slate-600 hover:bg-white hover:text-teal-700"
    }`;

  return (
    <aside className="fixed left-0 top-0 z-[960] hidden h-screen w-[280px] overflow-y-auto border-r border-slate-200 bg-[#eaf2ef] p-5 lg:flex lg:flex-col">
      <div className="glass rounded-2xl p-5">
        <Link to="/" className="mb-6 flex items-center gap-2 no-underline">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-sm font-bold text-white">R</span>
          <span className="text-sm font-extrabold tracking-tight text-slate-900">RentEase</span>
        </Link>

        <nav className="flex flex-col gap-2">
          <Link to="/my-rentals" className={navClass("/my-rentals")}>
            <LayoutGrid size={17} />
            My Rentals
          </Link>
          <Link to="/profilepage" className={navClass("/profilepage")}>
            <BadgeCheck size={17} />
            Profile
          </Link>
          <Link to="/bookings" className={navClass("/bookings")}>
            <BookOpenCheck size={17} />
            Bookings
          </Link>
          <Link to="/bankdetails" className={navClass("/bankdetails")}>
            <CreditCard size={17} />
            Bank Details
          </Link>
          <Link to="/messages" className={navClass("/messages")}>
            <div className="relative">
              <MessageCircle size={18} />

              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            Messages
          </Link>
        </nav>
      </div>

      <div className="glass mt-auto rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logged in as</p>
        <p className="mt-1 truncate text-sm font-bold text-slate-800">{user || "User"}</p>

        <button onClick={handleLogout} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800">
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
