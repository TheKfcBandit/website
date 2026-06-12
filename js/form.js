export function initForm(form) {
  const button = form.querySelector("button");
  const note = form.querySelector("[role=status]");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    button.disabled = true;
    note.textContent = "";
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!res.ok) throw 0;
      form.reset();
      note.textContent = "sent";
    } catch {
      note.textContent = "didn't send, try again";
    }
    button.disabled = false;
  });
}
