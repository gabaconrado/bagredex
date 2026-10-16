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
    <path d="m12.5 1.5 1.45 4.55L18.5 7.5l-4.55 1.45-1.45 4.55-1.45-4.55L6.5 7.5l4.55-1.45L12.5 1.5ZM5 12l.8 2.2L8 15l-2.2.8L5 18l-.8-2.2L2 15l2.2-.8L5 12Zm13.5 2 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </Icon>
);

export const MegaIcon = ({ title }: IconProps) => (
  <Icon title={title}>
    <path
      d="M12 2.2c5.2 0 9.3 3.8 9.3 8.8 0 5.4-4.8 10.8-9.3 10.8S2.7 16.4 2.7 11c0-5 4.1-8.8 9.3-8.8Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
    />
    <path
      d="M8 5.5c6 2.6 2 10.4 8 13M16 5.5C10 8.1 14 15.9 8 18.5M9.3 8h5.4m-6 4h6.6m-6 4h5.4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
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
      <path d="m3 13 5.2-2.1-2.6-4.5 5 2.2L12.4 3l2 5.1 5-2.7-2.1 5.2L22 12l-4.8 2.1 2.2 5-5-2.5L12 22l-1.7-5-5.5 2 2.8-4.6L3 13Z" />
    )}
    {category === "Special" && (
      <g fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="2.3" fill="currentColor" />
        <circle cx="12" cy="12" r="5.6" />
        <path d="M12 1.7v2.5M12 19.8v2.5M1.7 12h2.5M19.8 12h2.5M4.7 4.7l1.8 1.8m11 11 1.8 1.8m0-15.6-1.8 1.8m-11 11-1.8 1.8" />
      </g>
    )}
    {category === "Status" && (
      <path
        d="M12 2.5 15 8l6 .8-4.3 4.3 1 6-5.7-2.8-5.7 2.8 1-6L3 8.8 9 8l3-5.5Zm0 5.1-1.2 2.5-2.8.4 2 2-.5 2.8 2.5-1.4 2.5 1.4-.5-2.8 2-2-2.8-.4L12 7.6Z"
        fill-rule="evenodd"
      />
    )}
  </Icon>
);
