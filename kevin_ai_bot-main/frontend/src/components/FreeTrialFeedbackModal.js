import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Star, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FreeTrialFeedbackModal({ isOpen, onClose }) {
  const { user, checkAuth } = useAuth();
  const [voiceRating, setVoiceRating] = useState(5);
  const [accuracyRating, setAccuracyRating] = useState(5);
  const [role, setRole] = useState('Software Engineer');
  const [level, setLevel] = useState('Fresher');
  const [perceivedAiQuality, setPerceivedAiQuality] = useState('');
  const [desiredFeatures, setDesiredFeatures] = useState('');
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!perceivedAiQuality.trim()) {
      toast.error('Please share your thoughts on how Kevin AI performed.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/feedback', {
        voiceQualityRating: voiceRating,
        questionAccuracyRating: accuracyRating,
        targetRole: role.trim() || 'Software Engineer',
        experienceLevel: level.trim() || 'Fresher',
        perceivedAiQuality: perceivedAiQuality.trim(),
        desiredFeatures: desiredFeatures.trim() || null,
        generalFeedback: generalFeedback.trim() || null,
      });
      toast.success('Thank you! Your feedback helps us improve Kevin AI.');
      if (user?.id) {
        localStorage.setItem(`kevin-feedback-submitted-${user.id}`, 'true');
      }
      await checkAuth();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg || 'Validation failed. Please check your inputs.');
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Failed to submit feedback.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="netflix-card rounded-3xl max-w-lg w-full p-6 md:p-8 border border-[#E50914]/30 shadow-[0_0_50px_rgba(229,9,20,0.25)] relative my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Help Us Improve Kevin AI
            </div>
            <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>
              Your Free Trial Experience
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              You have completed your free trial mock interview! Tell us how Kevin performed so we can enhance question accuracy and voice response.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Voice Quality Rating */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Voice & Speech Naturalness</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setVoiceRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-6 h-6 ${star <= voiceRating ? 'fill-amber-400 text-amber-400' : 'text-gray-600'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Question Accuracy Rating */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Resume Question Relevance</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setAccuracyRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-6 h-6 ${star <= accuracyRating ? 'fill-amber-400 text-amber-400' : 'text-gray-600'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Role & Level */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">Target Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E50914]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E50914]"
                >
                  <option value="Fresher">Fresher (0-1 yrs)</option>
                  <option value="Mid">Mid Level (2-5 yrs)</option>
                  <option value="Senior">Senior (5+ yrs)</option>
                </select>
              </div>
            </div>

            {/* How did AI feel */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">How did Kevin AI feel during interview? *</label>
              <textarea
                required
                rows={3}
                placeholder="Who did Kevin AI feel like? How realistic were follow-ups and feedback?"
                value={perceivedAiQuality}
                onChange={(e) => setPerceivedAiQuality(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-[#E50914]"
              />
            </div>

            {/* Desired features */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">What features should we add next?</label>
              <input
                type="text"
                placeholder="e.g. System Design Canvas, DSA Code Editor..."
                value={desiredFeatures}
                onChange={(e) => setDesiredFeatures(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E50914]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="netflix-btn-red w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(229,9,20,0.4)] disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving Feedback...</>
              ) : (
                <><Send className="w-4 h-4" /> Submit Feedback</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
