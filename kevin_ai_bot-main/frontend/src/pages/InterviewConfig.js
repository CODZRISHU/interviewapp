import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Play, Loader2, Code, Users, Shuffle, GraduationCap, Briefcase, Award, Clock } from 'lucide-react';
import { api } from '../services/api';

const TYPES = [
  { id: 'technical', label: 'Technical', desc: 'DSA, system design, coding concepts', icon: <Code className="w-5 h-5" /> },
  { id: 'behavioural', label: 'Behavioural', desc: 'STAR method, leadership, teamwork', icon: <Users className="w-5 h-5" /> },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced technical + behavioural', icon: <Shuffle className="w-5 h-5" /> },
];

const LEVELS = [
  { id: 'fresher', label: 'Fresher', desc: '0-1 years', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'mid', label: 'Mid Level', desc: '2-5 years', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'senior', label: 'Senior', desc: '5+ years', icon: <Award className="w-5 h-5" /> },
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
    duration: 15,
  });
  const [starting, setStarting] = useState(false);
  const [customRole, setCustomRole] = useState('');

  const handleStart = async () => {
    if (!user?.resumeText) {
      alert('Please upload your resume first from the dashboard.');
      navigate('/dashboard');
      return;
    }
    setStarting(true);
    try {
      const res = await api.post('/start-interview', config);
      await checkAuth();
      navigate(`/interview/${res.data.interview_id}`, {
        state: { config, initialState: res.data.state }
      });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start interview');
      setStarting(false);
    }
  };

  const totalQ = Math.max(4, Math.floor(config.duration / 2));

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col" data-testid="interview-config-page">
      <div className="h-14 flex items-center px-6 border-b border-white/5 shrink-0">
        <button data-testid="config-back-btn" onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-white transition-colors mr-4">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-medium" style={{ fontFamily: 'Outfit' }}>Configure Interview</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-10">
            <h2 className="text-lg font-medium tracking-tight mb-1" style={{ fontFamily: 'Outfit' }}>Interview Type</h2>
            <p className="text-xs text-gray-500 mb-4">Choose the focus of your interview</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TYPES.map(t => (
                <button
                  key={t.id}
                  data-testid={`type-${t.id}`}
                  onClick={() => setConfig(c => ({ ...c, interview_type: t.id }))}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    config.interview_type === t.id
                      ? 'border-white/30 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.04)]'
                      : 'border-white/5 bg-[#0A0A0A] hover:border-white/15'
                  }`}
                >
                  <div className={`mb-3 ${config.interview_type === t.id ? 'text-white' : 'text-gray-500'}`}>{t.icon}</div>
                  <p className="text-sm font-medium mb-0.5">{t.label}</p>
                  <p className="text-[11px] text-gray-500">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-medium tracking-tight mb-1" style={{ fontFamily: 'Outfit' }}>Experience Level</h2>
            <p className="text-xs text-gray-500 mb-4">Kevin will adjust difficulty accordingly</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  data-testid={`level-${l.id}`}
                  onClick={() => setConfig(c => ({ ...c, level: l.id }))}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    config.level === l.id
                      ? 'border-white/30 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.04)]'
                      : 'border-white/5 bg-[#0A0A0A] hover:border-white/15'
                  }`}
                >
                  <div className={`mb-3 ${config.level === l.id ? 'text-white' : 'text-gray-500'}`}>{l.icon}</div>
                  <p className="text-sm font-medium mb-0.5">{l.label}</p>
                  <p className="text-[11px] text-gray-500">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-medium tracking-tight mb-1" style={{ fontFamily: 'Outfit' }}>Target Role</h2>
            <p className="text-xs text-gray-500 mb-4">Select or type your target role</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ROLES.map(r => (
                <button
                  key={r}
                  data-testid={`role-${r.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => { setConfig(c => ({ ...c, role: r })); setCustomRole(''); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    config.role === r && !customRole
                      ? 'bg-white text-black'
                      : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              data-testid="custom-role-input"
              value={customRole}
              onChange={(e) => { setCustomRole(e.target.value); setConfig(c => ({ ...c, role: e.target.value || c.role })); }}
              placeholder="Or type a custom role..."
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-white/25 transition-all"
            />
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-medium tracking-tight mb-1" style={{ fontFamily: 'Outfit' }}>Duration</h2>
            <p className="text-xs text-gray-500 mb-4">Choose the interview length that matches your practice goal</p>
            <div className="grid grid-cols-3 gap-3">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  data-testid={`duration-${d.value}`}
                  onClick={() => setConfig(c => ({ ...c, duration: d.value }))}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    config.duration === d.value
                      ? 'border-white/30 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.04)]'
                      : 'border-white/5 bg-[#0A0A0A] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Clock className={`w-4 h-4 ${config.duration === d.value ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="text-[11px] text-gray-500">{d.questions}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 mb-8">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3" style={{ fontFamily: 'Outfit' }}>Interview Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500 text-xs">Type:</span><p className="font-medium capitalize">{config.interview_type}</p></div>
              <div><span className="text-gray-500 text-xs">Level:</span><p className="font-medium capitalize">{config.level}</p></div>
              <div><span className="text-gray-500 text-xs">Role:</span><p className="font-medium">{customRole || config.role}</p></div>
              <div><span className="text-gray-500 text-xs">Duration:</span><p className="font-medium">{config.duration} min ({totalQ} questions)</p></div>
            </div>
          </div>

          <button
            data-testid="start-configured-interview-btn"
            onClick={handleStart}
            disabled={starting}
            className="w-full bg-white text-black py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-50"
          >
            {starting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Preparing interview...</>
            ) : (
              <><Play className="w-4 h-4" /> Start Interview with Kevin</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
