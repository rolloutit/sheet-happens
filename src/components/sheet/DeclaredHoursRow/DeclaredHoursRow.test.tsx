import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeclaredHoursRow } from ".";
import type { DeclaredHoursRowProps } from "./DeclaredHoursRow.types";

const project = { projectId: "nimbus", name: "Nimbus", color: "#f2b8ff" };

const labels = {
  hoursLabel: (target: { name: string }) => `${target.name}, declared hours`,
  hoursPlaceholder: "52",
  hoursHint: "Hours for the whole month.",
  noteLabel: (target: { name: string }) => `${target.name}, what the hours cover`,
  notePlaceholder: "Platform migration support",
  noteRequired: "Describe what the declared hours cover.",
  proofLabel: "Hours proof PDF",
  proofUpload: "Upload proof",
  proofReplace: "Replace",
  proofView: "View",
  proofMissing: "No proof uploaded yet",
  proofNeedsHours: "Declare the hours first, then attach the proof.",
  proofUploading: "Uploading",
  save: "Save",
  saving: "Saving",
  saved: "Saved",
  locked: "A submitted timesheet locks this month.",
  nothingDeclared: "Nothing declared",
  externalSystem: "external system",
};

function renderRow(overrides: Partial<DeclaredHoursRowProps> = {}) {
  const onSave = vi.fn();
  const onUploadProof = vi.fn();

  render(
    <DeclaredHoursRow
      project={project}
      minutes={null}
      note=""
      proof={null}
      locale="en"
      durationDisplayFormat="DECIMAL_HOURS"
      labels={labels}
      onSave={onSave}
      onUploadProof={onUploadProof}
      {...overrides}
    />,
  );

  return { onSave, onUploadProof };
}

describe("DeclaredHoursRow", () => {
  /** §15: the input's accessible name names the project, or a band of rows all read "Hours". */
  it("names the project in the hours and note labels", () => {
    renderRow();

    expect(screen.getByLabelText("Nimbus, declared hours")).toBeInTheDocument();
    expect(screen.getByLabelText("Nimbus, what the hours cover")).toBeInTheDocument();
  });

  it("parses typed hours into minutes and reports them on save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderRow();

    await user.type(screen.getByLabelText("Nimbus, declared hours"), "52");
    await user.type(
      screen.getByLabelText("Nimbus, what the hours cover"),
      "Platform migration support",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      projectId: "nimbus",
      minutes: 3_120,
      note: "Platform migration support",
    });
  });

  /** The same duration grammar the rest of the app accepts, so `52:30` is not a typo to anyone. */
  it("accepts the app's other duration formats", async () => {
    const user = userEvent.setup();
    const { onSave } = renderRow({ note: "Migration" });

    await user.type(screen.getByLabelText("Nimbus, declared hours"), "52:30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ minutes: 3_150 }));
  });

  /**
   * The reason the row commits on an explicit save rather than per field: a figure with no note is
   * not submittable, because the note becomes the entry's description.
   */
  it("cannot save a figure without a note", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.type(screen.getByLabelText("Nimbus, declared hours"), "52");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("cannot save a note without a figure", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.type(screen.getByLabelText("Nimbus, what the hours cover"), "Migration");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("cannot save when nothing changed", () => {
    renderRow({ minutes: 3_120, note: "Migration" });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  /** There is nothing for a proof to prove until a figure exists. */
  it("offers no proof upload before the hours are declared", () => {
    renderRow();

    expect(screen.queryByRole("button", { name: "Upload proof" })).not.toBeInTheDocument();
    expect(screen.getByText("Declare the hours first, then attach the proof.")).toBeInTheDocument();
  });

  it("offers the upload once hours exist, and reports the chosen file", async () => {
    const user = userEvent.setup();
    const { onUploadProof } = renderRow({ minutes: 3_120, note: "Migration" });
    const file = new File(["%PDF-1.7"], "nimbus-sep.pdf", { type: "application/pdf" });

    await user.upload(screen.getByLabelText("Hours proof PDF"), file);

    expect(onUploadProof).toHaveBeenCalledWith({ projectId: "nimbus", file });
  });

  it("says the proof is missing while hours are declared without one", () => {
    renderRow({ minutes: 3_120, note: "Migration" });

    expect(screen.getByText("No proof uploaded yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload proof" })).toBeInTheDocument();
  });

  it("offers a replacement once a proof is attached", () => {
    renderRow({
      minutes: 3_120,
      note: "Migration",
      proof: {
        filename: "nimbus-sep.pdf",
        href: "/time/hours-proof/declaration-1",
        sizeLabel: "412 kB",
        uploadedAtLabel: "30 Sep 2026, 17:20",
      },
    });

    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/time/hours-proof/declaration-1",
    );
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
  });

  /** A warning, not a block: the figure is still saveable. */
  it("shows the implausible-figure warning without disabling the save", () => {
    renderRow({ minutes: 3_120, note: "Migration", warning: "That is more than 720 h." });

    expect(screen.getByText("That is more than 720 h.")).toBeInTheDocument();
  });

  /**
   * Locked has to stay *readable*: the figure, the note and the proof are what an admin and the
   * member compare against an invoice.
   */
  it("renders locked as read-only text with the proof still openable", () => {
    renderRow({
      locked: true,
      minutes: 3_120,
      note: "Platform migration support",
      proof: {
        filename: "nimbus-sep.pdf",
        href: "/time/hours-proof/declaration-1",
        sizeLabel: "412 kB",
        uploadedAtLabel: "30 Sep 2026, 17:20",
      },
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
    expect(screen.getByText("52 h")).toBeInTheDocument();
    expect(screen.getByText("Platform migration support")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toBeInTheDocument();
    expect(screen.getByText("A submitted timesheet locks this month.")).toBeInTheDocument();
  });

  it("says so when a locked month holds no declaration at all", () => {
    renderRow({ locked: true });

    expect(screen.getByText("Nothing declared")).toBeInTheDocument();
  });
});
