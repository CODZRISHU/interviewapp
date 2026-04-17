import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mic, MicOff, Square, ArrowLeft, Loader2, Volume2, VolumeX, ChevronDown, ChevronUp, Send, Code, Users, Briefcase, BookOpen } from 'lucide-react';
import { api } from '../services/api';

const SECTION_META = {
  skills: { label: 'Skills', icon: <Code className="w-3 h-3" />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  projects: { label: 'Projects', icon: <Briefcase className="w-3 h-3" />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  experience: { label: 'Experience', icon: <Users className="w-3 h-3" />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  fundamentals: { label: 'Fundamentals', icon: <BookOpen className="w-3 h-3" />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  introduction: { label: 'Introduction', icon: null, color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const SECTION_GLOW = {
  introduction: 'from-white/20 via-white/5 to-transparent',
  projects: 'from-emerald-400/30 via-emerald-300/10 to-transparent',
  experience: 'from-amber-400/30 via-amber-300/10 to-transparent',
  skills: 'from-blue-400/30 via-blue-300/10 to-transparent',
  fundamentals: 'from-purple-400/30 via-purple-300/10 to-transparent',
};

// TTS Helper
const speakText = (text, onStart, onEnd, voiceRef) => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.95;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google UK English Male') || v.name.includes('Daniel') || v.name.includes('James') ||
      (v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => { onEnd?.(); resolve(); };
    utterance.onerror = () => { onEnd?.(); resolve(); };
    if (voiceRef) voiceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  });
};

export default function InterviewPage() {
  const { interviewId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentSpokenText, setCurrentSpokenText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [responseError, setResponseError] = useState('');
  const [interviewTime, setInterviewTime] = useState(0);
  const [interviewState, setInterviewState] = useState(location.state?.initialState || null);
  const [interviewConfig, setInterviewConfig] = useState(location.state?.config || null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);
  const browserSpeechSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const loadVoices = () => window.speechSynthesis?.getVoices();
    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    const startedAt = interviewState?.started_at;
    if (!startedAt) return undefined;

    const syncElapsedTime = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      setInterviewTime(elapsed);
    };

    syncElapsedTime();
    timerRef.current = setInterval(syncElapsedTime, 1000);
    return () => clearInterval(timerRef.current);
  }, [interviewState?.started_at]);

  useEffect(() => {
    fetchInterview();
    const mediaRecorder = mediaRecorderRef.current;
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort?.();
      if (mediaRecorder?.stream) {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [interviewId]); // eslint-disable-line

  const fetchInterview = async () => {
    try {
      const res = await api.get(`/interviews/${interviewId}`);
      const data = res.data;
      setMessages(data.messages || []);
      if (data.state) setInterviewState(data.state);
      if (data.config) setInterviewConfig(data.config);
      const lastAi = [...(data.messages || [])].reverse().find(m => m.role === 'assistant');
      if (lastAi && !muted) {
        setCurrentSpokenText(lastAi.content);
        speakText(lastAi.content, () => setIsSpeaking(true), () => setIsSpeaking(false), utteranceRef);
      }
    } catch (err) {
      console.error('Failed to fetch interview:', err);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const durationSec = (interviewConfig?.duration || 15) * 60;
  const remainingTime = Math.max(0, durationSec - interviewTime);
  const timeProgress = Math.min(100, (interviewTime / durationSec) * 100);
  const currentQ = interviewState?.current_question || 0;
  const totalQ = interviewState?.total_questions || 8;
  const questionProgress = Math.min(100, (currentQ / totalQ) * 100);
  const currentSection = interviewState?.current_section || 'introduction';
  const coveredSections = interviewState?.covered_sections || {};
  const timeWarning = remainingTime < 120 && remainingTime > 0;

  useEffect(() => {
    if (!interviewState?.started_at || ending || sending) return;
    if (remainingTime === 0) {
      handleEndInterview({ skipConfirm: true });
    }
  }, [ending, interviewState?.started_at, remainingTime, sending]); // eslint-disable-line

  const handleSend = useCallback(async (textOverride) => {
    const userAnswer = (textOverride || input).trim();
    if (!userAnswer || sending) return;
    setVoiceError('');
    setResponseError('');
    setLiveTranscript('');
    setInput('');
    setSending(true);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    setMessages(prev => [...prev, { role: 'user', content: userAnswer, timestamp: new Date().toISOString() }]);

    try {
      const res = await api.post('/next-question', {
        interview_id: interviewId, user_answer: userAnswer
      });

      const aiMsg = res.data.message;
      setMessages(prev => [...prev, { role: 'assistant', content: aiMsg, timestamp: new Date().toISOString() }]);
      if (res.data.state) setInterviewState(res.data.state);
      setCurrentSpokenText(aiMsg);

      if (!muted) {
        await speakText(aiMsg, () => setIsSpeaking(true), () => setIsSpeaking(false), utteranceRef);
      }

      if (res.data.auto_end) {
        await handleEndInterview({ skipConfirm: true });
      }
    } catch (err) {
      console.error('Error:', err);
      setResponseError(err?.response?.data?.detail || 'Kevin could not process that answer. Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, interviewId, muted]); // eslint-disable-line

  const handleEndInterview = async ({ skipConfirm = false } = {}) => {
    if (ending) return;
    if (!skipConfirm && !window.confirm('End interview? Kevin will generate your report.')) return;
    setEnding(true);
    window.speechSynthesis?.cancel();
    clearInterval(timerRef.current);
    try {
      const res = await api.post('/end-interview', { interview_id: interviewId });
      navigate(`/reports/${res.data.id}`, { replace: true });
    } catch (err) {
      alert('Failed to end interview.');
      setEnding(false);
    }
  };

  const toggleMute = () => {
    if (!muted) { window.speechSynthesis?.cancel(); setIsSpeaking(false); }
    setMuted(!muted);
  };

  const submitVoiceTranscript = useCallback((transcript) => {
    const cleanTranscript = transcript.trim();
    setLiveTranscript('');
    if (!cleanTranscript) {
      setVoiceError('No clear speech was detected. Try again or type your answer.');
      return;
    }
    setInput(cleanTranscript);
    handleSend(cleanTranscript);
  }, [handleSend]);

  const startRecording = async () => {
    setVoiceError('');
    setResponseError('');
    setLiveTranscript('');
    try {
      window.speechSynthesis?.cancel(); setIsSpeaking(false);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        transcriptRef.current = '';
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
          let finalText = '';
          let interimText = '';
          for (let i = 0; i < event.results.length; i += 1) {
            const segment = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalText += `${segment} `;
            } else {
              interimText += `${segment} `;
            }
          }
          const preview = `${finalText} ${interimText}`.trim();
          transcriptRef.current = preview;
          setLiveTranscript(preview);
          setInput(preview);
        };
        recognition.onerror = (event) => {
          if (event.error !== 'aborted') {
            setVoiceError('Browser speech recognition could not understand that. You can try again or type your answer.');
          }
        };
        recognition.onend = () => {
          setIsRecording(false);
          const finalText = transcriptRef.current;
          recognitionRef.current = null;
          if (finalText?.trim()) {
            submitVoiceTranscript(finalText);
          }
        };
        recognition.start();
        return;
      }

      setVoiceError('Voice input is available in Chrome or Edge on this local app. This browser does not support live speech recognition yet, so please type your answer.');
    } catch (err) {
      console.error('Recording failed:', err);
      setVoiceError('Microphone access is required for voice input.');
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop?.();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const sectionMeta = SECTION_META[currentSection] || SECTION_META.introduction;
  const glowGradient = SECTION_GLOW[currentSection] || SECTION_GLOW.introduction;

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden" data-testid="interview-page">
      {/* Top Bar */}
      <div className="shrink-0 z-10">
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button data-testid="back-to-dashboard" onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Live</span>
              <span className="text-gray-700">|</span>
              <span className={`font-mono ${timeWarning ? 'text-red-400' : ''}`}>{formatTime(remainingTime)}</span>
              <span className="text-gray-700">|</span>
              <span data-testid="question-counter">Q{currentQ}/{totalQ}</span>
              {interviewConfig && (
                <>
                  <span className="text-gray-700">|</span>
                  <span className="capitalize">{interviewConfig.interview_type}</span>
                  <span className="text-gray-700">|</span>
                  <span className="capitalize">{interviewConfig.level}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Current section badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${sectionMeta.bg} ${sectionMeta.color}`} data-testid="current-section-badge">
              {sectionMeta.icon}
              {sectionMeta.label}
            </div>
            <button data-testid="mute-toggle" onClick={toggleMute} className={`p-2 rounded-full text-xs transition-colors ${muted ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button data-testid="end-interview-btn" onClick={handleEndInterview} disabled={ending}
              className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {ending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
              {ending ? 'Generating Report...' : 'End Interview'}
            </button>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="flex gap-0">
          <div className="flex-1 h-0.5 bg-white/5">
            <div className="h-full bg-white/30 transition-all duration-500" style={{ width: `${questionProgress}%` }} data-testid="question-progress-bar" />
          </div>
          <div className="flex-1 h-0.5 bg-white/5">
            <div className={`h-full transition-all duration-500 ${timeWarning ? 'bg-red-400/50' : 'bg-white/15'}`} style={{ width: `${timeProgress}%` }} data-testid="time-progress-bar" />
          </div>
        </div>

        {/* Section Coverage */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-white/5 bg-[#050505]">
          {Object.entries(coveredSections).map(([section, count]) => {
            const meta = SECTION_META[section] || SECTION_META.skills;
            const planned = interviewState?.question_plan?.distribution?.[section] || 0;
            const done = count >= planned && planned > 0;
            return (
              <div key={section} className={`flex items-center gap-1.5 text-[10px] ${done ? meta.color : 'text-gray-600'}`} data-testid={`section-${section}`}>
                {meta.icon}
                <span className="capitalize">{section}</span>
                <span className="font-mono">{count}/{planned}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Interview Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-6">
        <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] ${glowGradient} opacity-90`} />
        <div className="flex flex-col items-center gap-5 mb-6">
          <div className={`relative`}>
            <div className={`absolute inset-[-48px] rounded-full blur-3xl transition-all duration-500 ${isSpeaking ? 'opacity-100 scale-110' : 'opacity-60 scale-100'} bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] ${glowGradient}`} />
            <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isSpeaking ? 'animate-ping-slow bg-white/10 scale-125' : ''}`} />
            <div className={`absolute inset-[-14px] rounded-full transition-all duration-300 ${isSpeaking ? 'border-2 border-white/25 animate-pulse' : 'border border-white/5'}`} />
            <div className={`absolute inset-[-28px] rounded-full border transition-all duration-500 ${isSpeaking ? 'border-white/15 scale-110 animate-orbit-glow' : 'border-white/5 scale-100'}`} />
            <div className={`w-24 h-24 rounded-full bg-white flex items-center justify-center relative z-10 transition-all duration-300 ${isSpeaking ? 'shadow-[0_0_90px_rgba(255,255,255,0.18)] scale-105' : 'shadow-[0_0_30px_rgba(255,255,255,0.08)]'}`}>
              <span className="text-black font-bold text-3xl" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-medium tracking-tight" style={{ fontFamily: 'Outfit' }}>Kevin</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {sending ? 'Thinking...' : isSpeaking ? 'Speaking...' : isRecording ? 'Listening...' : transcribing ? 'Processing...' : 'Waiting for your answer'}
            </p>
          </div>

          {currentSpokenText && (
            <div className="max-w-lg text-center">
              <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{currentSpokenText}</p>
            </div>
          )}

          {(liveTranscript || voiceError || responseError) && (
            <div className="max-w-lg w-full text-center space-y-2">
              {liveTranscript && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-1">Live Caption</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{liveTranscript}</p>
                </div>
              )}
              {voiceError && (
                <p className="text-xs text-amber-400">{voiceError}</p>
              )}
              {responseError && (
                <p className="text-xs text-red-400">{responseError}</p>
              )}
            </div>
          )}
        </div>

        {(isSpeaking || isRecording) && (
          <div className="flex items-center gap-1 mb-5" data-testid="voice-waveform">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`w-1 rounded-full ${isRecording ? 'bg-red-400' : 'bg-white/40'}`}
                style={{ height: `${Math.random() * 24 + 8}px`, animation: `wave 0.8s ease-in-out ${i * 0.05}s infinite alternate` }} />
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <button data-testid="voice-input-btn" onClick={isRecording ? stopRecording : startRecording}
            disabled={sending || ending || transcribing}
            className={`relative w-18 h-18 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording ? 'bg-red-500 text-white scale-110 shadow-[0_0_40px_rgba(239,68,68,0.3)]'
                : transcribing ? 'bg-white/10 text-gray-400' : 'bg-white text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:scale-105'
            } disabled:opacity-40`} style={{ width: '72px', height: '72px' }}>
            {transcribing ? <Loader2 className="w-6 h-6 animate-spin" /> : isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            {isRecording && <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-40" />}
          </button>
          <p className="text-[10px] text-gray-600">
            {isRecording
              ? 'Tap to stop and submit your answer'
              : transcribing
                ? 'Transcribing on the server...'
                : browserSpeechSupported
                  ? 'Tap to speak with browser voice input'
                  : 'Voice input works best in Chrome or Edge. You can still type below.'}
          </p>
        </div>

        <div className="w-full max-w-lg mt-5">
          <div className="bg-[#0A0A0A] border border-white/8 rounded-xl flex items-center px-4 py-2 gap-2 focus-within:border-white/20 transition-all">
            <input data-testid="interview-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Or type your answer..." className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-700 outline-none" disabled={sending || ending} />
            <button data-testid="send-message-btn" onClick={() => handleSend()} disabled={!input.trim() || sending || ending}
              className="p-1.5 rounded-full bg-white/10 text-gray-400 hover:bg-white hover:text-black transition-all disabled:opacity-20">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Toggle */}
      <div className="shrink-0">
        <button data-testid="toggle-transcript" onClick={() => setShowTranscript(!showTranscript)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors border-t border-white/5 bg-[#050505]">
          {showTranscript ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {showTranscript ? 'Hide' : 'Show'} Transcript ({messages.length} messages)
        </button>
        {showTranscript && (
          <div className="max-h-48 overflow-auto border-t border-white/5 bg-[#080808] px-6 py-4 space-y-3" data-testid="transcript-panel">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shrink-0 text-[8px] font-bold mt-0.5" style={{ fontFamily: 'Outfit' }}>K</div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <p className="text-[10px] text-gray-600 mb-0.5">{msg.role === 'assistant' ? 'Kevin' : 'You'}</p>
                  <p className={`text-xs leading-relaxed ${msg.role === 'user' ? 'text-gray-400' : 'text-gray-300'}`}>{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes wave { from { height: 6px; } to { height: 28px; } }
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.3); opacity: 0; } }
        @keyframes orbit-glow { 0% { transform: scale(1.02); opacity: 0.35; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1.02); opacity: 0.35; } }
        .animate-ping-slow { animation: ping-slow 2s ease-out infinite; }
        .animate-orbit-glow { animation: orbit-glow 2.8s ease-in-out infinite; }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}
