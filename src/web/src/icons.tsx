import type { ComponentChildren } from "preact";

type IconProps = { title?: string };

const Icon = ({
  title,
  children,
}: IconProps & { children: ComponentChildren }) => (
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden={title ? undefined : "true"}
    role={title ? "img" : undefined}
  >
    {title && <title>{title}</title>}
    {children}
  </svg>
);

export const ShinyIcon = ({ title }: IconProps) => (
  <Icon title={title}>
    <path d="m12 2 1.6 5.1L19 6l-3.7 4 3.7 4-5.4-1.1L12 18l-1.6-5.1L5 14l3.7-4L5 6l5.4 1.1L12 2Z" />
  </Icon>
);

export const MegaIcon = ({ title }: IconProps) => (
  <Icon title={title}>
    <path d="M4 19 7 5l5 8 5-8 3 14h-4l-1-6-3 5-3-5-1 6H4Z" />
  </Icon>
);

export const CategoryIcon = ({
  category,
}: {
  category: "Physical" | "Special" | "Status";
}) => (
  <Icon>
    {category === "Physical" && (
      <path d="m12 2 2.3 6.5L21 7l-4.5 5 4.5 5-6.7-1.5L12 22l-2.3-6.5L3 17l4.5-5L3 7l6.7 1.5L12 2Z" />
    )}
    {category === "Special" && (
      <path d="M12 2c2.1 4 3.5 5.4 7.5 7.5-4 2.1-5.4 3.5-7.5 7.5-2.1-4-3.5-5.4-7.5-7.5C8.5 7.4 9.9 6 12 2Zm0 14c1.2 2.3 2 3.1 4.3 4.3-2.3 1.2-3.1 2-4.3 4.3-1.2-2.3-2-3.1-4.3-4.3 2.3-1.2 3.1-2 4.3-4.3Z" />
    )}
    {category === "Status" && (
      <path d="M4 5h16v4H4V5Zm3 6h10v3H7v-3Zm3 5h4v3h-4v-3Z" />
    )}
  </Icon>
);
