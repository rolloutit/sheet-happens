import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { authErrorStatus } from "@/src/server/auth/route-errors";
import { runSystemChecks } from "@/src/server/system";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminAppMemberForAction();
    const summary = await runSystemChecks();

    return Response.json(summary, {
      status: summary.status === "fail" ? 503 : 200,
    });
  } catch (error) {
    const authStatus = authErrorStatus(error);

    if (authStatus === 401) {
      return Response.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    if (authStatus === 403) {
      return Response.json({ ok: false, error: "admin_access_required" }, { status: 403 });
    }

    throw error;
  }
}
