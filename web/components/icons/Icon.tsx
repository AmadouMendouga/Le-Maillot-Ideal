import type { IconName } from "./names";

export interface IconProps {
  name: IconName;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<IconProps["size"]>, string> = {
  sm: "icon-sm",
  md: "icon",
  lg: "icon-lg",
  xl: "icon-xl",
};

/** `<Icon name="cart" />` → `<svg class="icon"><use href="#i-cart"/></svg>`. */
export function Icon({ name, size = "md", className }: IconProps) {
  const cls = [SIZE_CLASS[size], className].filter(Boolean).join(" ");
  return (
    <svg className={cls} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
