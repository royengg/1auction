"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signUp } from "@/lib/auth-client";

function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signUp.email({
      name,
      email,
      password,
      activeRole: "BIDDER",
    } as Parameters<typeof signUp.email>[0]);
    setSubmitting(false);
    if (error) {
      setError(
        error.message ?? "Unable to create account. Try a different email.",
      );
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-4 pb-6 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          1auction
        </h1>
        <div className="flex items-center justify-center gap-2 text-primary">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-sm font-medium text-primary">
            High-Stakes Security Guaranteed
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
              minLength={8}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
                account…
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="outline" type="button" disabled className="w-full">
            <span className="mr-2 text-base">G</span>
            Continue with Google
          </Button>
          <Button variant="outline" type="button" disabled className="w-full">
            <span className="mr-2 text-base"></span>
            Continue with Apple
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="#" className="hover:text-foreground">
            Terms
          </Link>
          <span></span>
          <Link href="#" className="hover:text-foreground">
            Privacy
          </Link>
          <span></span>
          <Link href="#" className="hover:text-foreground">
            Security
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}