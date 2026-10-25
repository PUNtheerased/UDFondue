/** True when running the production Next.js build (Vercel production / `next start`). */
export function isProdRuntime() {
  return process.env.NODE_ENV === "production";
}

/** Browser on localhost — skip LIFF so login ไม่พาไป endpoint บน Vercel */
export function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** โหมดทดสอบบนเครื่อง — ไม่บังคับ LINE จริง */
export function allowLocalLineBypass() {
  return !isProdRuntime() || isBrowserLocalhost();
}
