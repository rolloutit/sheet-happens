import fs from "node:fs";
import path from "node:path";

import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoots = ["app", "scripts", "src/server"];
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const auditActionPattern = /^[a-z_]+\.[a-z0-9_.]+$/;
const auditTargetPattern = /^[a-z_]+$/;

describe("audit event localization", () => {
  it("translates every emitted audit action in both locales", () => {
    const emittedActions = collectAuditValues("action");

    expect(emittedActions.length).toBeGreaterThan(0);

    for (const action of emittedActions) {
      const key = action.replaceAll(".", "__");

      expect(en.AdminAudit.events.actions, `missing English label for ${action}`).toHaveProperty(
        key,
      );
      expect(hu.AdminAudit.events.actions, `missing Hungarian label for ${action}`).toHaveProperty(
        key,
      );
    }
  });

  it("translates every emitted audit target type in both locales", () => {
    const emittedTargetTypes = collectAuditValues("targetType");

    expect(emittedTargetTypes.length).toBeGreaterThan(0);

    for (const targetType of emittedTargetTypes) {
      expect(
        en.AdminAudit.events.targets,
        `missing English label for target ${targetType}`,
      ).toHaveProperty(targetType);
      expect(
        hu.AdminAudit.events.targets,
        `missing Hungarian label for target ${targetType}`,
      ).toHaveProperty(targetType);
    }
  });
});

function collectAuditValues(propertyName: "action" | "targetType") {
  const values = new Set<string>();
  const valuePattern = propertyName === "action" ? auditActionPattern : auditTargetPattern;

  for (const filename of collectSourceFiles()) {
    const sourceText = fs.readFileSync(filename, "utf8");
    const isAuditProducer =
      sourceText.includes("auditLog.create") || sourceText.includes("INSERT INTO audit_logs");

    if (!isAuditProducer) continue;

    const sourceFile = ts.createSourceFile(
      filename,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    function visit(node: ts.Node) {
      if (
        ts.isPropertyAssignment(node) &&
        getPropertyName(node.name, sourceFile) === propertyName
      ) {
        collectStringValues(node.initializer, values, valuePattern);
      }

      if (
        propertyName === "action" &&
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "auditAction" &&
        node.initializer
      ) {
        collectStringValues(node.initializer, values, valuePattern);
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (propertyName === "action" && sourceText.includes("INSERT INTO audit_logs")) {
      for (const match of sourceText.matchAll(/["']([a-z_]+\.[a-z0-9_.]+)["']/g)) {
        if (auditActionPattern.test(match[1])) values.add(match[1]);
      }
    }
  }

  return [...values].sort();
}

function collectStringValues(node: ts.Node, values: Set<string>, pattern: RegExp) {
  if (ts.isStringLiteralLike(node) && pattern.test(node.text)) {
    values.add(node.text);
  }

  ts.forEachChild(node, (child) => collectStringValues(child, values, pattern));
}

function getPropertyName(name: ts.PropertyName, sourceFile: ts.SourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return name.getText(sourceFile);
}

function collectSourceFiles() {
  return sourceRoots.flatMap((root) => walkDirectory(path.join(process.cwd(), root)));
}

function walkDirectory(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);

    if (entry.isDirectory()) return walkDirectory(filename);
    if (!sourceExtensions.has(path.extname(entry.name))) return [];
    if (entry.name.includes(".test.") || entry.name.includes(".stories.")) return [];

    return [filename];
  });
}
