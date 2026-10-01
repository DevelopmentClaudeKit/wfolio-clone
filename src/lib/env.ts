/** Public base URL of the app; falls back to the domain Railway assigns. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return "http://localhost:3000";
}

/** Secret for signing gallery-access cookies and local storage URLs. */
export function appSecret() {
  const secret = process.env.APP_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set in production");
  return "dev-secret";
}
