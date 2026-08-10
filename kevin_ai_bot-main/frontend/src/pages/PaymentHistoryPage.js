import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { FileText, Download, CreditCard, Calendar, CheckCircle, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Financial Records</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white" style={{ fontFamily: "Outfit" }}>
              Payment Receipts & Invoices
            </h1>
            <p className="text-gray-400 text-sm mt-1">Review past transaction details and download payment receipts.</p>
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="netflix-card rounded-3xl p-16 text-center">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Outfit" }}>No Payment Receipts Yet</h3>
            <p className="text-gray-400 text-xs">Your payment receipts will appear here once you subscribe to a Kevin AI plan.</p>
          </div>
        ) : (
          <div className="netflix-card rounded-3xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400 font-bold uppercase text-xs tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-4 px-6">Invoice #</th>
                    <th className="py-4 px-6">Plan Name</th>
                    <th className="py-4 px-6">Payment Date</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Receipt PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[#E50914]">{p.invoiceNumber}</td>
                      <td className="py-4 px-6 font-bold text-white" style={{ fontFamily: "Outfit" }}>{p.planName}</td>
                      <td className="py-4 px-6 text-gray-400 text-xs font-medium">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                      </td>
                      <td className="py-4 px-6 font-bold text-white">₹{p.totalAmount?.toFixed(2) || p.amount}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Paid
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDownloadInvoice(p.invoiceNumber)}
                          disabled={downloadingInvoice === p.invoiceNumber}
                          className="netflix-btn-red inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md"
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
