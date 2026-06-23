import { cn } from "@/src/lib/utils";
import type { AvatarProps } from "./Avatar.types";
import { avatarVariants } from "./Avatar.variants";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, initials, src, size, tone, className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(avatarVariants({ size, tone }), className)}
      aria-label={src ? name : undefined}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- component accepts external prototype URLs.
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials ?? getInitials(name)}</span>
      )}
    </div>
  );
}
