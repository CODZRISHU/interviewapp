import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, ShieldCheck, CreditCard } from 'lucide-react';

export default function RefundPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 selection:bg-[#E50914] selection:text-white" data-testid="refund-policy-page">
      <div className="max-w-4xl mx-auto space-y-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return Back
        </button>

        <div className="netflix-card rounded-3xl p-8 md:p-12 border border-white/10 space-y-8">
          <div className="border-b border-white/10 pb-6 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] text-xs font-semibold uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5" /> Billing Guarantees
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>
              Cancellation & Refund Policy
            </h1>
            <p className="text-gray-400 text-sm">Last updated: August 9, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-light">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <ShieldCheck className="w-4 h-4 text-[#E50914]" /> 1. Digital Services Policy
              </h2>
              <p>
                Kevin AI provides digital AI interview simulation credits. Due to the immediate allocation of AI compute resources, consumed interview credits are non-refundable once an interview session exceeds 2 minutes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <CreditCard className="w-4 h-4 text-[#E50914]" /> 2. Refund Eligibility (Unused Credits)
              </h2>
              <p>
                If you were charged incorrectly or experience a payment duplicate via Razorpay, you may request a full refund within 7 calendar days of purchase, provided 0 plan credits have been consumed.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit' }}>3. How to Request a Refund</h2>
              <p>
                To raise a billing refund request, submit an inquiry via our Contact page with your Razorpay Payment ID or Invoice Number. Approved refunds will be credited back to your original payment source within 5–7 business days.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
