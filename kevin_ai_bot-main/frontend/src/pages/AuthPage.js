import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Lock, Mail, RefreshCw, User } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [googleState, setGoogleState] = useState({ loading: true, enabled: false, clientId: "" });
  const [form, setForm] = useState({ name: "", email: "", password: "", otp: "" });
  
  // OTP Verification State
  const [otpStep, setOtpStep] = useState(false); // false = enter details, true = enter OTP
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState("");

  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);

  const fallbackGoogleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
  const googleClientId = googleState.clientId || fallbackGoogleClientId;
  const googleEnabled = useMemo(
    () => Boolean((googleState.enabled && googleClientId) || fallbackGoogleClientId),
    [fallbackGoogleClientId, googleClientId, googleState.enabled],
  );

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

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
        theme: "outline",
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

  const handleSendOtp = async () => {
    if (!form.email || !form.email.includes("@")) {
      setError("Please enter a valid email address first.");
      return;
    }
    setError("");
    setSuccessMsg("");
    setOtpSending(true);

    try {
      const res = await api.post("/auth/send-otp", { email: form.email });
      setOtpStep(true);
      setResendTimer(60);
      setSuccessMsg(res.data.message || `Verification code sent to ${form.email}`);
      if (res.data.dev_otp) {
        setDevOtpHint(res.data.dev_otp);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send verification OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (mode === "register" && !otpStep) {
      await handleSendOtp();
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, otp: form.otp };

      const response = await api.post(endpoint, payload);
      login(response.data);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to continue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-12">
        <button onClick={() => navigate("/")} className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <div className="grid flex-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section>
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-gray-500 font-semibold">Kevin AI</p>
            <h1 className="mb-4 text-4xl font-light tracking-tight md:text-5xl" style={{ fontFamily: "Outfit" }}>
              Own your interview prep stack.
            </h1>
            <p className="max-w-xl text-base leading-7 text-gray-400">
              Verified account access, resume-aware interviews, and honest feedback designed to help you succeed with Kevin AI.
            </p>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#0B0B0B] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex rounded-full bg-white/5 p-1 text-sm">
              <button
                type="button"
                onClick={() => { setMode("login"); setOtpStep(false); setError(""); setSuccessMsg(""); }}
                className={`flex-1 rounded-full px-4 py-2 font-medium transition-all ${mode === "login" ? "bg-white text-black shadow-md" : "text-gray-400 hover:text-white"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}
                className={`flex-1 rounded-full px-4 py-2 font-medium transition-all ${mode === "register" ? "bg-white text-black shadow-md" : "text-gray-400 hover:text-white"}`}
              >
                Register
              </button>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === "register" && !otpStep && (
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-500">
                    <User className="h-3.5 w-3.5" />
                    Full name
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-white/30"
                    placeholder="Kevin Founder"
                    required={mode === "register"}
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-500">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  disabled={otpStep}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-white/30 disabled:opacity-50"
                  placeholder="you@example.com"
                  required
                />
              </label>

              {(!otpStep || mode === "login") && (
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-500">
                    <Lock className="h-3.5 w-3.5" />
                    Password
                  </span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-white/30"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </label>
              )}

              {mode === "register" && otpStep && (
                <div className="space-y-3 pt-2">
                  <label className="block">
                    <span className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-gray-400">
                      <span className="flex items-center gap-2 text-red-400">
                        <KeyRound className="h-3.5 w-3.5" />
                        6-Digit OTP Code
                      </span>
                      {resendTimer > 0 ? (
                        <span className="text-[11px] text-gray-500 capitalize">Resend in {resendTimer}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpSending}
                          className="text-[11px] text-red-400 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" /> Resend OTP
                        </button>
                      )}
                    </span>
                    <input
                      type="text"
                      maxLength={6}
                      value={form.otp}
                      onChange={(event) => setForm((current) => ({ ...current, otp: event.target.value.replace(/\D/g, "") }))}
                      className="w-full rounded-2xl border border-red-500/30 bg-black/40 px-4 py-3 text-center text-xl font-mono tracking-[0.4em] outline-none transition focus:border-red-500 shadow-[0_0_15px_rgba(229,9,20,0.1)]"
                      placeholder="000000"
                      required
                    />
                  </label>

                  {devOtpHint && (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-center text-xs text-blue-300">
                      Dev Code: <strong className="font-mono text-white">{devOtpHint}</strong> (Logged for local testing)
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setOtpStep(false)}
                    className="text-xs text-gray-500 hover:text-gray-300 underline block mx-auto pt-1"
                  >
                    Change Email or Details
                  </button>
                </div>
              )}

              {successMsg && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {error ? <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || otpSending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-gray-200 disabled:opacity-60 shadow-lg shadow-white/10"
              >
                {submitting || otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "login"
                  ? "Enter Kevin AI"
                  : otpStep
                  ? "Verify OTP & Create Account"
                  : "Send OTP Verification"}
              </button>
            </form>

            {googleEnabled && !otpStep ? (
              <>
                <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-gray-600">
                  <div className="h-px flex-1 bg-white/10" />
                  Or continue with
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="flex justify-center">
                  <div ref={googleButtonRef} className="min-h-[44px]" />
                </div>
              </>
            ) : null}

            {!googleEnabled && !googleState.loading && !otpStep ? (
              <p className="mt-6 text-center text-xs text-gray-500">
                Google sign-in will appear here once `GOOGLE_CLIENT_ID` is configured for Kevin AI.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
