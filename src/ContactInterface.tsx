import { useRef, useState, type RefObject, type FormEvent } from "react";
import { profile } from "./data/portfolio";

/** Mail clients and Windows shells truncate or refuse long mailto: URLs (about 2,000 characters). */
const MAILTO_LIMIT = 1800, DRAFT_KEY = "vg:contact-draft";
type Draft = { name: string; email: string; message: string };
const emptyDraft: Draft = { name: "", email: "", message: "" };
function readDraft(): Draft {
  try { return { ...emptyDraft, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") }; } catch { return emptyDraft; }
}
function writeDraft(draft: Draft | null) {
  try { if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); else sessionStorage.removeItem(DRAFT_KEY); } catch { /* optional */ }
}
export function composeMailto(draft: Draft) {
  const subject = encodeURIComponent(`Portfolio enquiry from ${draft.name}`);
  const full = `${draft.message}\n\nFrom: ${draft.name}\nReply to: ${draft.email}`;
  const head = `mailto:${profile.email}?subject=${subject}&body=`;
  if ((head + encodeURIComponent(full)).length <= MAILTO_LIMIT) return { url: head + encodeURIComponent(full), truncated: false, full };
  const signature = `\n\nFrom: ${draft.name}\nReply to: ${draft.email}`;
  let body = draft.message;
  while (body.length && (head + encodeURIComponent(body + "…" + signature)).length > MAILTO_LIMIT) {
    body = body.slice(0, Math.floor(body.length * .9));
    // Never end on half an emoji: a lone surrogate makes encodeURIComponent throw.
    if (/[\uD800-\uDBFF]$/.test(body)) body = body.slice(0, -1);
  }
  return { url: head + encodeURIComponent(body + "…" + signature), truncated: true, full };
}

export default function ContactInterface({ surface, entered, onBack }: {
  surface: RefObject<HTMLElement | null>; entered: boolean; onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [drafted, setDrafted] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [saved] = useState(readDraft);
  const read = (): Draft => { const data = new FormData(form.current!); return { name: String(data.get("name") ?? ""), email: String(data.get("email") ?? ""), message: String(data.get("message") ?? "") }; };
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = read(), mail = composeMailto(draft);
    if (mail.truncated) {
      // The full text must never be lost: it goes to the clipboard before the shortened draft opens.
      let copiedFull = false;
      try { await navigator.clipboard.writeText(mail.full); copiedFull = true; } catch { /* reported below */ }
      setStatus(copiedFull ? "Your message is long, so the email draft is shortened. The full text is on your clipboard to paste." : "Your message is long, so the email draft is shortened. Use “Copy message” to keep the full text.");
    } else setStatus("Your email app will open with this draft. If nothing opens, copy the message and send it to the address alongside.");
    setDrafted(true);
    window.location.href = mail.url;
  };
  const copyMessage = async () => {
    const draft = read();
    const text = `To: ${profile.email}\nSubject: Portfolio enquiry from ${draft.name || "your portfolio"}\n\n${draft.message}\n\nFrom: ${draft.name}\nReply to: ${draft.email}`;
    try { await navigator.clipboard.writeText(text); setStatus("Message copied. Paste it into any email app."); } catch { setStatus(`Couldn’t access the clipboard. Email me at ${profile.email}`); }
  };
  const remember = () => writeDraft(read());
  const copy = async () => {
    try { await navigator.clipboard.writeText(profile.email); setCopied(true); }
    catch { setStatus(`Email me at ${profile.email}`); }
  };
  return <section ref={surface} className="contact-portal" aria-label="Contact Vassel" aria-hidden={!entered} inert={!entered} data-entered={entered}>
    <div className="contact-website">
      <div className="contact-web-body">
        <div className="contact-intro">
          <span className="contact-kicker"><i /> Email · WhatsApp · Instagram · GitHub · LinkedIn</span>
          <h2>Let’s build something <em>useful.</em></h2>
          <p>A project, a role or a question: tell me what you have in mind and I’ll write back.</p>
          <div className="contact-person"><span className="contact-monogram">VG.</span><div><strong>{profile.name}</strong><span>{profile.role}</span><small>{profile.location}</small></div></div>
          <div className="contact-address"><a href={`mailto:${profile.email}`}>{profile.email} <span>↗</span></a><button type="button" onClick={copy} aria-label="Copy email address">{copied ? "Copied ✓" : "Copy"}</button></div>
          <div className="contact-socials"><a href={profile.whatsapp} target="_blank" rel="noreferrer">WhatsApp <span>↗</span></a><a href={profile.instagram} target="_blank" rel="noreferrer">Instagram <span>↗</span></a><a href={profile.github} target="_blank" rel="noreferrer">GitHub <span>↗</span></a><a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn <span>↗</span></a></div>
        </div>
        <form ref={form} className="contact-form" onSubmit={send} onInput={remember}>
          <span className="contact-kicker">Send a note</span>
          <h3>What are you working on?</h3>
          <label>Your name<input autoComplete="name" name="name" required placeholder="How should I call you?" maxLength={100} defaultValue={saved.name} /></label>
          <label>Email address<input autoComplete="email" type="email" name="email" required placeholder="you@example.com" maxLength={200} defaultValue={saved.email} /></label>
          <label>Your message<textarea name="message" required placeholder="Tell me a little about your idea…" rows={4} maxLength={5000} defaultValue={saved.message} /></label>
          <button type="submit" className="compose-email">Write the email <span>↗</span></button>
          <button type="button" className="copy-message" onClick={copyMessage}>{drafted ? "Nothing opened? Copy the message" : "Copy message instead"}</button>
          <small>Opens your email app with a ready-to-send draft.</small>
          <p className="contact-status" role="status">{status || (copied ? "Email address copied." : "")}</p>
        </form>
      </div>
      <footer className="contact-web-footer"><span>© {new Date().getFullYear()} {profile.name}</span><button onClick={onBack}>← Back to the workspace</button></footer>
    </div>
  </section>;
}
