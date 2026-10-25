import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getNimdaMode } from "@/lib/adminSession";
import { callGas } from "@/lib/gas";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { getActiveHandoff, getHistory, handoffToPublic, listAdminTickets, rowToPublic } from "@/lib/ticketsDb";

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อน" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = getNimdaMode();

    if (isTicketsDbReady()) {
      const rows = await listAdminTickets({
        filterStatus: body.filterStatus || "",
        search: body.search || ""
      });
      const reports = [];
      for (const row of rows) {
        const pub = rowToPublic(row, { includeSecrets: true });
        pub.statusHistory = await getHistory(row.submit_id);
        const handoff = await getActiveHandoff(row.submit_id);
        if (handoff) pub.handoff = handoffToPublic(handoff);
        reports.push(pub);
      }
      return NextResponse.json({
        status: "success",
        reports,
        mode,
        backend: "supabase"
      });
    }

    const gasToken = session.startsWith("gas:") ? session.slice(4) : "";
    const result = await callGas({
      action: "adminBootstrap",
      adminToken: gasToken || "session",
      password: body.password || "",
      filterStatus: body.filterStatus || "",
      search: body.search || "",
      includeSecrets: true
    });
    return NextResponse.json({ ...result, mode, backend: "gas" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin bootstrap failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
