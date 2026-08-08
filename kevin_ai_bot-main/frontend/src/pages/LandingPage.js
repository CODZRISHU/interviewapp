import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Mic, FileText, BarChart3, Sparkles, Shield, Play } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-[#E50914] selection:text-white">
      {/* Netflix Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-[#050505]/75 backdrop-blur-2xl border-b border-white/10" data-testid="landing-navbar">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-gradient-to-tr from-[#B20710] via-[#E50914] to-[#FF1E27] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.5)]">
              <span className="text-white font-extrabold text-lg" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
              Kevin <span className="text-[#E50914]">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              data-testid="login-button"
              onClick={handleGetStarted}
              className="netflix-btn-red px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2"
            >
              {user ? 'Go to Dashboard' : 'Sign In'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-36 pb-24 md:pt-48 md:pb-36 px-6 md:px-12 lg:px-24">
        {/* Netflix Red Glow Background Effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#E50914]/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#E50914]/10 border border-[#E50914]/30 rounded-full px-4 py-1.5 mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(229,9,20,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="text-xs font-semibold text-gray-200 tracking-wider uppercase">Next-Gen AI Mock Interview Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-8" style={{ fontFamily: 'Outfit' }}>
            Ace your real interviews with <br />
            <span className="netflix-red-gradient-text">Kevin, AI Voice Interviewer</span>
          </h1>

          <p className="text-base md:text-xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
            Upload your resume, speak through project experiences, face adaptive follow-up questions, and receive instant, actionable feedback scorecards.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <button
              data-testid="hero-get-started-btn"
              onClick={handleGetStarted}
              className="netflix-btn-red px-9 py-4 rounded-full font-semibold text-base flex items-center gap-3 shadow-[0_0_30px_rgba(229,9,20,0.4)]"
            >
              <Play className="w-5 h-5 fill-white" /> Start Free Practice <ArrowRight className="w-5 h-5" />
            </button>
            <a href="#features" className="text-gray-400 hover:text-white px-7 py-4 rounded-full text-base font-medium transition-colors border border-white/10 hover:border-white/20 bg-white/5">
              Explore Capabilities
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-gradient-to-b from-[#050505] via-[#0A0A0E] to-[#050505]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Built to make you <span className="text-[#E50914]">Interview-Ready</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
              Real-time voice synthesis, resume analysis, and tailored question generation designed for candidate success.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <FileText className="w-6 h-6 text-[#E50914]" />, title: 'Resume Analysis', desc: 'Parses PDF resumes to generate deep technical and project-focused questions.' },
              { icon: <Mic className="w-6 h-6 text-[#E50914]" />, title: 'Real-Time Voice Stage', desc: 'Speak naturally using browser speech recognition with dynamic audio waveforms.' },
              { icon: <Sparkles className="w-6 h-6 text-[#E50914]" />, title: 'Adaptive AI Persona', desc: 'Kevin listens actively, follows up on gaps, and tests actual problem-solving.' },
              { icon: <BarChart3 className="w-6 h-6 text-[#E50914]" />, title: 'Granular Reports', desc: 'Detailed score breakdown on technical depth, communication, and key metrics.' },
            ].map((feature, index) => (
              <div key={index} className="netflix-card rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-white" style={{ fontFamily: 'Outfit' }}>{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-24 relative">
        <div className="max-w-4xl mx-auto text-center netflix-card p-12 md:p-16 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914]/15 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6" style={{ fontFamily: 'Outfit' }}>
            Ready to test your skills with Kevin?
          </h2>
          <p className="text-gray-300 text-base md:text-lg mb-10 max-w-2xl mx-auto">
            Experience realistic mock interviews, polish your answers, and gain confidence before your next big opportunity.
          </p>
          <button
            data-testid="cta-get-started-btn"
            onClick={handleGetStarted}
            className="netflix-btn-red px-10 py-4 rounded-full font-bold text-base inline-flex items-center gap-3 shadow-[0_0_30px_rgba(229,9,20,0.5)]"
          >
            Launch Kevin AI <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-6 md:px-12 bg-[#050505]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#E50914] rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
            <span className="text-sm text-gray-400 font-medium">Kevin AI Interviewer</span>
          </div>
          <span className="text-xs text-gray-500">© 2026 Kevin AI Platform. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
