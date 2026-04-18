const normalize = (value, fallback = "") => (value || fallback || "").toString().trim();

const toBoolean = (value, fallback = false) => {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
};

export const appConfig = {
  appEnv: normalize(process.env.REACT_APP_APP_ENV, "production").toLowerCase(),
  appVersion: normalize(process.env.REACT_APP_APP_VERSION, "v1").toLowerCase(),
  betaInviteOnly: toBoolean(process.env.REACT_APP_BETA_INVITE_ONLY, false),
  betaLabel: normalize(process.env.REACT_APP_BETA_LABEL, "Private Beta"),
  feedbackUrl: normalize(process.env.REACT_APP_BETA_FEEDBACK_URL, ""),
};

export const isBetaExperience =
  appConfig.appVersion !== "v1" || appConfig.appEnv === "beta" || appConfig.betaInviteOnly;
