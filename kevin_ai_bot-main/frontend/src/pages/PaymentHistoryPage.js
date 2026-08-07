import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { FileText, Download, CreditCard, Calendar, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get("/billing/history");
      setPayments(res.data || []);
    } catch (err) {
      toast.error("Failed to load payment history.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceNumber) => {
    try {
      setDownloadingInvoice(invoiceNumber);
      const res = await api.get(`/billing/invoices/${invoiceNumber}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Invoice downloaded successfully!");
    } catch (err) {
      toast.error("Failed to download PDF invoice.");
    } finally {
      setDownloadingInvoice(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Payment History & Invoices</h1>
            <p className="text-gray-400 text-sm">View your past subscription receipts and download tax invoices.</p>
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading payment history...</div>
        ) : payments.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No payments yet</h3>
            <p className="text-gray-500 text-sm mb-6">Your payment history will appear here once you subscribe.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400 font-semibold uppercase text-xs tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-4 px-6">Invoice #</th>
                    <th className="py-4 px-6">Plan</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-blue-400">{p.invoiceNumber}</td>
                      <td className="py-4 px-6 font-medium text-white">{p.planName}</td>
                      <td className="py-4 px-6 text-gray-400 text-xs">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                      </td>
                      <td className="py-4 px-6 font-bold text-white">₹{p.totalAmount?.toFixed(2) || p.amount}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" /> Success
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDownloadInvoice(p.invoiceNumber)}
                          disabled={downloadingInvoice === p.invoiceNumber}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-all border border-white/10"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {downloadingInvoice === p.invoiceNumber ? "Downloading..." : "PDF Invoice"}
                        </button>
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
