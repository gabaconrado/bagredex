import { fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { describe, expect, it, vi } from "vitest";
import {
  AnchoredListbox,
  SearchLiveCount,
  SearchOptionGroup,
  SearchOptionRow,
  SearchTextField,
  useActiveOptionScroll,
} from "./search-list";

function Example() {
  const [active, setActive] = useState(0);
  useActiveOptionScroll(`shared-option-${active}`);
  return (
    <div>
      <SearchTextField
        inputId="shared-search"
        label="Search choices"
        role="combobox"
        aria-controls="shared-list"
        aria-expanded="true"
        aria-activedescendant={`shared-option-${active}`}
      />
      <SearchLiveCount>2 choices available.</SearchLiveCount>
      <AnchoredListbox id="shared-list" className="consumer-list">
        <SearchOptionGroup id="shared-group" label="Choices">
          {["First", "Second"].map((label, index) => (
            <SearchOptionRow
              id={`shared-option-${index}`}
              active={active === index}
              onPointerActive={() => setActive(index)}
              onActivate={() => undefined}
            >
              {label}
            </SearchOptionRow>
          ))}
        </SearchOptionGroup>
      </AnchoredListbox>
    </div>
  );
}

describe("shared search list primitives", () => {
  it("shares field, grouped list, active row, and live-count semantics", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<Example />);
    const input = screen.getByRole("combobox", { name: "Search choices" });
    const list = screen.getByRole("listbox");
    expect(input.closest(".search-field")).toBeTruthy();
    expect(list.classList.contains("search-list")).toBe(true);
    expect(screen.getByRole("group", { name: "Choices" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("2 choices available.");
    expect(
      screen.getAllByRole("option")[0]?.classList.contains("is-active"),
    ).toBe(true);
    fireEvent.mouseMove(screen.getAllByRole("option")[1]!);
    expect(input.getAttribute("aria-activedescendant")).toBe("shared-option-1");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});
