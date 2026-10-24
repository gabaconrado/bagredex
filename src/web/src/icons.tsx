import megaEvolutionUrl from "./assets/pokedex-icons/mega-evolution.svg?no-inline";
import physicalMoveUrl from "./assets/pokedex-icons/physical-move.svg?no-inline";
import shinyUrl from "./assets/pokedex-icons/shiny.svg?no-inline";
import specialMoveUrl from "./assets/pokedex-icons/special-move.svg?no-inline";
import statusMoveUrl from "./assets/pokedex-icons/status-move.svg?no-inline";
import informationCircleUrl from "./assets/icons/information-circle.svg?no-inline";

const DecorativeIcon = ({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) => (
  <img
    class={`icon${className ? ` ${className}` : ""}`}
    src={src}
    alt=""
    aria-hidden="true"
  />
);

export const ShinyIcon = () => (
  <DecorativeIcon src={shinyUrl} className="icon--shiny" />
);

export const MegaIcon = () => <DecorativeIcon src={megaEvolutionUrl} />;

export const InformationIcon = () => (
  <span
    class="icon icon--information"
    style={{ "--information-icon": `url(${informationCircleUrl})` }}
    aria-hidden="true"
  />
);

const categoryUrls = {
  Physical: physicalMoveUrl,
  Special: specialMoveUrl,
  Status: statusMoveUrl,
} as const;

export const CategoryIcon = ({
  category,
}: {
  category: keyof typeof categoryUrls;
}) => <DecorativeIcon src={categoryUrls[category]} />;
