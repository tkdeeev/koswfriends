export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("missing_configuration");
  if (process.env.NODE_ENV === "production" && !value.startsWith("https://"))
    throw new Error("https_required");
  return value;
}
export function config() {
  function required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error("missing_configuration");
    return value;
  }
  const url = appUrl();
  return {
    appUrl: url,
    clientId: required("SCHOOL_OAUTH_CLIENT_ID"),
    clientSecret: required("SCHOOL_OAUTH_CLIENT_SECRET"),
    redirectUri: process.env.SCHOOL_OAUTH_REDIRECT_URI || `${url}/callback`,
    scope: "cvut:sirius:personal:read",
    authorizeUrl:
      process.env.SCHOOL_OAUTH_AUTHORIZE_URL ||
      "https://auth.fit.cvut.cz/oauth/authorize",
    tokenUrl:
      process.env.SCHOOL_OAUTH_TOKEN_URL ||
      "https://auth.fit.cvut.cz/oauth/token",
    checkUrl:
      process.env.SCHOOL_OAUTH_CHECK_TOKEN_URL ||
      "https://auth.fit.cvut.cz/oauth/check_token",
    siriusUrl:
      process.env.SIRIUS_API_BASE_URL || "https://sirius.fit.cvut.cz/api/v1",
  };
}
