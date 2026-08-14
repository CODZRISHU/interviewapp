import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Play, Loader2, Code, Users, Shuffle, GraduationCap, Briefcase, Award, Clock, Sparkles, AlertTriangle, Laptop, Smartphone } from 'lucide-react';
import { api } from '../services/api';

const TYPES = [
  { id: 'technical', label: 'Technical', desc: 'DSA, system design, coding concepts', icon: <Code className="w-5 h-5" /> },
  { id: 'behavioural', label: 'Behavioural', desc: 'STAR method, leadership, teamwork', icon: <Users className="w-5 h-5" /> },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced technical + behavioural', icon: <Shuffle className="w-5 h-5" /> },
];

const LEVELS = [
  { id: 'fresher', label: 'Fresher', desc: '0-1 years experience', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'mid', label: 'Mid Level', desc: '2-5 years experience', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'senior', label: 'Senior', desc: '5+ years experience', icon: <Award className="w-5 h-5" /> },
];

const DURATIONS = [
  { value: 10, label: '10 min', questions: '~5 questions' },
  { value: 15, label: '15 min', questions: '~8 questions' },
  { value: 30, label: '30 min', questions: '~15 questions' },
];

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Scientist', 'DevOps Engineer', 'Mobile Developer',
  'ML Engineer', 'Cloud Architect', 'Software Engineer',
];

