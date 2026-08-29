import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, waitFor, within } from "storybook/test";
import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from ".";
import type { FormDrawerProps } from ".";

/**
 * The drawer needs an opener to own its state, and Storybook needs the sheet reachable from
 * a click so the play tests exercise the real open/close path rather than a mounted overlay.
 */
function FormDrawerHarness({
  dirty,
  onSubmit,
  ...props
}: Partial<FormDrawerProps> & { onSubmit?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="soft" onClick={() => setOpen(true)}>
        Invite member
      </Button>
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="Invite member"
        description="Send an invitation link and create the member profile used across the app."
        dirty={dirty}
        {...props}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          <FormDrawerBody className="grid gap-5">
            <Field label="First name" required>
              {({ id }) => <Input id={id} name="firstName" />}
            </Field>
            <Field label="Last name" required>
              {({ id }) => <Input id={id} name="lastName" />}
            </Field>
            <Field label="Email" required>
              {({ id }) => <Input id={id} name="email" type="email" />}
            </Field>
          </FormDrawerBody>
          <FormDrawerFooter>
            <span className="text-sm text-muted-foreground">Invitations expire in 7 days.</span>
            <Button type="submit">Send invitation</Button>
          </FormDrawerFooter>
        </form>
      </FormDrawer>
    </>
  );
}

const meta = {
  title: "Sheet/FormDrawer",
  component: FormDrawerHarness,
  globals: {
    theme: "light",
    locale: "en",
  },
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof FormDrawerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /invite member/i }));

    const drawer = await screen.findByRole("dialog", { name: /invite member/i });

    await expect(within(drawer).getByLabelText(/email/i)).toBeVisible();
    await userEvent.click(within(drawer).getByRole("button", { name: /send invitation/i }));
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};

export const Dark: Story = {
  globals: {
    theme: "dark",
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /invite member/i }));
    await expect(await screen.findByRole("dialog", { name: /invite member/i })).toBeVisible();
  },
};

/**
 * The reason a create form can move off the page at all: it is not one stray click away from
 * losing eight fields of typing.
 */
export const GuardsUnsavedInput: Story = {
  args: {
    dirty: true,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /invite member/i }));
    await screen.findByRole("dialog", { name: /invite member/i });

    await userEvent.keyboard("{Escape}");

    const confirm = await screen.findByRole("dialog", { name: /discard your changes/i });

    await userEvent.click(within(confirm).getByRole("button", { name: /keep editing/i }));
    await expect(await screen.findByRole("dialog", { name: /invite member/i })).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: /discard your changes/i })).getByRole(
        "button",
        { name: /^discard$/i },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /invite member/i })).not.toBeInTheDocument(),
    );
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /invite member/i }));
    await expect(await screen.findByRole("dialog", { name: /invite member/i })).toBeVisible();
  },
};
