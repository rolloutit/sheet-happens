import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from ".";

const meta = {
  title: "UI/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      {(["flat", "elevated", "featured", "warning", "selected"] as const).map((variant) => (
        <Card key={variant} variant={variant} clickable={variant === "flat"}>
          <CardHeader>
            <div>
              <CardTitle>{variant}</CardTitle>
              <CardDescription>Reusable panel surface with consistent spacing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Designed for lists, dashboards, and forms.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="soft" size="sm">
              Action
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  ),
};