export default function InterviewConfig() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    interview_type: 'mixed',
    level: 'fresher',
    role: 'Software Engineer',
    duration: 10,
  });
  const [starting, setStarting] = useState(false);
  const [customRole, setCustomRole] = useState('');

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeErrorMsg, setUpgradeErrorMsg] = useState('');
  const [showMobileWarningModal, setShowMobileWarningModal] = useState(false);

  const hasCreditsOrEntitlement = (user?.creditsRemaining ?? 0) > 0 || user?.canStartInterview || (user?.referralRewardsClaimed ?? 0) > 0;
  const isFreeTrialUsed = (user?.planKey === "free_trial" || user?.plan === "free") 
    && !hasCreditsOrEntitlement 
    && (user?.trialUsed || user?.billingStatus === "trial_used");

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  };

  const handleStart = async (bypassMobileCheck = false) => {
    if (isFreeTrialUsed) {
      setUpgradeErrorMsg("Your free trial attempt has already been used. Please subscribe to a plan to start a new interview.");
      setShowUpgradeModal(true);
      return;
    }

    if (!user?.resumeText) {
      alert('Please upload your resume first.');
      navigate('/dashboard', { state: { openUpload: true } });
      return;
    }

    if (!bypassMobileCheck && isMobileDevice()) {
      setShowMobileWarningModal(true);
      return;
    }

    setShowMobileWarningModal(false);
    setStarting(true);
    try {
      const res = await api.post('/start-interview', config);
      await checkAuth();
      navigate(`/interview/${res.data.interview_id}`, {
        state: { config, initialState: res.data.state }
      });
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 409) {
        setUpgradeErrorMsg(err.response?.data?.detail || 'Upgrade required to start this interview.');
        setShowUpgradeModal(true);
      } else {
        alert(err.response?.data?.detail || 'Failed to start interview');
      }
      setStarting(false);
    }
  };

  const totalQ = Math.max(4, Math.floor(config.duration / 2));

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col" data-testid="interview-config-page">
      {/* Top Bar */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#08080A] shrink-0">
        <div className="flex items-center gap-3">
          <button data-testid="config-back-btn" onClick={() => navigate('/dashboard')} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
            Configure Interview <span className="text-[#E50914]">Stage</span>
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30">
          <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">AI Studio</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
          {/* Section 1: Type */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Interview Focus</h2>
            <p className="text-xs text-gray-400 mb-4">Select topic orientation for Kevin's questions</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TYPES.map(t => (
                <button
                  key={t.id}
                  data-testid={`type-${t.id}`}
                  onClick={() => setConfig(c => ({ ...c, interview_type: t.id }))}
                  className={`p-5 rounded-2xl border text-left transition-all ${
                    config.interview_type === t.id
                      ? 'border-[#E50914] bg-[#E50914]/10 shadow-[0_0_25px_rgba(229,9,20,0.25)]'
                      : 'netflix-card hover:border-white/20'
                  }`}
                >
                  <div className={`mb-3 ${config.interview_type === t.id ? 'text-[#E50914]' : 'text-gray-400'}`}>{t.icon}</div>
                  <p className="text-sm font-bold mb-1 text-white" style={{ fontFamily: 'Outfit' }}>{t.label}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Level */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Experience Tier</h2>
            <p className="text-xs text-gray-400 mb-4">Adjust question depth and expectations</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  data-testid={`level-${l.id}`}
                  onClick={() => setConfig(c => ({ ...c, level: l.id }))}
                  className={`p-5 rounded-2xl border text-left transition-all ${
                    config.level === l.id
                      ? 'border-[#E50914] bg-[#E50914]/10 shadow-[0_0_25px_rgba(229,9,20,0.25)]'
                      : 'netflix-card hover:border-white/20'
                  }`}
                >
                  <div className={`mb-3 ${config.level === l.id ? 'text-[#E50914]' : 'text-gray-400'}`}>{l.icon}</div>
                  <p className="text-sm font-bold mb-1 text-white" style={{ fontFamily: 'Outfit' }}>{l.label}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Role */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Target Position</h2>
            <p className="text-xs text-gray-400 mb-4">Select or specify target job title</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => { setConfig(c => ({ ...c, role: r })); setCustomRole(''); }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    config.role === r && !customRole
                      ? 'bg-[#E50914] text-white shadow-md'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or enter custom role..."
              value={customRole}
              onChange={e => {
                setCustomRole(e.target.value);
                setConfig(c => ({ ...c, role: e.target.value || 'Software Engineer' }));
              }}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E50914]"
            />
          </div>

          {/* Section 4: Duration */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Session Duration</h2>
            <p className="text-xs text-gray-400 mb-4">Choose interview time allocation</p>
            <div className="grid grid-cols-3 gap-4">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setConfig(c => ({ ...c, duration: d.value }))}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    config.duration === d.value
                      ? 'border-[#E50914] bg-[#E50914]/10 shadow-[0_0_25px_rgba(229,9,20,0.25)]'
                      : 'netflix-card hover:border-white/20'
                  }`}
                >
                  <Clock className={`w-5 h-5 mx-auto mb-2 ${config.duration === d.value ? 'text-[#E50914]' : 'text-gray-400'}`} />
                  <p className="text-sm font-bold text-white mb-0.5" style={{ fontFamily: 'Outfit' }}>{d.label}</p>
                  <p className="text-[11px] text-gray-400">{d.questions}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Summary Box */}
          <div className="netflix-card rounded-3xl p-6 border border-white/10">
            <h3 className="text-xs text-[#E50914] uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'Outfit' }}>Configured Session Matrix</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400 text-xs block mb-1">Focus:</span><p className="font-bold text-white capitalize">{config.interview_type}</p></div>
              <div><span className="text-gray-400 text-xs block mb-1">Level:</span><p className="font-bold text-white capitalize">{config.level}</p></div>
              <div><span className="text-gray-400 text-xs block mb-1">Role:</span><p className="font-bold text-white truncate">{customRole || config.role}</p></div>
              <div><span className="text-gray-400 text-xs block mb-1">Length:</span><p className="font-bold text-white">{config.duration} min ({totalQ} Qs)</p></div>
            </div>
          </div>

          <button
            data-testid="start-configured-interview-btn"
            onClick={() => handleStart(false)}
            disabled={starting}
            className="netflix-btn-red w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-[0_0_35px_rgba(229,9,20,0.5)] disabled:opacity-50"
          >
            {starting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparing AI Interview Stage...</>
            ) : (
              <><Play className="w-5 h-5 fill-white" /> Launch Interview Room</>
            )}
          </button>
        </div>
      </div>

      {showMobileWarningModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="netflix-card rounded-3xl max-w-md w-full p-8 text-center border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-5">
              <Laptop className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Outfit' }}>
              Desktop / Laptop Recommended
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm mb-6 leading-relaxed">
              Mobile web browsers have audio hardware & speech API limitations that may cause mic pauses or transcript repetitions. For the most realistic, seamless AI interview experience, we strongly recommend using a <b>Laptop or Desktop</b>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowMobileWarningModal(false)}
                className="flex-1 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-xs text-white transition"
              >
                Close & Cancel
              </button>
              <button
                onClick={() => handleStart(true)}
                className="netflix-btn-red flex-1 py-3.5 rounded-xl font-bold text-xs shadow-md"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="netflix-card rounded-3xl max-w-md w-full p-8 text-center border border-[#E50914]/30 shadow-[0_0_50px_rgba(229,9,20,0.2)]">
            <div className="w-14 h-14 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit' }}>Credit Upgrade Needed</h3>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">{upgradeErrorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-xs text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate('/subscription')}
                className="netflix-btn-red flex-1 py-3 rounded-xl font-bold text-xs shadow-md"
              >
                View Plans & Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
