import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LayoutGrid, List, Play, Plus } from "lucide-react";
import { LazyMotion, domMax } from "motion/react";
import { useState } from "react";
import { expect, fn, waitFor } from "storybook/test";

import { Button } from "../../ui/Button";
import { TimeScopeBar } from ".";

const scopes = [
  { value: "day", label: "Day", shortcut: "1" },
  { value: "week", label: "Week", shortcut: "2" },
  { value: "month", label: "Month", shortcut: "3" },
];

const lenses = [
  { value: "agenda", label: "Agenda", icon: List, shortcut: "G" },
  { value: "grid", label: "Grid", icon: LayoutGrid, shortcut: "G" },
];

const labels = {
  view: "View",
  zoomIn: "Zoom in to Day",
  zoomOut: "Zoom out to Month",
  lens: "Week layout",
};

function Demo({
  initialScope = "week",
  density,
}: {
  initialScope?: string;
  density?: "comfortable" | "compact";
}) {
  const [scope, setScope] = useState(initialScope);
  const [lens, setLens] = useState("agenda");
  const order = scopes.map((item) => item.value);
  const index = order.indexOf(scope);

  return (
    <LazyMotion features={domMax}>
      <TimeScopeBar
        scopes={scopes}
        scope={scope}
        canZoomIn={index > 0}
        canZoomOut={index < order.length - 1}
        lenses={lenses}
        lens={lens}
        lensVisible={scope === "week"}
        labels={{
          ...labels,
          zoomIn:
            index > 0 ? `Zoom in to ${scopes[index - 1]?.label}` : "Already at the closest view",
          zoomOut:
            index < order.length - 1
              ? `Zoom out to ${scopes[index + 1]?.label}`
              : "Already at the widest view",
        }}
        shortcuts={{ zoomIn: "+", zoomOut: "−" }}
        density={density}
        actions={
          density === "compact" ? undefined : (
            <>
              <Button type="button" variant="ghost" icon={Play}>
                Start timer
              </Button>
              <Button type="button" variant="cta" icon={Plus}>
                New entry
              </Button>
            </>
          )
        }
        onScopeChange={setScope}
        onLensChange={setLens}
        onZoom={(direction) => {
          const next = order[index + (direction === "in" ? -1 : 1)];
          if (next) setScope(next);
        }}
      />
    </LazyMotion>
  );
}

const meta = {
  title: "Sheet/TimeScopeBar",
  component: TimeScopeBar,
  parameters: { layout: "padded" },
  args: {
    scopes,
    scope: "week",
    canZoomIn: true,
    canZoomOut: true,
    lenses,
    lens: "agenda",
    lensVisible: true,
    labels,
    onScopeChange: fn(),
    onLensChange: fn(),
    onZoom: fn(),
  },
} satisfies Meta<typeof TimeScopeBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Row 1 at the week scope: caps, thumb, kbd chips, the lens toggle and the two global actions. */
export const WeekScope: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    await expect(canvas.getByRole("radiogroup", { name: "Week layout" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Zoom out to Month" }));

    await expect(canvas.getByRole("radio", { name: "Month" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The lens belongs to the week alone; it leaves through a 140ms fade, so wait for it.
    await waitFor(() =>
      expect(canvas.queryByRole("radiogroup", { name: "Week layout" })).not.toBeInTheDocument(),
    );
    await expect(canvas.getByRole("button", { name: "Already at the widest view" })).toBeDisabled();
  },
};

/** At the day scope the lens is gone and `⊕` has nowhere to go. */
export const DayScope: Story = {
  render: () => <Demo initialScope="day" />,
};

/** The Month segment wears a dot when declared hours live there and nowhere on this scope. */
export const MonthBadge: Story = {
  args: {
    scopes: scopes.map((item) =>
      item.value === "month" ? { ...item, badge: "Declared hours live in Month" } : item,
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WeekScopeLight: Story = {
  render: () => <Demo />,
  globals: { theme: "light" },
};

/** The phone row: full-width control, no caps, actions moved to the FAB and the header pill. */
export const Compact: Story = {
  render: () => <Demo density="compact" />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
