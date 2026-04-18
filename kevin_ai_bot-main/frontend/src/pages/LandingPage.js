import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Mic, FileText, BarChart3, Sparkles } from 'lucide-react';
import { appConfig, isBetaExperience } from '../config/appConfig';

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
    <div className="min-h-screen bg-[#050505] overflow-hidden">
      <nav className="fixed top-0 w-full z-50 bg-[#050505]/60 backdrop-blur-xl border-b border-white/5" data-testid="landing-navbar">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Outfit' }}>Kevin</span>
          </div>
          <button
            data-testid="login-button"
            onClick={handleGetStarted}
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.08)]"
          >
            {user ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
      </nav>

      <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 px-6 md:px-12 lg:px-24">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-400 tracking-wide uppercase">
              {isBetaExperience ? `${appConfig.betaLabel} · AI-Powered Mock Interviews` : 'AI-Powered Mock Interviews'}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter leading-[1.1] mb-6" style={{ fontFamily: 'Outfit' }}>
            Practice interviews with<br />
            <span className="font-medium">Kevin, your AI interviewer</span>
          </h1>
          <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {isBetaExperience
              ? 'This Kevin beta runs on an isolated v2 stack. Upload your resume, test newer interview flows, and share feedback without affecting production users.'
              : 'Upload your resume, talk through real projects, get natural follow-up questions, and review honest reports that help you improve.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              data-testid="hero-get-started-btn"
              onClick={handleGetStarted}
              className="bg-white text-black px-8 py-3.5 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              Start Practicing <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#features" className="text-gray-400 hover:text-white px-6 py-3.5 text-sm font-medium transition-colors">
              Explore Features
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 md:py-32 px-6 md:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Everything you need to get interview-ready
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto">A focused practice environment built around your resume, answers, and improvement areas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: <FileText className="w-5 h-5" />, title: 'Resume Analysis', desc: 'Upload your PDF resume and get questions tailored to your projects, skills, and internships.' },
              { icon: <Mic className="w-5 h-5" />, title: 'Voice Support', desc: 'Answer naturally with voice or text for a realistic mock interview experience.' },
              { icon: <Sparkles className="w-5 h-5" />, title: 'Human-Like Interviewer', desc: 'Kevin asks project-specific follow-ups and adapts based on your actual responses.' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Honest Reports', desc: 'See where you were strong, what you missed, and what to improve before the next round.' },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(255,255,255,0.04)]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-base font-medium mb-2" style={{ fontFamily: 'Outfit' }}>{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight mb-6" style={{ fontFamily: 'Outfit' }}>
            Ready to face Kevin?
          </h2>
          <p className="text-gray-400 mb-8">Sign in, upload your resume, and start practicing with a more realistic AI interviewer.</p>
          <button
            data-testid="cta-get-started-btn"
            onClick={handleGetStarted}
            className="bg-white text-black px-8 py-3.5 rounded-full font-medium text-sm inline-flex items-center gap-2 hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            Open Kevin <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
              <span className="text-black font-bold text-[10px]" style={{ fontFamily: 'Outfit' }}>K</span>
            </div>
            <span className="text-xs text-gray-500">Kevin AI Interviewer</span>
          </div>
          <span className="text-xs text-gray-600">Practice interviews with better feedback</span>
        </div>
      </footer>
    </div>
  );
}
