import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { callGas } from "@/lib/gas";

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const gasToken = session.startsWith("gas:") ? session.slice(4) : "session";
    const result = await callGas({
      action: body.action || "adminUpdate",
      adminToken: gasToken,
      submitId: body.submitId,
      status: body.status,
      adminNote: body.adminNote,
      afterImageUrls: body.afterImageUrls || [],
      mergeIntoId: body.mergeIntoId,
      mergeFromIds: body.mergeFromIds || [],
      password: body.password
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin update failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
