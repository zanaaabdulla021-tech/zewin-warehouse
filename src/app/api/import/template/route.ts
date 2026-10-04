import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { buildTemplate } from "@/lib/opening-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!can(user.permissions, "stock", "edit")) return new NextResponse("Forbidden", { status: 403 });
  const buf = await buildTemplate();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="zewin-opening-balance-template.xlsx"',
    },
  });
}
