import { signIn, signUp } from "@/lib/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Sign in
      </h1>
      <p className="mt-1 text-sm text-muted">
        Needed to star tabs and find them again in your account.
      </p>

      {error && (
        <p className="mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded border border-panel-border bg-panel px-4 py-3 text-sm text-muted">
          {message}
        </p>
      )}

      <form action={signIn} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="Email"
          className="border-b border-panel-border bg-transparent pb-1 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Password"
          className="border-b border-panel-border bg-transparent pb-1 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-4">
          <button
            type="submit"
            className="text-xs uppercase tracking-wide text-gold hover:text-gold-bright"
          >
            Sign in
          </button>
          <button
            type="submit"
            formAction={signUp}
            className="text-xs uppercase tracking-wide text-muted hover:text-foreground"
          >
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
