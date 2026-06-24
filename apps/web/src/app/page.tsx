import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        1auction
      </h1>
      <p className="max-w-prose text-muted-foreground">
        A realtime auction platform. Create a room, list your items, invite up
        to six bidders, and let the room bid live.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition hover:bg-accent"
        >
          Create an account
        </Link>
      </div>
    </main>
  );
}