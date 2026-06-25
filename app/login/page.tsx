import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="center-screen">
      <div className="card card-narrow">
        <div style={{ marginBottom: 22 }}>
          <div className="brand">
            Life OS<span className="dot">.</span>
          </div>
          <div className="tagline">Systems beat goals. Sign in to run yours.</div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {message ? <div className="alert alert-ok">{message}</div> : null}

        <form>
          <div className="field">
            <label htmlFor="name">Name (new account only)</label>
            <input id="name" name="name" type="text" autoComplete="name" placeholder="Mark" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" formAction={login}>
              Sign in
            </button>
            <button className="btn" formAction={signup}>
              Create account
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
