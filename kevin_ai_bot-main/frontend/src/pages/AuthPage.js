import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Mail, User } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { appConfig, isBetaExperience } from "../config/appConfig";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [googleState, setGoogleState] = useState({
    loading: true,
    enabled: false,
    clientId: "",
    appEnv: appConfig.appEnv,
    appVersion: appConfig.appVersion,
    betaInviteOnly: appConfig.betaInviteOnly,
  });
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
          appEnv: response.data.app_env || appConfig.appEnv,
          appVersion: response.data.app_version || appConfig.appVersion,
          betaInviteOnly: Boolean(response.data.beta_invite_only),
        });
      } catch {
        if (!mounted) return;
        setGoogleState({
          loading: false,
          enabled: Boolean(fallbackGoogleClientId),
          clientId: fallbackGoogleClientId,
          appEnv: appConfig.appEnv,
          appVersion: appConfig.appVersion,
          betaInviteOnly: appConfig.betaInviteOnly,
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
      setError(requestError.response?.data?.detail || "Unable to continue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-12">
        <button onClick={() => navigate("/")} className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <div className="grid flex-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section>
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-gray-500">Kevin AI</p>
            <h1 className="mb-4 text-4xl font-light tracking-tight md:text-5xl" style={{ fontFamily: "Outfit" }}>
              {isBetaExperience ? `Explore Kevin ${googleState.appVersion?.toUpperCase?.() || "V2"} safely.` : "Own your interview prep stack."}
            </h1>
            <p className="max-w-xl text-base leading-7 text-gray-400">
              {googleState.betaInviteOnly
                ? "This beta environment is invite-only and runs separately from the current production launch. Sign in with an approved email to test Kevin v2."
                : "Secure sign-in, resume-aware interviews, and honest feedback designed to help you improve with Kevin AI."}
            </p>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#0B0B0B] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex rounded-full bg-white/5 p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-full px-4 py-2 ${mode === "login" ? "bg-white text-black" : "text-gray-400"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 rounded-full px-4 py-2 ${mode === "register" ? "bg-white text-black" : "text-gray-400"}`}
              >
                Register
              </button>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === "register" && (
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
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-white/30"
                  placeholder="you@example.com"
                  required
                />
              </label>

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

              {error ? <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}
              {googleState.betaInviteOnly ? (
                <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Kevin beta only allows invited email addresses. If your access is missing, ask the team managing the beta cohort.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-gray-200 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "login" ? "Enter Kevin AI" : "Create account"}
              </button>
            </form>

            {googleEnabled ? (
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

            {!googleEnabled && !googleState.loading ? (
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
