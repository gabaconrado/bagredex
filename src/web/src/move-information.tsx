import { useEffect, useRef } from "preact/hooks";

export type MoveInformation = {
  name: string;
  type: { id: string; name: string };
  category: string;
  basePower: number;
  accuracy: number | null;
  alwaysHits: boolean;
  pp: number;
  priority: number;
  target: string;
  flags: string[];
  description?: string;
};

export function formatMoveTarget(target: string) {
  const spaced = target
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const typeClass = (id: string) =>
  `move-info__type move-info__type--${id.replace(/[^a-z]/g, "")}`;

export function MoveInformationDialog({
  move,
  invoker,
  onClose,
}: {
  move: MoveInformation;
  invoker: HTMLElement | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === "function") element.showModal();
    if (!element.open) element.setAttribute("open", "");
    element.querySelector<HTMLElement>(".dialog-close")?.focus();
  }, []);
  const close = (restore = true) => {
    dialog.current?.close();
    onClose();
    if (restore) queueMicrotask(() => invoker?.isConnected && invoker.focus());
  };
  return (
    <dialog
      ref={dialog}
      class="info-dialog move-info-dialog"
      aria-labelledby="move-info-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ];
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (
          first === last ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
    >
      <div class="info-dialog__surface">
        <header>
          <h2 id="move-info-dialog-title">{move.name}</h2>
          <button
            type="button"
            class="dialog-close"
            autofocus
            onClick={() => close()}
            aria-label="Close details"
          >
            ×
          </button>
        </header>
        <div class="info-grid">
          <span class={typeClass(move.type.id)}>{move.type.name}</span>
          <span>{move.category}</span>
          <span>
            <b>Power:</b> {move.basePower}
          </span>
          <span>
            <b>Accuracy:</b> {move.alwaysHits ? "Always hits" : move.accuracy}
          </span>
          <span>
            <b>PP:</b> {move.pp}
          </span>
          <span>
            <b>Priority:</b> {move.priority}
          </span>
          <span>
            <b>Target:</b>{" "}
            <span class="info-pill">{formatMoveTarget(move.target)}</span>
          </span>
        </div>
        {move.description && <p class="info-description">{move.description}</p>}
        <div class="info-flags">
          <b>Flags:</b>
          {move.flags.length ? (
            <span class="info-pill-list">
              {move.flags.map((flag) => (
                <span class="info-pill" key={flag}>
                  {flag}
                </span>
              ))}
            </span>
          ) : (
            <span>None</span>
          )}
        </div>
      </div>
    </dialog>
  );
}
