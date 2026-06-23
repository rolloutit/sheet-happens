import { Clock3, FileCheck2, ShieldCheck } from "lucide-react";

import { AppShell } from "@/src/components/layout/AppShell";
import { EmptyState } from "@/src/components/sheet/EmptyState";
import { StatusPill } from "@/src/components/sheet/StatusPill";
import { Button } from "@/src/components/ui/Button";

const cards = [
  {
    title: "Typed primitives",
    body: "Button, field, status, overlay, and feedback components start from explicit variant APIs.",
    icon: ShieldCheck,
  },
  {
    title: "Storybook first",
    body: "Reusable components get stories for variants, state, theme, locale, and interaction coverage.",
    icon: FileCheck2,
  },
  {
    title: "RSC by default",
    body: "Pages and data composition stay server-side; client components are reserved for real interaction.",
    icon: Clock3,
  },
];

export default function Home() {
  return (
    <AppShell>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 rounded-[var(--radius-xl)] border border-border bg-card/80 p-7 shadow-soft sm:p-9">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status="approved" />
            <StatusPill status="invoice_rejected" />
            <StatusPill status="paid" />
          </div>
          <div className="max-w-3xl">
            <p className="font-ui text-sm font-medium uppercase tracking-[0.18em] text-accent">
              Sheet Happens component library
            </p>
            <h1 className="mt-3 text-4xl font-bold text-foreground sm:text-5xl">
              Frontend foundation
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              The app now has the planned Next.js, Tailwind, Storybook, testing, and typed
              component-library baseline, plus the first broad slice of primitives and
              product-specific blocks from `components.md`.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>Primary action</Button>
            <Button variant="cta">Warm CTA</Button>
            <Button variant="ghost">Secondary</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-5"
            >
              <card.icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.body}</p>
            </article>
          ))}
        </div>

        <EmptyState
          icon={FileCheck2}
          tone="warm"
          title="Design inventory connected"
          body="Use this foundation to implement the component families documented from the Claude design export."
          action={<Button variant="soft">Open Storybook</Button>}
        />
      </section>
    </AppShell>
  );
}
