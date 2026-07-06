import type { Route } from "next";
import { redirect } from "next/navigation";

import {
  accountStatusRoute,
  getAppAccessState,
  loginRoute,
  securitySetupRoute,
  secondFactorRoute,
} from "@/src/server/auth/app-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const callbackURL = "/dashboard";
  const access = await getAppAccessState();

  if (access.status === "anonymous") {
    redirect(loginRoute(callbackURL));
  }

  if (access.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (access.status === "security_setup_required") {
    redirect(securitySetupRoute(callbackURL));
  }

  if (access.status === "active") {
    redirect(callbackURL as Route);
  }

  redirect(accountStatusRoute(callbackURL));
}
