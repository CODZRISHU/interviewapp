import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { MessageSquare, Send, CheckCircle2, Building2, HelpCircle, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    requestType: 'general',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message || !formData.subject) {
      toast.error('Please fill out all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/contact', formData);
      setSubmitted(true);
      toast.success('Your request has been logged successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 selection:bg-[#E50914] selection:text-white" data-testid="contact-page">
      <div className="max-w-4xl mx-auto space-y-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return Back
        </button>

        <div className="netflix-card rounded-3xl p-8 md:p-12 border border-white/10 space-y-8">
          <div className="border-b border-white/10 pb-6 space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Enterprise & Support
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>
              Raise a <span className="text-[#E50914]">Request</span>
            </h1>
            <p className="text-gray-400 text-sm max-w-xl">
              Connect with Kevin AI for business partnerships, enterprise custom AI role creation, or technical support.
            </p>
          </div>

          {submitted ? (
            <div className="py-12 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>Request Recorded</h3>
              <p className="text-gray-300 text-sm max-w-md mx-auto">
                Thank you! Your inquiry has been securely stored in our database. Our team will review your ticket shortly.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="netflix-btn-red px-6 py-2.5 rounded-full text-xs font-bold shadow-md mt-4"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Johnson"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E50914]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Business / Personal Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E50914]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Company / Institution (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E50914]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Request Category *</label>
                  <select
                    value={formData.requestType}
                    onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                    className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E50914]"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="enterprise">Enterprise Custom Mock Stage</option>
                    <option value="business_partnership">Business Partnership</option>
                    <option value="custom_role">Request Custom AI Job Role</option>
                    <option value="support">Technical Support & Billing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Subject Header *</label>
                <input
                  type="text"
                  required
                  placeholder="Summarize your request..."
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E50914]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Detailed Request Message *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Describe your request, team requirements, or questions..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-[#0A0A0E] border border-white/15 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E50914]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="netflix-btn-red w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(229,9,20,0.4)] disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Logging Ticket to Database...</>
                ) : (
                  <><Send className="w-4 h-4" /> Submit Business Request</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
