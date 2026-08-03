"use client";

import { Send, Save } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";
import { Textarea } from "@/src/components/ui/Textarea";
import { MarkdownArticle } from "../MarkdownArticle";
import type { InfoPageEditorProps, InfoPageEditorValue } from "./InfoPageEditor.types";

export function InfoPageEditor({
  value,
  labels,
  className,
  onValueChange,
  onSave,
  onPublish,
}: InfoPageEditorProps) {
  const [draft, setDraft] = useState(value);
  const currentValue = onValueChange ? value : draft;

  function updateValue(nextValue: InfoPageEditorValue) {
    if (!onValueChange) setDraft(nextValue);
    onValueChange?.(nextValue);
  }

  function updateField<Key extends keyof InfoPageEditorValue>(
    key: Key,
    nextValue: InfoPageEditorValue[Key],
  ) {
    updateValue({ ...currentValue, [key]: nextValue });
  }

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{labels?.title ?? "Info page editor"}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels?.description ?? "Edit internal Markdown content for contractors and employees."}
          </p>
        </div>
        <Badge tone={currentValue.status === "published" ? "success" : "warning"}>
          {currentValue.status ?? "draft"}
        </Badge>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">{labels?.editTab ?? "Edit"}</TabsTrigger>
            <TabsTrigger value="preview">{labels?.previewTab ?? "Preview"}</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels?.titleField ?? "Title"} htmlFor="info-title">
                  <Input
                    id="info-title"
                    value={currentValue.title}
                    onChange={(event) => updateField("title", event.target.value)}
                  />
                </Field>
                <Field label={labels?.slugField ?? "Slug"} htmlFor="info-slug">
                  <Input
                    id="info-slug"
                    value={currentValue.slug}
                    onChange={(event) => updateField("slug", event.target.value)}
                  />
                </Field>
              </div>
              <Field label={labels?.bodyField ?? "Markdown"} htmlFor="info-body">
                <Textarea
                  id="info-body"
                  value={currentValue.body}
                  className="min-h-72 font-mono"
                  onChange={(event) => updateField("body", event.target.value)}
                />
              </Field>
            </div>
          </TabsContent>
          <TabsContent value="preview">
            <MarkdownPreview title={currentValue.title} body={currentValue.body} />
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2">
          {onSave ? (
            <Button type="button" variant="soft" icon={Save} onClick={() => onSave(currentValue)}>
              {labels?.save ?? "Save draft"}
            </Button>
          ) : null}
          {onPublish ? (
            <Button
              type="button"
              variant="cta"
              icon={Send}
              onClick={() => onPublish({ ...currentValue, status: "published" })}
            >
              {labels?.publish ?? "Publish"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MarkdownPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-5">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <MarkdownArticle markdown={body} />
    </div>
  );
}
