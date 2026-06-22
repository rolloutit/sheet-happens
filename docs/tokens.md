# Design Tokens

The token source is `app/globals.css`.

## Theme modes

- Dark is the default mode and matches the Claude design direction.
- Light is supported through the `.light` class.
- Theme switching is handled by `next-themes`.

## Token families

- Color: `background`, `foreground`, `card`, `popover`, `primary`, `accent`, `cta`, `success`, `warning`, `destructive`, `border`, `input`, `ring`.
- Radius: `xs`, `sm`, `md`, `lg`, `xl`, `pill`.
- Font: Lexend-like sans token and Poppins-like UI token.
- Shadow: `soft` and `panel`.

Component code should use Tailwind token classes such as `bg-background`, `text-foreground`, `border-border`, `bg-cta`, and `text-accent`.
