import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { DollarSign, Users, TrendingUp, Download, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);


  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [payRes, statRes] = await Promise.all([
        api.get("/admin/payments", { params: { status: statusFilter, search } }),
        api.get("/admin/payments/analytics"),
      ]);
      setPayments(payRes.data || []);
      setAnalytics(statRes.data || {});
    } catch (err) {
      toast.error("Failed to load admin payment data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAdminData();
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get("/admin/payments/export", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kevin_ai_payments_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("CSV exported successfully!");
    } catch (err) {
      toast.error("CSV Export failed.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
      <div className="max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Admin Payment Management</h1>
            <p className="text-gray-400 text-sm">Monitor revenue analytics, active subscriptions, and export transaction data.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="mt-4 md:mt-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-gray-400">Total Revenue</span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">₹{analytics.totalRevenueInr?.toFixed(2) || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-gray-400">Active Subscriptions</span>
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">{analytics.activeSubscriptions || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-gray-400">Basic Subscriptions</span>
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">{analytics.basicSubscriptions || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-gray-400">Premium Subscriptions</span>
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">{analytics.premiumSubscriptions || 0}</p>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by Invoice #, User Name, Email, or Transaction ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all" className="bg-neutral-900">All Statuses</option>
            <option value="success" className="bg-neutral-900">Success</option>
            <option value="failed" className="bg-neutral-900">Failed</option>
            <option value="refunded" className="bg-neutral-900">Refunded</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
          >
            Search
          </button>
        </form>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading admin transaction logs...</div>
        ) : payments.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center text-gray-500">
            No transaction records match your filters.
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400 font-semibold uppercase text-xs tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-4 px-6">Invoice #</th>
                    <th className="py-4 px-6">User</th>
                    <th className="py-4 px-6">Plan</th>
                    <th className="py-4 px-6">Total Paid</th>
                    <th className="py-4 px-6">Method</th>
                    <th className="py-4 px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-blue-400">{p.invoiceNumber}</td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">{p.userName || "User"}</div>
                        <div className="text-xs text-gray-500">{p.userEmail}</div>
                      </td>
                      <td className="py-4 px-6 font-medium text-white">{p.planName}</td>
                      <td className="py-4 px-6 font-bold text-emerald-400">₹{p.totalAmount?.toFixed(2) || p.amount}</td>
                      <td className="py-4 px-6 uppercase text-xs text-gray-400">{p.paymentMethod}</td>
                      <td className="py-4 px-6 text-gray-400 text-xs">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
