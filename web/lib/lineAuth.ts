export async function verifyLineIdToken(idToken: string) {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!idToken) {
    return { ok: false as const, message: "Missing LIFF ID token" };
  }

  // Dev bypass when channel not configured
  if (!channelId) {
    if (process.env.NODE_ENV !== "production" && idToken.startsWith("dev:")) {
      return {
        ok: true as const,
        sub: idToken.slice(4),
        name: "Dev User"
      };
    }
    return { ok: false as const, message: "LINE_CHANNEL_ID is not configured" };
  }

  const body = new URLSearchParams();
  body.set("id_token", idToken);
  body.set("client_id", channelId);

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false as const, message: "Invalid LIFF ID token", detail: errText };
  }

  const data = (await res.json()) as { sub?: string; name?: string; exp?: number };
  if (!data.sub) {
    return { ok: false as const, message: "ID token missing sub" };
  }

  return {
    ok: true as const,
    sub: data.sub,
    name: data.name || ""
  };
}
