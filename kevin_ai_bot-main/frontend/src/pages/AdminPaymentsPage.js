import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { DollarSign, Users, TrendingUp, Download, Search, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Admin Control</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white" style={{ fontFamily: "Outfit" }}>
              Revenue & Subscription Management
            </h1>
            <p className="text-gray-400 text-sm mt-1">Real-time revenue metrics, active subscriptions, and financial export tools.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="netflix-btn-red px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4" /> Export CSV Ledger
          </button>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="netflix-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Revenue</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white" style={{ fontFamily: "Outfit" }}>
                ₹{analytics.totalRevenueInr?.toFixed(2) || 0}
              </p>
            </div>

            <div className="netflix-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Active Subscribers</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white" style={{ fontFamily: "Outfit" }}>
                {analytics.activeSubscriptions || 0}
              </p>
            </div>

            <div className="netflix-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Basic Plans (₹99)</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white" style={{ fontFamily: "Outfit" }}>
                {analytics.basicSubscriptions || 0}
              </p>
            </div>

            <div className="netflix-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Premium Plans (₹199)</span>
                <div className="w-8 h-8 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#E50914]" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white" style={{ fontFamily: "Outfit" }}>
                {analytics.premiumSubscriptions || 0}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search by Invoice #, Name, Email, or Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#E50914]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0A0E] border border-white/15 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-[#E50914]"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <button
            type="submit"
            className="netflix-btn-red px-6 py-3 rounded-2xl font-bold text-xs"
          >
            Filter Records
          </button>
        </form>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="netflix-card rounded-3xl p-16 text-center text-gray-400 font-medium">
            No matching payment logs found.
          </div>
        ) : (
          <div className="netflix-card rounded-3xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400 font-bold uppercase text-xs tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-4 px-6">Invoice #</th>
                    <th className="py-4 px-6">Candidate User</th>
                    <th className="py-4 px-6">Plan Name</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Payment Method</th>
                    <th className="py-4 px-6">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[#E50914]">{p.invoiceNumber}</td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-white" style={{ fontFamily: "Outfit" }}>{p.userName || "User"}</div>
                        <div className="text-xs text-gray-400">{p.userEmail}</div>
                      </td>
                      <td className="py-4 px-6 font-bold text-white">{p.planName}</td>
                      <td className="py-4 px-6 font-bold text-emerald-400">₹{p.totalAmount?.toFixed(2) || p.amount}</td>
                      <td className="py-4 px-6 uppercase text-xs font-semibold text-gray-300">{p.paymentMethod}</td>
                      <td className="py-4 px-6 text-gray-400 text-xs font-medium">
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
