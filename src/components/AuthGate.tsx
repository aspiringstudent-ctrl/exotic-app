import { AlertCircle, KeyRound, LoaderCircle, LogIn, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";

export interface AuthContextView {
  mode: "supabase" | "demo";
  email: string;
  configured: boolean;
  onSignOut: () => void;
}

interface AuthGateProps {
  children: (context: AuthContextView) => ReactNode;
}

type AuthMode = "sign-in" | "sign-up" | "magic-link";

export function AuthGate({ children }: AuthGateProps) {
  const auth = useSupabaseAuth();
  const [demoMode, setDemoMode] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!auth.configured && demoMode) {
    return children({
      mode: "demo",
      email: "Local demo",
      configured: false,
      onSignOut: () => setDemoMode(false),
    });
  }

  if (auth.configured && auth.user) {
    return children({
      mode: "supabase",
      email: auth.user.email ?? "Authenticated user",
      configured: true,
      onSignOut: () => {
        void auth.signOut();
      },
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");

    const trimmedEmail = email.trim();
    const result =
      mode === "sign-up"
        ? await auth.signUpWithPassword(trimmedEmail, password)
        : mode === "magic-link"
          ? await auth.sendMagicLink(trimmedEmail)
          : await auth.signInWithPassword(trimmedEmail, password);

    if (result.error) {
      setError(result.error);
    }

    if (result.message) {
      setNotice(result.message);
    }

    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <ShieldCheck aria-hidden="true" size={22} />
          </span>
          <div>
            <p className="eyebrow">GridStream Ops</p>
            <h1>Secure Operations Access</h1>
          </div>
        </div>

        {auth.loading ? (
          <div className="auth-loading">
            <LoaderCircle aria-hidden="true" size={22} />
            Checking session
          </div>
        ) : null}

        {!auth.configured ? (
          <div className="auth-config">
            <div className="auth-alert">
              <AlertCircle aria-hidden="true" size={18} />
              <span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enforce authentication.</span>
            </div>
            <button className="primary-button" onClick={() => setDemoMode(true)} type="button">
              <LogIn aria-hidden="true" size={16} />
              Continue demo
            </button>
          </div>
        ) : null}

        {auth.configured && !auth.loading ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-tabs" aria-label="Authentication mode">
              <button
                className={mode === "sign-in" ? "auth-tab-active" : ""}
                onClick={() => setMode("sign-in")}
                type="button"
              >
                Sign in
              </button>
              <button
                className={mode === "sign-up" ? "auth-tab-active" : ""}
                onClick={() => setMode("sign-up")}
                type="button"
              >
                Create
              </button>
              <button
                className={mode === "magic-link" ? "auth-tab-active" : ""}
                onClick={() => setMode("magic-link")}
                type="button"
              >
                Magic link
              </button>
            </div>

            <label className="field-control">
              <span>Email</span>
              <span>
                <Mail aria-hidden="true" size={16} />
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            {mode !== "magic-link" ? (
              <label className="field-control">
                <span>Password</span>
                <span>
                  <KeyRound aria-hidden="true" size={16} />
                  <input
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    minLength={6}
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </span>
              </label>
            ) : null}

            {error ? <div className="auth-error">{error}</div> : null}
            {notice ? <div className="auth-notice">{notice}</div> : null}

            <button className="primary-button" disabled={busy} type="submit">
              {mode === "sign-up" ? <UserPlus aria-hidden="true" size={16} /> : <LogIn aria-hidden="true" size={16} />}
              {busy
                ? "Working"
                : mode === "sign-up"
                  ? "Create account"
                  : mode === "magic-link"
                    ? "Send magic link"
                    : "Sign in"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
