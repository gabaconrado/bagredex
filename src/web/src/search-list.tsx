import type { ComponentChildren, JSX, RefObject } from "preact";
import { useEffect } from "preact/hooks";

export function useActiveOptionScroll(optionId?: string) {
  useEffect(() => {
    if (!optionId) return;
    document.getElementById(optionId)?.scrollIntoView?.({ block: "nearest" });
  }, [optionId]);
}

export function SearchTextField({
  label,
  inputId,
  inputRef,
  hint,
  className = "",
  ...inputProps
}: JSX.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  inputId: string;
  inputRef?: RefObject<HTMLInputElement>;
  hint?: ComponentChildren;
  className?: string;
}) {
  return (
    <div class={`search-field${className ? ` ${className}` : ""}`}>
      <label for={inputId}>{label}</label>
      <div class="search-field__input-wrap">
        <input {...inputProps} id={inputId} ref={inputRef} />
        {hint}
      </div>
    </div>
  );
}

export function SearchLiveCount({ children }: { children: ComponentChildren }) {
  return (
    <span
      class="visually-hidden search-list__live-count"
      role="status"
      aria-live="polite"
    >
      {children}
    </span>
  );
}

export function AnchoredListbox({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: ComponentChildren;
}) {
  return (
    <div
      class={`search-list${className ? ` ${className}` : ""}`}
      id={id}
      role="listbox"
    >
      {children}
    </div>
  );
}

export function SearchOptionGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ComponentChildren;
}) {
  return (
    <section
      class="search-list__group suggestions__group"
      role="group"
      aria-labelledby={id}
    >
      <h3 id={id}>{label}</h3>
      {children}
    </section>
  );
}

export function SearchOptionRow({
  id,
  active,
  children,
  onActivate,
  onPointerActive,
  className = "",
}: {
  id: string;
  active: boolean;
  children: ComponentChildren;
  onActivate: () => void;
  onPointerActive?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={active}
      class={`${active ? "is-active" : ""}${className ? ` ${className}` : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={onPointerActive}
      onFocus={onPointerActive}
      onClick={onActivate}
    >
      {children}
    </button>
  );
}
