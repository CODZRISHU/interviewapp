import React from "react";
import { appConfig, isBetaExperience } from "../config/appConfig";

export default function EnvironmentBanner() {
  if (!isBetaExperience) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] border-b border-amber-400/20 bg-amber-400/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs text-amber-100 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-300/20 px-2 py-0.5 font-semibold uppercase tracking-[0.2em]">
            Kevin {appConfig.appVersion.toUpperCase()}
          </span>
          <span>{appConfig.betaLabel}</span>
          {appConfig.betaInviteOnly ? (
            <span className="text-amber-100/80">Invite-only environment. Do not treat this as production.</span>
          ) : (
            <span className="text-amber-100/80">Beta environment. Features and data are isolated from v1 production.</span>
          )}
        </div>
        {appConfig.feedbackUrl ? (
          <a
            href={appConfig.feedbackUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-amber-50 underline decoration-amber-200/60 underline-offset-4"
          >
            Send beta feedback
          </a>
        ) : null}
      </div>
    </div>
  );
}
