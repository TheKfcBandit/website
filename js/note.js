import { getToken } from "./turnstile.js";

const MESSAGES = {
  "bad-note": "Write a message of up to 280 characters.",
  "slow-down": "Please wait a moment before sending another note.",
  unverified: "Couldn't verify you — try again.",
  "not-configured": "Notes are unavailable right now.",
};

export function initNote(form, { verify = getToken } = {}) {
  const input = form.querySelector("textarea");
  const send = form.querySelector(".note-send");
  const feedback = form.querySelector(".note-feedback");
  let busy = false, session = 0;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;
    const note = input.value.trim();
    if (!note || note.length > 280) {
      feedback.textContent = MESSAGES["bad-note"];
      input.focus();
      return;
    }
    const mine = session;
    const website = form.elements.namedItem("website").value;
    let submitted = false;
    busy = true;
    input.readOnly = true;
    send.disabled = true;
    form.setAttribute("aria-busy", "true");
    feedback.textContent = "Sending…";
    try {
      const token = await verify();
      // Flipping back before verification completes cancels this submission.
      if (mine !== session) { feedback.textContent = ""; return; }
      submitted = true;
      const res = await fetch("/api/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, website, token }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        form.reset();
        feedback.textContent = "Sent, thanks!";
      } else {
        const error = (await res.json().catch(() => ({}))).error;
        feedback.textContent = MESSAGES[error] ?? "Couldn't confirm delivery. Your message is still here.";
      }
    } catch {
      feedback.textContent = submitted
        ? "Couldn't confirm delivery. Your message is still here."
        : MESSAGES.unverified;
    } finally {
      busy = false;
      input.readOnly = false;
      send.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });

  return { cancel() { ++session; } };
}
