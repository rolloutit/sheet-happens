import type { HTMLAttributes } from "react";

export type FormMessageTone = "hint" | "error" | "success";

export type FormMessageProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: FormMessageTone;
};
