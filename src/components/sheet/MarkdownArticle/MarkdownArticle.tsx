import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils";
import type { MarkdownArticleProps } from "./MarkdownArticle.types";

const BLOCK_START_PATTERN =
  /^(#{1,3})\s|^\s*(---|\*\*\*|___)\s*$|^\s*>\s?|^\s*\d+\.\s+|^\s*[-*]\s+/;
const INLINE_TOKEN_PATTERN = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/;

export function MarkdownArticle({ markdown, className }: MarkdownArticleProps) {
  return (
    <article
      className={cn(
        "max-w-3xl text-sm leading-7 text-foreground sm:text-base",
        "[&_a]:border-b [&_a]:border-accent/35 [&_a]:text-accent [&_a]:transition hover:[&_a]:border-accent",
        "[&_blockquote]:mb-4 [&_blockquote]:rounded-r-[var(--radius-md)] [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-accent/10 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-accent",
        "[&_h1]:mb-5 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight",
        "[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_hr]:my-7 [&_hr]:border-border",
        "[&_li]:mb-1.5 [&_li]:pl-1 [&_li::marker]:text-accent",
        "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_p]:mb-4",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
    >
      {renderMarkdownBlocks(markdown)}
    </article>
  );
}

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (/^\s*$/.test(line)) {
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(<Tag key={`heading-${key++}`}>{renderInline(headingMatch[2], key)}</Tag>);
      index += 1;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${key++}`} />);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${key++}`}>
          <p>{renderInline(quoteLines.join(" "), key)}</p>
        </blockquote>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ordered-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item, key + itemIndex)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`unordered-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item, key + itemIndex)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      !/^\s*$/.test(lines[index] ?? "") &&
      !BLOCK_START_PATTERN.test(lines[index] ?? "")
    ) {
      paragraphLines.push(lines[index] ?? "");
      index += 1;
    }

    blocks.push(<p key={`paragraph-${key++}`}>{renderInline(paragraphLines.join(" "), key)}</p>);
  }

  return blocks;
}

function renderInline(text: string, keyBase: number) {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_TOKEN_PATTERN.exec(rest))) {
    if (match.index > 0) {
      nodes.push(rest.slice(0, match.index));
    }

    if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyBase}-strong-${key++}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={`${keyBase}-em-${key++}`}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      nodes.push(<code key={`${keyBase}-code-${key++}`}>{match[4]}</code>);
    } else if (match[5] !== undefined && match[6] !== undefined) {
      nodes.push(renderLink(match[5], match[6], `${keyBase}-link-${key++}`));
    }

    rest = rest.slice(match.index + match[0].length);
  }

  if (rest) {
    nodes.push(rest);
  }

  return nodes;
}

function renderLink(label: string, href: string, key: string) {
  if (!isSafeHref(href)) {
    return label;
  }

  const external = /^https?:\/\//i.test(href);

  return (
    <a key={key} href={href} target={external ? "_blank" : undefined} rel="noreferrer">
      {label}
    </a>
  );
}

function isSafeHref(href: string) {
  return (
    href.startsWith("/") ||
    href.startsWith("#") ||
    /^https?:\/\//i.test(href) ||
    /^mailto:/i.test(href)
  );
}
