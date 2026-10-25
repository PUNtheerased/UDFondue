/** Push LINE จาก Next โดยใช้ LINE_CHANNEL_ACCESS_TOKEN ใน env (Vercel / .env) */

/** ถ้าข้อความมี \\uXXXX แบบตัวอักษร (ไม่ใช่ JSON) แปลงกลับเป็นอักขระจริง */
function decodeLiteralUnicodeEscapes(input: string) {
  return String(input || "").replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

export async function pushLineText(to: string, text: string) {
  const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
  if (!token) {
    return { ok: false as const, reason: "missing_token" };
  }
  if (!to || to === "ไม่ระบุ ID" || String(to).includes("TEST")) {
    return { ok: false as const, reason: "skip_test_user" };
  }

  const safeText = decodeLiteralUnicodeEscapes(text);

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: safeText }]
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false as const, reason: "http_error", status: res.status, detail };
  }
  return { ok: true as const };
}

export function buildTrackUrl(submitId: string, trackToken?: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (!submitId) return `${base}/track`;
  if (trackToken) {
    return `${base}/track/${encodeURIComponent(submitId)}?t=${encodeURIComponent(trackToken)}`;
  }
  return `${base}/track/${encodeURIComponent(submitId)}`;
}
