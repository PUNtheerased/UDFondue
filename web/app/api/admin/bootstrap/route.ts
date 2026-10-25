import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { callGas } from "@/lib/gas";

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gasToken = session.startsWith("gas:") ? session.slice(4) : "";
    const result = await callGas({
      action: "adminBootstrap",
      adminToken: gasToken || "session",
      password: body.password || "",
      filterStatus: body.filterStatus || "",
      search: body.search || "",
      includeSecrets: true
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin bootstrap failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
