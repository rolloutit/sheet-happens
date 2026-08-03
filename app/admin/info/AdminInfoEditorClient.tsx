"use client";

import { RotateCcw, Send } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { MarkdownArticle } from "@/src/components/sheet/MarkdownArticle";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { FormMessage } from "@/src/components/ui/FormMessage";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { publishHelpWelcomeInfoPageAction, type AdminInfoActionState } from "./actions";

type AdminInfoEditorValue = {
  title: string;
  bodyMarkdown: string;
};

export type AdminInfoEditorClientProps = {
  slug: string;
  initialValue: AdminInfoEditorValue & {
    status: "draft" | "published";
    version: number | null;
    updatedAtLabel: string | null;
  };
  defaultValue: AdminInfoEditorValue;
  labels: {
    editorTitle: string;
    editorDescription: string;
    titleLabel: string;
    bodyLabel: string;
    previewTitle: string;
    previewDescription: string;
    publish: string;
    reset: string;
    markdownHint: string;
    fallbackNotice: string;
    statusDraft: string;
    statusPublished: string;
    versionLabel: string;
    updatedAtLabel: string;
  };
};

const initialActionState: AdminInfoActionState = {
  status: "idle",
  message: "",
};

export function AdminInfoEditorClient({
  slug,
  initialValue,
  defaultValue,
  labels,
}: AdminInfoEditorClientProps) {
  const [draft, setDraft] = useState<AdminInfoEditorValue>({
    title: initialValue.title,
    bodyMarkdown: initialValue.bodyMarkdown,
  });
  const [publishedMeta, setPublishedMeta] = useState({
    status: initialValue.status,
    version: initialValue.version,
    updatedAtLabel: initialValue.updatedAtLabel,
  });
  const [state, formAction, isPending] = useActionState(
    publishHelpWelcomeInfoPageAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success" || !state.value) return;

    setDraft({
      title: state.value.title,
      bodyMarkdown: state.value.bodyMarkdown,
    });
    setPublishedMeta({
      status: "published",
      version: state.value.version,
      updatedAtLabel: new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(state.value.updatedAt)),
    });
  }, [state]);

  const statusLabel =
    publishedMeta.status === "published" ? labels.statusPublished : labels.statusDraft;

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-[var(--radius-pill)] border border-border bg-secondary px-3 py-1 font-ui font-semibold text-foreground">
          {statusLabel}
        </span>
        {publishedMeta.version ? (
          <span>{labels.versionLabel.replace("{version}", String(publishedMeta.version))}</span>
        ) : (
          <span>{labels.fallbackNotice}</span>
        )}
        {publishedMeta.updatedAtLabel ? (
          <span>{labels.updatedAtLabel.replace("{date}", publishedMeta.updatedAtLabel)}</span>
        ) : null}
      </div>

      {state.message ? (
        <FormMessage tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{labels.editorTitle}</CardTitle>
            <CardDescription>{labels.editorDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label={labels.titleLabel} htmlFor="info-title" required>
              <Input
                id="info-title"
                name="title"
                value={draft.title}
                invalid={Boolean(state.fieldErrors?.title)}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
              {state.fieldErrors?.title ? (
                <FormMessage tone="error">{state.fieldErrors.title}</FormMessage>
              ) : null}
            </Field>

            <Field label={labels.bodyLabel} htmlFor="info-body" required>
              <Textarea
                id="info-body"
                name="bodyMarkdown"
                value={draft.bodyMarkdown}
                invalid={Boolean(state.fieldErrors?.bodyMarkdown)}
                className="min-h-[32rem] font-mono text-[13px] leading-6"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bodyMarkdown: event.target.value }))
                }
              />
              {state.fieldErrors?.bodyMarkdown ? (
                <FormMessage tone="error">{state.fieldErrors.bodyMarkdown}</FormMessage>
              ) : (
                <FormMessage>{labels.markdownHint}</FormMessage>
              )}
            </Field>
          </CardContent>
        </Card>

        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{labels.previewTitle}</CardTitle>
            <CardDescription>{labels.previewDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[var(--radius-lg)] border border-border bg-background/45 p-5">
              <MarkdownArticle markdown={draft.bodyMarkdown} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="soft"
          icon={RotateCcw}
          onClick={() => setDraft(defaultValue)}
        >
          {labels.reset}
        </Button>
        <Button type="submit" variant="cta" icon={Send} loading={isPending}>
          {labels.publish}
        </Button>
      </div>
    </form>
  );
}
