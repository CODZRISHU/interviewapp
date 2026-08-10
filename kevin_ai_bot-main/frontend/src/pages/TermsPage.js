import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, ShieldAlert, CheckSquare } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 selection:bg-[#E50914] selection:text-white" data-testid="terms-page">
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
              <FileText className="w-3.5 h-3.5" /> Agreement & Rules
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>
              Terms of Service
            </h1>
            <p className="text-gray-400 text-sm">Last updated: August 9, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-light">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <CheckSquare className="w-4 h-4 text-[#E50914]" /> 1. Service Overview
              </h2>
              <p>
                Kevin AI provides real-time voice-driven AI mock interviews, resume parsing, and candidate scoring scorecards. By creating an account or purchasing subscription credits, you agree to these terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <ShieldAlert className="w-4 h-4 text-[#E50914]" /> 2. Fair Usage & Candidate Conduct
              </h2>
              <p>
                Users agree to use Kevin AI for personal interview preparation. Automated scraping, reverse engineering AI prompts, or attempting to bypass credit restrictions is strictly prohibited.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit' }}>3. Subscription & Credit Validity</h2>
              <p>
                Subscription plans (Basic ₹99, Premium ₹199) remain active for 30 calendar days from activation date. Top-up packs (TOP-X, TOP-Y, TOP-Z) inherit the validity of your current active main plan.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit' }}>4. AI Evaluation Disclaimer</h2>
              <p>
                Kevin AI evaluation scores and feedback reports are generated algorithmically to assist candidate practice. While designed for high accuracy, Kevin AI scores do not guarantee official hiring offers from prospective employers.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
