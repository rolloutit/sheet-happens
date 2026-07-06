"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { authClient } from "@/src/lib/auth-client";

export function AccountStatusActions() {
  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <Button type="button" variant="soft" icon={LogOut} onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
