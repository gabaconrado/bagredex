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
    <path d="m12 2 1.25 3.75L17 7l-3.75 1.25L12 12l-1.25-3.75L7 7l3.75-1.25L12 2ZM5 12l.85 2.15L8 15l-2.15.85L5 18l-.85-2.15L2 15l2.15-.85L5 12Zm13 2 .85 2.15L21 17l-2.15.85L18 20l-.85-2.15L15 17l2.15-.85L18 14Z" />
  </Icon>
);

export const MegaIcon = ({ title }: IconProps) => (
  <Icon title={title}>
    <path
      d="M7 3c7 3 3 15 10 18M17 3C10 6 14 18 7 21M8.6 6h6.8M8 11h8m-7.4 5h6.8"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </Icon>
);

export const CategoryIcon = ({
  category,
}: {
  category: "Physical" | "Special" | "Status";
}) => (
  <Icon>
    {category === "Physical" && (
      <path d="m12 2 1.8 6L19 5l-3 5.2 6 .8-5.5 2.4 4.1 4.4-6-1.5L14 22l-3.2-4.8L7 21l1-5.8-6-1.1 5.4-2.5L3.2 7l6.1 1.7L12 2Z" />
    )}
    {category === "Special" && (
      <path
        d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
        fill-rule="evenodd"
      />
    )}
    {category === "Status" && (
      <path
        d="M5 4h14v4H5V4Zm2 6h10v10H7V10Zm3 3v4h4v-4h-4Z"
        fill-rule="evenodd"
      />
    )}
  </Icon>
);
