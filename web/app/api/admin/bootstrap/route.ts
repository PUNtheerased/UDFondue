import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getNimdaMode } from "@/lib/adminSession";
import { callGas } from "@/lib/gas";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { publicMessage } from "@/lib/publicMessage";
import { getActiveHandoffsBySubmitIds, getHistoriesBySubmitIds, handoffToPublic, listAdminTickets, rowToPublic } from "@/lib/ticketsDb";

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
      const ids = rows.map((row) => row.submit_id);
      const [histories, handoffs] = await Promise.all([
        getHistoriesBySubmitIds(ids),
        getActiveHandoffsBySubmitIds(ids)
      ]);
      const reports = rows.map((row) => {
        const pub = rowToPublic(row, { includeSecrets: true });
        pub.statusHistory = histories.get(row.submit_id) || [];
        const handoff = handoffs.get(row.submit_id);
        if (handoff) pub.handoff = handoffToPublic(handoff);
        return pub;
      });
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
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "โหลดรายการไม่สำเร็จ") },
      { status: 500 }
    );
  }
}
