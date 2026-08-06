"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { localeCookieName } from "@/src/i18n/locales";
import { cn } from "@/src/lib/utils";
import { BrandMark } from "../BrandMark";
import { LanguageToggle } from "../LanguageToggle";
import { ThemeToggle } from "../ThemeToggle";
import type { AuthShellMood, AuthShellProps } from "./AuthShell.types";

const orbitDots = Array.from({ length: 46 }, (_, index) => {
  const angle = (index / 46) * Math.PI * 2;
  return {
    x: (280 + 188 * Math.cos(angle)).toFixed(3),
    y: (280 + 122 * Math.sin(angle)).toFixed(3),
  };
});

const moodTranslationKeys: Record<AuthShellMood, { title: string; subtitle: string }> = {
  back: {
    title: "moods.back.title",
    subtitle: "moods.back.subtitle",
  },
  aboard: {
    title: "moods.aboard.title",
    subtitle: "moods.aboard.subtitle",
  },
  fresh: {
    title: "moods.fresh.title",
    subtitle: "moods.fresh.subtitle",
  },
  secure: {
    title: "moods.secure.title",
    subtitle: "moods.secure.subtitle",
  },
};

export function AuthShell({
  children,
  className,
  contentClassName,
  mood = "back",
  ...props
}: AuthShellProps) {
  const t = useTranslations("AuthShell");
  const router = useRouter();
  const locale = useLocale();
  const [, startLanguageTransition] = useTransition();
  const moodCopy = moodTranslationKeys[mood];

  function handleLanguageChange(nextLanguage: string) {
    startLanguageTransition(() => {
      document.cookie = `${localeCookieName}=${nextLanguage}; Max-Age=31536000; Path=/; SameSite=Lax`;
      router.refresh();
    });
  }

  return (
    <main
      className={cn(
        "flex min-h-dvh w-full flex-col bg-background text-foreground lg:flex-row",
        className,
      )}
      {...props}
    >
      <aside className="relative flex min-h-[13rem] shrink-0 overflow-hidden bg-[radial-gradient(120%_90%_at_18%_8%,#2c7c7c_0%,#0c423f_55%,#08302d_100%)] p-6 text-[#eafbfa] dark:bg-[radial-gradient(120%_90%_at_18%_8%,#1f7475_0%,#0c423f_52%,#07302e_100%)] lg:min-h-dvh lg:basis-[46%] lg:max-w-[620px] lg:p-12">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(40% 30% at 80% 75%, rgba(41,198,198,0.22), transparent 70%), radial-gradient(30% 24% at 95% 20%, rgba(255,203,151,0.12), transparent 70%)",
          }}
        />
        <svg
          className="auth-shell-orbit absolute right-[-5.5rem] top-1/2 size-[20rem] -translate-y-1/2 lg:right-[-7.5rem] lg:size-[35rem]"
          viewBox="0 0 560 560"
          fill="none"
          aria-hidden="true"
        >
          <g className="auth-shell-orbit-ring origin-center">
            {orbitDots.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r="1.7" fill="rgba(234,251,250,0.35)" />
            ))}
            <circle
              cx="280"
              cy="280"
              r="200"
              stroke="rgba(234,251,250,0.20)"
              strokeDasharray="2 9"
              strokeWidth="1.4"
            />
            <circle
              cx="280"
              cy="280"
              r="140"
              stroke="rgba(253,207,174,0.30)"
              strokeDasharray="5 8"
              strokeWidth="1.2"
            />
            <circle cx="421" cy="139" r="9" fill="#29c6c6" />
            <circle cx="421" cy="139" r="17" fill="#29c6c6" opacity="0.18" />
          </g>
        </svg>

        <div className="relative z-10 flex w-full flex-col justify-between gap-8">
          <div className="flex items-center gap-3">
            {/* The frosted tile stays: it lifts the mark off the gradient and the orbit dots. The
                panel is teal in both themes, so the mark cannot follow the palette here. */}
            <span className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-white/20 bg-white/12">
              <BrandMark size={24} tone="onDark" />
            </span>
            <div className="leading-tight">
              <p className="font-ui text-[17px] font-semibold text-[#eafbfa]">Sheet Happens</p>
              <p className="font-ui text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#eafbfa]/60">
                {t("brandSubtitle")}
              </p>
            </div>
          </div>

          <div className="max-w-[22.5rem]">
            <h1 className="font-ui text-3xl font-medium leading-[1.05] text-white lg:text-[46px]">
              {t(moodCopy.title)}
            </h1>
            <p className="mt-3 text-base leading-7 text-[#eafbfa]/80 lg:mt-4 lg:text-lg">
              {t(moodCopy.subtitle)}
            </p>
            <div className="auth-shell-float mt-6 hidden items-center gap-2.5 rounded-[14px] border border-[#84f4f4]/30 bg-[#3affff]/10 px-4 py-3 text-[13.5px] text-[#dff9f8] shadow-[0_10px_30px_-12px_rgb(0_0_0_/_0.5)] backdrop-blur lg:inline-flex">
              <Sparkles className="size-4 text-[#84f4f4]" aria-hidden="true" />
              {t("panelTip")}
            </div>
          </div>

          <p className="hidden max-w-[21rem] text-[13px] leading-6 text-[#eafbfa]/55 lg:block">
            {t("panelFooter")}
          </p>
        </div>
      </aside>

      {/* auth.css:56 — the same two canvas stops as the app shell, just a tighter ellipse. Both
          themes now come from the tokens, so this needs no `dark:` override. */}
      <section className="relative flex flex-1 items-start justify-center overflow-hidden bg-[radial-gradient(900px_520px_at_80%_-10%,var(--canvas-glow-teal),var(--canvas-base)_60%)] px-5 pb-24 pt-24 sm:px-6 lg:items-center lg:px-6 lg:py-10">
        <div className="absolute right-5 top-5 z-10 flex items-center gap-2 sm:right-6">
          <LanguageToggle
            value={locale}
            label={t("language")}
            size="sm"
            className="border-border/70 bg-secondary/75 shadow-[0_18px_44px_-28px_rgb(55_227_222_/_0.8)]"
            onValueChange={handleLanguageChange}
          />
          <ThemeToggle className="size-9 rounded-[var(--radius-md)] border-border/70 bg-secondary/75 text-muted-foreground shadow-[0_18px_44px_-28px_rgb(55_227_222_/_0.8)] hover:text-foreground" />
        </div>
        <div className={cn("w-full max-w-[408px]", contentClassName)}>{children}</div>
      </section>
    </main>
  );
}
