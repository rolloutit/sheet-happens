import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
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
    if (error instanceof AuthenticationError) {
      return Response.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    if (error instanceof AuthorizationError) {
      return Response.json({ ok: false, error: "admin_access_required" }, { status: 403 });
    }

    throw error;
  }
}
