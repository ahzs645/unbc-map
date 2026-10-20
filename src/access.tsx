import { useState, type FormEvent, type ReactNode } from "react";
import "./access.css";

// A light safeguard, not security: the build keeps only a SHA-256 of
// manifest/access.json's password, and everything behind the gate still
// ships in the static bundle. An unlock lasts rememberHours in that browser;
// changing the password asks everyone again straight away.
const storageKey = "nhhr-atlas-access";
const rememberMs = FLAGS.rememberHours * 60 * 60 * 1000;

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function remembered() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { hash?: string; until?: number } | null;
    if (saved?.hash === FLAGS.passwordHash && typeof saved.until === "number" && saved.until > Date.now()) return true;
    localStorage.removeItem(storageKey);
  } catch { /* Unreadable or blocked storage asks again. */ }
  return false;
}

export function PasswordGate({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(remembered);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  if (open) return <>{children}</>;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.crypto?.subtle) { setError("This page needs a secure (https) connection to check the password."); return; }
    setChecking(true);
    const hash = await sha256(password);
    setChecking(false);
    if (hash !== FLAGS.passwordHash) { setError("That password is not correct."); return; }
    try { localStorage.setItem(storageKey, JSON.stringify({ hash, until: Date.now() + rememberMs })); } catch { /* Private windows ask again next visit. */ }
    setOpen(true);
  };
  return <main className="access-page">
    <form className="access-card" onSubmit={submit}>
      <p className="access-eyebrow">Northern Hub for Health Research</p>
      <h1>{title}</h1>
      <p>This page is password protected.</p>
      <label htmlFor="access-password">Password</label>
      <input id="access-password" type="password" autoComplete="current-password" autoFocus value={password} aria-invalid={!!error} aria-describedby={error ? "access-error" : undefined} onChange={event => { setPassword(event.target.value); setError(""); }} />
      {error && <p id="access-error" className="access-error" role="alert">{error}</p>}
      <button type="submit" disabled={checking || !password}>Continue</button>
    </form>
  </main>;
}

/** A project switched off in manifest/projects.json. */
export function Unavailable() {
  const base = import.meta.env.BASE_URL;
  return <main className="access-page">
    <div className="access-card">
      <p className="access-eyebrow">Northern Hub for Health Research</p>
      <h1>Page not available</h1>
      <p>This page is not part of the current release.</p>
      {FLAGS.projects.atlas && <a href={base}>Go to the NHHR Atlas</a>}
    </div>
  </main>;
}
