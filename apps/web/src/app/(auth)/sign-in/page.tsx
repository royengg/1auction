"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

function SignInForm() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const redirectTo = searchParams.get("redirect") ?? "/dashboard";

 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [remember, setRemember] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setSubmitting(true);
  const { error } = await signIn.email({ email, password });
  setSubmitting(false);
  if (error) {
   setError(error.message ?? "Unable to sign in. Check your credentials.");
   return;
  }
  router.push(redirectTo);
  router.refresh();
 }

 return (
  <div className="mx-auto w-full max-w-md">
   {/* Logo */}
   <div className="mb-8 text-center">
    <h1 className="font-display text-3xl font-bold text-primary">1auction</h1>
    <p className="mt-2 text-sm text-muted-foreground">
     Sign in to access your secure trading floor.
    </p>
   </div>

   {/* Card */}
   <div className="border border-border bg-card p-8">
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
     <div className="flex flex-col gap-2">
      <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider">
       Email Address
      </Label>
      <div className="relative">
       <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
       <Input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="trader@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        required
        className="border-0 border-b border-border bg-transparent pl-10 text-sm outline-none ring-0 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
       />
      </div>
     </div>

     <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
       <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider">
        Password
       </Label>
       <Link
        href="#"
        className="text-xs text-primary hover:underline"
       >
        Forgot Password?
       </Link>
      </div>
      <div className="relative">
       <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
       <Input
        id="password"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        required
        className="border-0 border-b border-border bg-transparent pl-10 pr-10 text-sm outline-none ring-0 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
       />
       <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
       >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
       </button>
      </div>
     </div>

     <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
       type="checkbox"
       checked={remember}
       onChange={(e) => setRemember(e.target.checked)}
       className="h-4 w-4 rounded border-border accent-primary"
      />
      Remember me on this device
     </label>

     {error && (
      <Alert variant="destructive" className="">
       <AlertDescription>{error}</AlertDescription>
      </Alert>
     )}

     <Button
      type="submit"
      disabled={submitting}
      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
     >
      {submitting ? (
       <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
       </>
      ) : (
       "Sign In"
      )}
     </Button>
    </form>

    <div className="my-6 flex items-center gap-4">
     <div className="flex-1 border-t border-border" />
     <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
      Or Continue With
     </span>
     <div className="flex-1 border-t border-border" />
    </div>

    <div className="flex flex-col gap-3">
     <Button
      variant="outline"
      type="button"
      disabled
      className="w-full gap-2 border-border bg-transparent"
     >
      <svg className="h-4 w-4" viewBox="0 0 24 24">
       <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
       />
       <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
       />
       <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
       />
       <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
       />
      </svg>
      Google
     </Button>
     <Button
      variant="outline"
      type="button"
      disabled
      className="w-full gap-2 border-border bg-transparent"
     >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
       <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Apple
     </Button>
    </div>
   </div>

   <p className="mt-6 text-center text-sm text-muted-foreground">
    Don&apos;t have an account?{" "}
    <Link
     href="/sign-up"
     className="font-medium text-primary underline-offset-4 hover:underline"
    >
     Request Access
    </Link>
   </p>
  </div>
 );
}

export default function SignInPage() {
 return (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
   <Suspense
    fallback={
     <div className="flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
     </div>
    }
   >
    <SignInForm />
   </Suspense>

   {/* Footer */}
   <div className="mt-16 flex items-center gap-6 text-xs text-muted-foreground">
    <Link href="#" className="hover:text-foreground">Terms</Link>
    <Link href="#" className="hover:text-foreground">Privacy</Link>
    <Link href="#" className="hover:text-foreground">Security</Link>
   </div>
  </div>
 );
}
