import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, ShieldCheck } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [googleState, setGoogleState] = useState({ loading: true, enabled: false, clientId: "" });
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

  return (
    <div className="min-h-screen bg-[#050505] text-white relative flex flex-col justify-between overflow-x-hidden selection:bg-[#E50914] selection:text-white" data-testid="oauth-auth-page">
      {/* Background Ambient Glow */}
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
        <div className="netflix-card rounded-3xl p-8 md:p-10 border border-white/10 shadow-[0_0_50px_rgba(229,9,20,0.25)] text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 backdrop-blur-md mx-auto">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Instant Google Candidate Access</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white" style={{ fontFamily: "Outfit" }}>
              Sign In to <span className="text-[#E50914]">Kevin AI</span>
            </h1>
            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
              Authenticate instantly with your Google Account to access 1 Free 10-Minute AI Mock Interview Session.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
              {error}
            </div>
          )}

          {submitting ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-300">
              <Loader2 className="w-5 h-5 text-[#E50914] animate-spin" />
              Authenticating with Google...
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center justify-center space-y-4">
              <div ref={googleButtonRef} className="min-h-[44px]" />

              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Google Single Sign-On (No Password Needed)</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 px-6 md:px-12 py-6 border-t border-white/10 bg-[#050505] text-center text-xs text-gray-500">
        <p>© 2026 Kevin AI Platform. Secure Google Single Sign-On & Mock Interview Studio.</p>
      </footer>
    </div>
  );
}
