import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, triggerGlobalUserRefresh } from '../context/AuthContext';
import {
  Mic, MicOff, Square, ArrowLeft, Loader2, Volume2, VolumeX,
  Send, Code, Users, Briefcase, BookOpen, Sparkles, Video, VideoOff,
  CameraOff, MessageSquare
} from 'lucide-react';
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
  const [currentSpokenText, setCurrentSpokenText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [responseError, setResponseError] = useState('');
  const [interviewTime, setInterviewTime] = useState(0);
  const [interviewState, setInterviewState] = useState(location.state?.initialState || null);
  const [interviewConfig, setInterviewConfig] = useState(location.state?.config || null);

  // Video & Webcam State
  const [cameraOn, setCameraOn] = useState(true);
  const videoRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);
  const browserSpeechSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Auto-scroll chat thread
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, liveTranscript]);

  // Webcam Stream Handler
  useEffect(() => {
    let stream = null;
    if (cameraOn && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 320, height: 240 }, audio: false })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn('Webcam stream error:', err);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraOn]);

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
    if (!skipConfirm && !window.confirm('End interview? Kevin will generate your evaluation report.')) return;
    setEnding(true);
    window.speechSynthesis?.cancel();
    clearInterval(timerRef.current);
    try {
      const res = await api.post('/end-interview', { interview_id: interviewId });
      triggerGlobalUserRefresh();
      navigate(`/reports/${res.data.id}`, { replace: true });
    } catch (err) {
      console.error('End interview error:', err);
      if (err.response?.status === 409 || err.response?.data?.id) {
        const rptId = err.response?.data?.id || `rpt_${interviewId.replace('int_', '')}`;
        triggerGlobalUserRefresh();
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
      setVoiceError('No clear speech detected. Please speak clearly or type your answer.');
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
            setVoiceError('Speech recognition issue. You can try speaking again or type your answer.');
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

      setVoiceError('Voice speech input requires Chrome or Edge. Please type your answer below.');
    } catch (err) {
      console.error('Recording failed:', err);
      setVoiceError('Microphone permission is required.');
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
    <div className="flex flex-col lg:flex-row h-screen bg-[#050505] text-white overflow-y-auto lg:overflow-hidden font-sans select-none" data-testid="interview-page">
      
      {/* LEFT PANEL: 70% WIDTH ON DESKTOP, FULL WIDTH ON MOBILE */}
      <div className="w-full lg:w-[70%] flex flex-col min-h-[500px] lg:h-full border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden bg-[#050505] shrink-0">
        
        {/* Top Header Bar */}
        <header className="shrink-0 z-20 bg-[#08080B]/95 backdrop-blur-2xl border-b border-white/10 shadow-xl">
          <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            
            {/* Left Status Indicators */}
            <div className="flex items-center gap-3">
              <button
                data-testid="back-to-dashboard"
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#EF4444]" />
                <span className="font-bold tracking-wider text-gray-200">LIVE</span>
                <span className="text-gray-600">|</span>
                <span className={`font-mono font-bold ${timeWarning ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
                  {formatTime(remainingTime)}
                </span>
                <span className="text-gray-600">|</span>
                <span data-testid="question-counter" className="font-bold text-gray-300">
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

            {/* Right Controls */}
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
                className="netflix-btn-red px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-white" />}
                <span>{ending ? 'Finishing...' : 'End Interview'}</span>
              </button>
            </div>
          </div>

          {/* Dual Progress Bars */}
          <div className="flex w-full h-1 bg-white/5">
            <div className="h-full bg-[#E50914] shadow-[0_0_10px_#E50914] transition-all duration-500" style={{ width: `${questionProgress}%` }} />
            <div className={`h-full transition-all duration-500 ${timeWarning ? 'bg-red-500 animate-pulse' : 'bg-blue-500/40'}`} style={{ width: `${timeProgress}%` }} />
          </div>
        </header>

        {/* Main Stage (Kevin AI Avatar Room) */}
        <main className="flex-1 min-h-0 relative flex flex-col items-center justify-center p-6 overflow-hidden">
          
          {/* Background Ambient Glow */}
          <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] ${glowGradient} opacity-50 transition-all duration-1000`} />

          {/* Avatar & Voice Waves */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto space-y-6">
            <div className="relative flex items-center justify-center">
              <div className={`absolute inset-[-50px] rounded-full blur-3xl transition-all duration-700 ${isSpeaking ? 'bg-red-600/35 scale-125 opacity-100' : 'bg-blue-600/15 scale-100 opacity-50'}`} />
              <div className={`absolute inset-[-20px] rounded-full transition-all duration-500 border ${isSpeaking ? 'border-red-500/40 animate-ping-slow scale-110' : 'border-white/10 scale-100'}`} />
              
              <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-b from-gray-900 to-black border-2 flex items-center justify-center relative z-10 transition-all duration-500 shadow-2xl ${
                isSpeaking ? 'border-[#E50914] shadow-[0_0_60px_rgba(229,9,20,0.5)] scale-105' : 'border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.8)]'
              }`}>
                <span className="text-white font-black text-5xl sm:text-6xl tracking-tighter" style={{ fontFamily: 'Outfit' }}>K</span>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>Kevin AI</h2>
              <p className="text-sm text-gray-400 mt-1 font-semibold">
                {sending ? 'Thinking...' : isSpeaking ? 'Speaking...' : isRecording ? 'Listening to your answer...' : transcribing ? 'Transcribing...' : 'Waiting for your answer'}
              </p>
            </div>

            {/* Dynamic Voice Waveform */}
            {(isSpeaking || isRecording) && (
              <div className="flex items-center justify-center gap-1.5 py-2" data-testid="voice-waveform">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${isRecording ? 'bg-red-500 shadow-[0_0_10px_#EF4444]' : 'bg-blue-400 shadow-[0_0_10px_#60A5FA]'}`}
                    style={{
                      height: `${Math.sin(i + Date.now()) * 16 + 18}px`,
                      animation: `wave 0.7s ease-in-out ${i * 0.03}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* PIP Bottom Right Corner Webcam Box (Zoom / Google Meet Call style) */}
          <div className="absolute bottom-6 right-6 z-30 w-44 sm:w-56 h-32 sm:h-40 rounded-2xl border-2 border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.8)] bg-[#0A0A0E] overflow-hidden group">
            {cameraOn ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#0F0F12] text-gray-500">
                <CameraOff className="w-8 h-8 mb-1 text-gray-600" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Camera Off</span>
              </div>
            )}

            {/* User Name Badge on Video Box */}
            <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white truncate max-w-[130px]">
              {user?.name || 'You'} (Candidate)
            </div>

            {/* Camera Toggle Button */}
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white hover:bg-black/90 transition-all opacity-80 group-hover:opacity-100"
              title={cameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {cameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
            </button>
          </div>
        </main>
      </div>

      {/* RIGHT PANEL: 30% WIDTH (Live Chat Thread & Controls) */}
      <div className="lg:w-[30%] flex flex-col h-full bg-[#09090C] border-l border-white/10 z-20">
        
        {/* Right Header */}
        <div className="p-4 border-b border-white/10 bg-[#0D0D12] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#E50914]" />
            <h3 className="text-sm font-bold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Interview Transcript & Chat
            </h3>
          </div>
          <span className="text-[11px] text-gray-400 font-mono bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
            {messages.length} msgs
          </span>
        </div>

        {/* Chat Thread Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#B20710] to-[#E50914] text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-md" style={{ fontFamily: 'Outfit' }}>
                  K
                </div>
              )}

              <div className={`max-w-[88%] space-y-1 ${msg.role === 'user' ? 'items-end text-right' : 'items-start'}`}>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
                  {msg.role === 'assistant' ? 'Kevin AI' : user?.name || 'You'}
                </span>
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#E50914] text-white font-medium shadow-[0_4px_15px_rgba(229,9,20,0.3)] rounded-br-none'
                    : 'netflix-card text-gray-200 rounded-bl-none border border-white/10'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* Live Transcript Streaming Bubble */}
          {liveTranscript && (
            <div className="flex gap-3 justify-end animate-pulse">
              <div className="max-w-[88%] space-y-1 items-end text-right">
                <span className="text-[10px] font-bold text-[#E50914] uppercase tracking-wider block flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-ping" />
                  Live Speaking...
                </span>
                <div className="p-3.5 rounded-2xl text-xs leading-relaxed bg-[#E50914]/20 border border-[#E50914]/40 text-white rounded-br-none shadow-lg">
                  {liveTranscript}
                </div>
              </div>
            </div>
          )}

          {/* Error Notices */}
          {voiceError && <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-500/20 p-3 rounded-xl">{voiceError}</p>}
          {responseError && <p className="text-xs text-red-400 bg-red-950/30 border border-red-500/20 p-3 rounded-xl">{responseError}</p>}

          <div ref={chatEndRef} />
        </div>

        {/* Integrated Controls Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0D0D12] space-y-3 shrink-0">
          
          {/* Voice Mic Button */}
          <button
            data-testid="voice-input-btn"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sending || ending || transcribing}
            className={`w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-lg ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse shadow-[0_0_20px_rgba(229,9,20,0.5)]'
                : transcribing
                ? 'bg-white/10 text-gray-400'
                : 'netflix-btn-red shadow-[0_0_20px_rgba(229,9,20,0.3)]'
            } disabled:opacity-40`}
          >
            {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isRecording ? 'Tap to Submit Answer' : transcribing ? 'Processing Speech...' : 'Tap Mic to Speak Answer'}</span>
          </button>

          {/* Text Input */}
          <div className="flex items-center gap-2 bg-[#050505] border border-white/15 rounded-2xl px-3 py-2.5 focus-within:border-[#E50914] transition-all">
            <input
              data-testid="interview-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Or type your message..."
              className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
              disabled={sending || ending}
            />
            <button
              data-testid="send-message-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || sending || ending}
              className="p-2 rounded-xl bg-[#E50914] text-white hover:bg-[#FF1E27] transition-all disabled:opacity-20 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wave { from { height: 6px; } to { height: 32px; } }
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.35); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 2.2s ease-out infinite; }
      `}</style>
    </div>
  );
}
