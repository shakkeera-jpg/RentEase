import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("admin/users/");
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to load users", err);
      alert(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${u?.name || ""} ${u?.email || ""} ${u?.role || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const setStatus = async (userId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await api.post(`admin/users/${userId}/status/`, { action });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_blocked: res.data.is_blocked } : u))
      );
    } catch (err) {
      console.error("Failed to update user", err);
      alert(err.response?.data?.error || "Failed to update user");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Block users to prevent all logins (including Google login).</p>
        </div>
        <button
          onClick={fetchUsers}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name/email/role..."
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500"
        />
        <span className="text-sm font-semibold text-slate-500">{filtered.length} users</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Trust Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900">
                    {u.name || (u.email ? u.email.split("@")[0] : "—")}
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">{u.trust_score ?? "—"}</td>
                <td className="px-4 py-3">
                  {u.is_blocked ? (
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-black uppercase text-rose-700">
                      Blocked
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.is_blocked ? (
                    <button
                      onClick={() => setStatus(u.id, "activate")}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(u.id, "block")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      Block
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
