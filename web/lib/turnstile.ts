export async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Allow local/dev without Turnstile if secret missing but token is "dev-bypass"
    if (process.env.NODE_ENV !== "production" && token === "dev-bypass") {
      return { ok: true as const };
    }
    if (!secret) {
      return { ok: false as const, message: "Turnstile is not configured" };
    }
  }

  if (!token) {
    return { ok: false as const, message: "Missing Turnstile token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret!);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  if (!data.success) {
    return {
      ok: false as const,
      message: "Turnstile verification failed",
      codes: data["error-codes"] || []
    };
  }
  return { ok: true as const };
}
