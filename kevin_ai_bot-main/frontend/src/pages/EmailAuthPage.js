import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Mail, User, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function EmailAuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleResendVerification = async () => {
    if (!form.email) {
      alert("Please enter your Gmail address in the email field.");
      return;
    }
    setResending(true);
    try {
      const res = await api.post("/auth/resend-verification", { email: form.email });
      alert(res.data?.message || "Verification link sent! Check your Gmail inbox.");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to resend verification link.");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('referralCode');
    if (ref) {
      localStorage.setItem('kevin_referral_code', ref.trim().toUpperCase());
    }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    if (mode === "register" && !form.email.trim().toLowerCase().endsWith("@gmail.com")) {
      setError("Registration is currently restricted to valid @gmail.com email addresses. Please enter a valid Gmail address to receive your verification link.");
      setSubmitting(false);
      return;
    }

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const refCode = localStorage.getItem('kevin_referral_code') || undefined;
      const payload = mode === "login" 
        ? { email: form.email, password: form.password } 
        : { ...form, referral_code: refCode };
      const response = await api.post(endpoint, payload);
      if (mode === "register" && refCode) localStorage.removeItem('kevin_referral_code');

      if (response.data?.requiresVerification) {
        setSuccessMsg(response.data.message || "Registration successful! A verification link has been sent to your Gmail inbox. Please click the link to activate your account.");
        setMode("login");
        return;
      }

      login(response.data);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        setError(detail[0].msg);
      } else {
        setError("Unable to continue. Please check your credentials and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative flex flex-col justify-between overflow-x-hidden selection:bg-[#E50914] selection:text-white" data-testid="email-auth-page">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[#E50914]/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-[#E50914]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
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
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8 justify-center">
        <div className="netflix-card rounded-3xl p-8 border border-white/10 shadow-[0_0_50px_rgba(229,9,20,0.2)]">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Email Sign-In Channel</span>
          </div>

          <div className="flex rounded-2xl bg-white/5 p-1 border border-white/10 mb-6">
            <button
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${mode === "login" ? "bg-[#E50914] text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${mode === "register" ? "bg-[#E50914] text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
            >
              Create Account
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-white" style={{ fontFamily: "Outfit" }}>
              {mode === "login" ? "Sign In with Email" : "Create Account with Email"}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {mode === "login"
                ? "Enter your registered Gmail address and password to log in."
                : "Register using a valid @gmail.com email address to receive your activation link."}
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
                Gmail Address
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-white/15 bg-[#0F0F12] px-4 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                placeholder="you@gmail.com"
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

            {successMsg && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-300 leading-relaxed">
                {successMsg}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300 leading-relaxed space-y-2">
                <p>{error}</p>
                {error.includes("not been verified") && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-xs font-bold text-[#E50914] underline hover:text-red-400 block mt-1"
                  >
                    {resending ? "Sending verification link..." : "Resend Verification Link to Gmail"}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="netflix-btn-red flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-[0_0_25px_rgba(229,9,20,0.4)] disabled:opacity-60 mt-2"
              style={{ fontFamily: "Outfit" }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "login" ? "Sign In with Email" : "Create Account & Send Verification"}
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-20 px-6 md:px-12 py-6 border-t border-white/10 bg-[#050505] text-center text-xs text-gray-500">
        <p>© 2026 Kevin AI Platform. Secure candidate authentication & mock interview studio.</p>
      </footer>
    </div>
  );
}
