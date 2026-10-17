for (const form of document.querySelectorAll("[data-regulation-selector]")) {
  const select = form.querySelector("select[name='regulation']");
  if (!(select instanceof HTMLSelectElement)) continue;

  form.setAttribute("data-enhanced", "");
  select.addEventListener("change", () => {
    const url = select.selectedOptions[0]?.dataset.url;
    if (url) window.location.assign(url);
  });
}
