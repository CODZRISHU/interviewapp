import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, FileText, CheckCircle2 } from 'lucide-react';

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 selection:bg-[#E50914] selection:text-white" data-testid="privacy-page">
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
              <Shield className="w-3.5 h-3.5" /> Data Protection & Trust
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>
              Privacy Policy
            </h1>
            <p className="text-gray-400 text-sm">Last updated: August 9, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-light">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <Lock className="w-4 h-4 text-[#E50914]" /> 1. Information We Collect
              </h2>
              <p>
                When you register and conduct AI mock interviews on Kevin AI, we collect personal details (such as your name, email address, and profile picture) and resume documents uploaded to tailor AI interview questions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <FileText className="w-4 h-4 text-[#E50914]" /> 2. Audio Processing & Speech Data
              </h2>
              <p>
                During voice mock interview sessions, speech input is transcribed via Web Speech APIs to generate real-time evaluation scores. Audio streams are processed exclusively for evaluation and are never sold or distributed to third parties.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <CheckCircle2 className="w-4 h-4 text-[#E50914]" /> 3. Data Security & Storage
              </h2>
              <p>
                Candidate data, payment transaction IDs, and interview reports are encrypted at rest and stored in secure MongoDB database instances with strict role-based access control.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit' }}>4. Your Rights</h2>
              <p>
                You retain complete ownership of your uploaded resume files and candidate evaluation reports. You may request account deletion or data retrieval at any time through our contact page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
