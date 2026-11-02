const LEAK =
  /supabase|postgres|duplicate key|jwt|stack|econn|fetch|violates|pgrst|column |relation |password authentication|service_role|bearer |node_modules|syntaxerror|typeerror|secret|api[_ ]?key/i;

/** Thai business errors may reach the client. Internal/driver errors stay in the log. */
export function publicMessage(err: unknown, fallback: string) {
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (isSafePublic(msg)) return msg;
  }
  console.error(err);
  return fallback;
}

export function isSafePublic(msg: string) {
  if (!msg || msg.length > 180) return false;
  if (!/[\u0E00-\u0E7F]/.test(msg)) return false;
  if (LEAK.test(msg)) return false;
  return true;
}
