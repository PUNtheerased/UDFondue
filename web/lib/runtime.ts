/** True when running the production Next.js build (Vercel production / `next start`). */
export function isProdRuntime() {
  return process.env.NODE_ENV === "production";
}
