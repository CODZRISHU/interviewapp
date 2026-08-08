import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Mail, User, ShieldCheck, Sparkles } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [googleState, setGoogleState] = useState({ loading: true, enabled: false, clientId: "" });
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);

  const fallbackGoogleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
  const googleClientId = googleState.clientId || fallbackGoogleClientId;
  const googleEnabled = useMemo(
    () => Boolean((googleState.enabled && googleClientId) || fallbackGoogleClientId),
    [fallbackGoogleClientId, googleClientId, googleState.enabled],
  );

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const response = await api.get("/auth/config");
        if (!mounted) return;
        setGoogleState({
          loading: false,
          enabled: Boolean(response.data.google_enabled),
          clientId: response.data.google_client_id || "",
        });
      } catch {
        if (!mounted) return;
        setGoogleState({
          loading: false,
          enabled: Boolean(fallbackGoogleClientId),
          clientId: fallbackGoogleClientId,
        });
      }
    };

    loadConfig();
    return () => {
      mounted = false;
    };
  }, [fallbackGoogleClientId]);

  useEffect(() => {
    if (!googleEnabled || !googleClientId || !googleButtonRef.current) return undefined;

    let cancelled = false;
    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current || googleInitializedRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          setSubmitting(true);
          setError("");
          try {
            const authResponse = await api.post("/auth/google", { id_token: response.credential });
            login(authResponse.data);
            navigate("/dashboard", { replace: true });
          } catch (requestError) {
            setError(requestError.response?.data?.detail || "Google sign-in could not be completed.");
          } finally {
            setSubmitting(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        width: 360,
        text: "continue_with",
      });
      googleInitializedRef.current = true;
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [googleClientId, googleEnabled, login, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const response = await api.post(endpoint, payload);
      login(response.data);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to continue. Please check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative flex flex-col justify-between overflow-x-hidden selection:bg-[#E50914] selection:text-white">
      {/* Netflix Ambient Red Glow Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[#E50914]/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-[#E50914]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 px-6 md:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 bg-gradient-to-tr from-[#B20710] via-[#E50914] to-[#FF1E27] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.5)]">
            <span className="text-white font-extrabold text-lg" style={{ fontFamily: "Outfit" }}>K</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: "Outfit" }}>
            Kevin <span className="text-[#E50914]">AI</span>
          </span>
        </div>

        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 md:px-12 justify-center">
        <div className="grid flex-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left Hero Column */}
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">AI Mock Interview Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]" style={{ fontFamily: "Outfit" }}>
              Practice mock interviews like a <span className="netflix-red-gradient-text">Pro Candidate</span>.
            </h1>

            <p className="max-w-xl text-base md:text-lg leading-relaxed text-gray-300 font-light">
              Access real-time voice interviews, custom resume parser tools, and instant evaluation reports designed to land your dream offer.
            </p>

            <div className="pt-4 flex items-center gap-6 text-xs font-semibold text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#E50914]" />
                <span>Encrypted Credentials</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#E50914]" />
                <span>Instant Scorecards</span>
              </div>
            </div>
          </section>

          {/* Right Auth Card */}
          <section className="netflix-glass rounded-3xl p-8 md:p-10 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#E50914]/10 rounded-full blur-2xl pointer-events-none" />

            {/* Mode Switch Pills */}
            <div className="mb-8 flex rounded-2xl bg-black/40 p-1.5 border border-white/10 text-sm">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className={`flex-1 rounded-xl py-2.5 font-bold transition-all ${
                  mode === "login"
                    ? "bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
                style={{ fontFamily: "Outfit" }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); }}
                className={`flex-1 rounded-xl py-2.5 font-bold transition-all ${
                  mode === "register"
                    ? "bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
                style={{ fontFamily: "Outfit" }}
              >
                Create Account
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-white" style={{ fontFamily: "Outfit" }}>
                {mode === "login" ? "Sign In to Kevin AI" : "Start your Free Trial"}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {mode === "login"
                  ? "Enter your email and password to resume mock practice."
                  : "Register today and get 1 Free 10-minute AI interview session."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === "register" && (
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <User className="h-3.5 w-3.5 text-[#E50914]" />
                    Full Name
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-white/15 bg-[#0F0F12] px-4 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    placeholder="John Candidate"
                    required={mode === "register"}
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <Mail className="h-3.5 w-3.5 text-[#E50914]" />
                  Email Address
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-white/15 bg-[#0F0F12] px-4 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <Lock className="h-3.5 w-3.5 text-[#E50914]" />
                  Password
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/15 bg-[#0F0F12] px-4 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required
                />
              </label>

              {error ? (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300 leading-relaxed">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="netflix-btn-red flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-[0_0_25px_rgba(229,9,20,0.4)] disabled:opacity-60 mt-2"
                style={{ fontFamily: "Outfit" }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "login" ? "Sign In to Studio" : "Create Account & Start"}
              </button>
            </form>

            {googleEnabled ? (
              <>
                <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <div className="h-px flex-1 bg-white/10" />
                  Or continue with
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="flex justify-center">
                  <div ref={googleButtonRef} className="min-h-[44px]" />
                </div>
              </>
            ) : null}

            <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-gray-400">
              {mode === "login" ? (
                <p>
                  New to Kevin AI?{" "}
                  <button onClick={() => { setMode("register"); setError(""); }} className="font-bold text-[#E50914] hover:underline">
                    Create an account now.
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button onClick={() => { setMode("login"); setError(""); }} className="font-bold text-[#E50914] hover:underline">
                    Sign in now.
                  </button>
                </p>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 px-6 md:px-12 py-6 border-t border-white/10 bg-[#050505] text-center text-xs text-gray-500">
        <p>© 2026 Kevin AI Platform. Secure candidate authentication & mock interview studio.</p>
      </footer>
    </div>
  );
}
