for (const form of document.querySelectorAll("[data-regulation-selector]")) {
  const select = form.querySelector("select[name='regulation']");
  if (!(select instanceof HTMLSelectElement)) continue;

  const defaultValue = select.value;
  const syncFromLocation = () => {
    const requested = new URL(window.location.href).searchParams.get(
      "regulation",
    );
    const value = requested ?? defaultValue;
    if ([...select.options].some((option) => option.value === value))
      select.value = value;
  };

  form.setAttribute("data-enhanced", "");
  select.addEventListener("change", () => {
    const url = select.selectedOptions[0]?.dataset.url;
    if (
      url &&
      document.dispatchEvent(
        new CustomEvent("bagredex:navigate", {
          cancelable: true,
          detail: { url },
        }),
      )
    )
      window.location.assign(url);
  });
  window.addEventListener("popstate", syncFromLocation);
  window.addEventListener("pageshow", syncFromLocation);
}
