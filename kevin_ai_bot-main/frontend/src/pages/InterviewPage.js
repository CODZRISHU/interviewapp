import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mic, MicOff, Square, ArrowLeft, Loader2, Volume2, VolumeX, ChevronDown, ChevronUp, Send, Code, Users, Briefcase, BookOpen, Sparkles } from 'lucide-react';
import { api } from '../services/api';

const SECTION_META = {
  skills: { label: 'Skills', icon: <Code className="w-3 h-3" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  projects: { label: 'Projects', icon: <Briefcase className="w-3 h-3" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  experience: { label: 'Experience', icon: <Users className="w-3 h-3" />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  fundamentals: { label: 'Fundamentals', icon: <BookOpen className="w-3 h-3" />, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  introduction: { label: 'Introduction', icon: <Sparkles className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

const SECTION_GLOW = {
  introduction: 'from-red-600/20 via-red-900/10 to-transparent',
  projects: 'from-emerald-500/20 via-emerald-950/10 to-transparent',
  experience: 'from-amber-500/20 via-amber-950/10 to-transparent',
  skills: 'from-blue-500/20 via-blue-950/10 to-transparent',
  fundamentals: 'from-purple-500/20 via-purple-950/10 to-transparent',
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
      console.error('End interview error:', err);
      // Fallback redirect to reports page if report was already created
      if (err.response?.status === 409 || err.response?.data?.id) {
        const rptId = err.response?.data?.id || `rpt_${interviewId.replace('int_', '')}`;
        navigate(`/reports/${rptId}`, { replace: true });
        return;
      }
      alert(err.response?.data?.detail || 'Failed to end interview.');
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

      setVoiceError('Voice input is available in Chrome or Edge on this app. Please type your answer below.');
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

  const captionEndRef = useRef(null);

  useEffect(() => {
    if (liveTranscript && captionEndRef.current) {
      captionEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveTranscript]);

  const sectionMeta = SECTION_META[currentSection] || SECTION_META.introduction;
  const glowGradient = SECTION_GLOW[currentSection] || SECTION_GLOW.introduction;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden select-none font-sans" data-testid="interview-page">
      {/* Top Header Bar */}
      <header className="shrink-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-2xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Left Metadata Pill */}
          <div className="flex items-center gap-3">
            <button
              data-testid="back-to-dashboard"
              onClick={() => navigate('/dashboard')}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#EF4444]" />
              <span className="font-semibold tracking-wide text-gray-200">LIVE</span>
              <span className="text-gray-600">|</span>
              <span className={`font-mono font-medium ${timeWarning ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
                {formatTime(remainingTime)}
              </span>
              <span className="text-gray-600">|</span>
              <span data-testid="question-counter" className="font-medium text-gray-300">
                Q{currentQ}/{totalQ}
              </span>
              {interviewConfig && (
                <>
                  <span className="hidden md:inline text-gray-600">|</span>
                  <span className="hidden md:inline capitalize text-gray-400">{interviewConfig.interview_type}</span>
                  <span className="hidden lg:inline text-gray-600">|</span>
                  <span className="hidden lg:inline capitalize text-gray-400">{interviewConfig.level}</span>
                </>
              )}
            </div>
          </div>

          {/* Right Control Bar */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${sectionMeta.bg} ${sectionMeta.color}`} data-testid="current-section-badge">
              {sectionMeta.icon}
              <span>{sectionMeta.label}</span>
            </div>

            <button
              data-testid="mute-toggle"
              onClick={toggleMute}
              className={`p-2 rounded-full text-xs transition-all border ${muted ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
              title={muted ? "Unmute AI Voice" : "Mute AI Voice"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              data-testid="end-interview-btn"
              onClick={() => handleEndInterview()}
              disabled={ending}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg shadow-red-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-white" />}
              <span>{ending ? 'Finishing...' : 'End Interview'}</span>
            </button>
          </div>
        </div>

        {/* Dual Progress Lines */}
        <div className="flex w-full h-1 bg-white/5">
          <div className="h-full bg-red-600 shadow-[0_0_10px_#E50914] transition-all duration-500" style={{ width: `${questionProgress}%` }} data-testid="question-progress-bar" />
          <div className={`h-full transition-all duration-500 ${timeWarning ? 'bg-red-500 animate-pulse' : 'bg-blue-500/40'}`} style={{ width: `${timeProgress}%` }} data-testid="time-progress-bar" />
        </div>

        {/* Section Coverage Bar */}
        <div className="hidden sm:flex items-center justify-center gap-4 sm:gap-8 px-4 py-1.5 border-b border-white/5 bg-[#050505] text-xs">
          {Object.entries(coveredSections).map(([section, count]) => {
            const meta = SECTION_META[section] || SECTION_META.skills;
            const planned = interviewState?.question_plan?.distribution?.[section] || 0;
            const done = count >= planned && planned > 0;
            return (
              <div key={section} className={`flex items-center gap-1.5 transition-colors ${done ? meta.color : 'text-gray-500'}`} data-testid={`section-${section}`}>
                {meta.icon}
                <span className="capitalize font-medium">{section}</span>
                <span className="font-mono text-[11px] opacity-75">{count}/{planned}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Stage Room (Fixed Height, No Page Overflow) */}
      <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col items-center justify-between p-3 sm:p-5">
        
        {/* Background Ambient Netflix Glow */}
        <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] ${glowGradient} opacity-50 transition-all duration-1000`} />

        {/* Kevin AI Avatar Stage & Fixed Viewport Text Cards */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto w-full max-w-2xl space-y-4 min-h-0 flex-1">
          
          {/* Pulsating Glowing Rings & Avatar */}
          <div className="relative flex items-center justify-center shrink-0 my-2">
            <div className={`absolute inset-[-40px] rounded-full blur-3xl transition-all duration-700 ${isSpeaking ? 'bg-red-600/30 scale-110 opacity-100' : 'bg-blue-600/15 scale-100 opacity-50'}`} />
            <div className={`absolute inset-[-15px] rounded-full transition-all duration-500 border ${isSpeaking ? 'border-red-500/40 animate-ping-slow scale-105' : 'border-white/10 scale-100'}`} />
            <div className={`absolute inset-[-8px] rounded-full border transition-all duration-300 ${isSpeaking ? 'border-red-500/60 animate-pulse' : 'border-white/10'}`} />

            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-gray-900 to-black border-2 flex items-center justify-center relative z-10 transition-all duration-500 shadow-2xl ${
              isSpeaking ? 'border-red-500 shadow-[0_0_40px_rgba(229,9,20,0.4)] scale-105' : 'border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.8)]'
            }`}>
              <span className="text-white font-black text-3xl sm:text-4xl tracking-tighter" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
          </div>

          {/* AI Status Title */}
          <div className="text-center shrink-0">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>Kevin AI</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              {sending ? 'Thinking...' : isSpeaking ? 'Speaking...' : isRecording ? 'Listening to your answer...' : transcribing ? 'Transcribing...' : 'Waiting for your answer'}
            </p>
          </div>

          {/* Fixed Height Viewport for Question & Captions (Grows Inside Given Space) */}
          <div className="w-full flex-1 max-h-[38vh] min-h-0 flex flex-col gap-3 justify-center items-center overflow-hidden">
            
            {/* Spoken Question Text Box (Scrollable inside max height) */}
            {currentSpokenText && (
              <div className="w-full max-h-[140px] overflow-y-auto bg-[#0A0A0A]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl text-center custom-scrollbar shrink-0">
                <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-normal">
                  "{currentSpokenText}"
                </p>
              </div>
            )}

            {/* Live Captions Box (Fixed Viewport, Auto-Scrolls with Text) */}
            {(liveTranscript || voiceError || responseError) && (
              <div className="w-full text-center shrink-0">
                {liveTranscript && (
                  <div className="max-h-[120px] overflow-y-auto rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 backdrop-blur-md shadow-xl text-left custom-scrollbar transition-all">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1 sticky top-0 bg-red-950/80 backdrop-blur-sm py-0.5">Live Caption</p>
                    <p className="text-xs sm:text-sm text-gray-100 leading-relaxed font-medium whitespace-pre-wrap">{liveTranscript}</p>
                    <div ref={captionEndRef} />
                  </div>
                )}
                {voiceError && <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-500/20 py-2 px-4 rounded-xl mt-1">{voiceError}</p>}
                {responseError && <p className="text-xs text-red-400 bg-red-950/30 border border-red-500/20 py-2 px-4 rounded-xl mt-1">{responseError}</p>}
              </div>
            )}

            {/* Dynamic Voice Waveform Animation */}
            {(isSpeaking || isRecording) && (
              <div className="flex items-center justify-center gap-1.5 py-1 shrink-0" data-testid="voice-waveform">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${isRecording ? 'bg-red-500 shadow-[0_0_8px_#EF4444]' : 'bg-blue-400 shadow-[0_0_8px_#60A5FA]'}`}
                    style={{
                      height: `${Math.sin(i + Date.now()) * 12 + 14}px`,
                      animation: `wave 0.7s ease-in-out ${i * 0.04}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Control Panel (Always Fixed at Bottom) */}
        <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-3 shrink-0 mt-auto pt-2">
          
          {/* Main Mic Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              data-testid="voice-input-btn"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={sending || ending || transcribing}
              className={`relative w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording
                  ? 'bg-red-600 text-white scale-110 shadow-[0_0_40px_rgba(229,9,20,0.6)]'
                  : transcribing
                  ? 'bg-white/10 text-gray-400'
                  : 'bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]'
              } disabled:opacity-40`}
            >
              {transcribing ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-7 h-7" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
              {isRecording && <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-60" />}
            </button>

            <span className="text-[11px] text-gray-400 font-medium">
              {isRecording
                ? 'Tap to finish & submit answer'
                : transcribing
                ? 'Processing speech...'
                : browserSpeechSupported
                ? 'Tap microphone to speak'
                : 'Type your answer below'}
            </span>
          </div>

          {/* Text Input Box */}
          <div className="w-full">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl flex items-center px-4 py-2.5 gap-3 focus-within:border-white/30 transition-all shadow-xl">
              <input
                data-testid="interview-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Or type your detailed answer here..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none"
                disabled={sending || ending}
              />
              <button
                data-testid="send-message-btn"
                onClick={() => handleSend()}
                disabled={!input.trim() || sending || ending}
                className="p-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all disabled:opacity-20 shadow-md shadow-red-600/20"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Transcript Drawer */}
      <footer className="shrink-0 z-20 bg-[#0A0A0A] border-t border-white/10">
        <button
          data-testid="toggle-transcript"
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {showTranscript ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span>{showTranscript ? 'Hide' : 'Show'} Full Transcript ({messages.length} messages)</span>
        </button>

        {showTranscript && (
          <div className="max-h-56 overflow-y-auto border-t border-white/5 bg-[#050505] px-6 py-4 space-y-3" data-testid="transcript-panel">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ fontFamily: 'Outfit' }}>
                    K
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <p className="text-[10px] text-gray-500 mb-0.5 font-medium">{msg.role === 'assistant' ? 'Kevin AI' : 'You'}</p>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-white/10 text-gray-200' : 'bg-[#0A0A0A] border border-white/5 text-gray-300'}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </footer>

      <style>{`
        @keyframes wave { from { height: 6px; } to { height: 32px; } }
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.35); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 2.2s ease-out infinite; }
      `}</style>
    </div>
  );
}
