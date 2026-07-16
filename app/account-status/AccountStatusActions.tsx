"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { authClient } from "@/src/lib/auth-client";

export function AccountStatusActions() {
  const t = useTranslations("AccountStatus");

  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <Button type="button" variant="soft" icon={LogOut} onClick={() => void signOut()}>
      {t("actions.signOut")}
    </Button>
  );
}
