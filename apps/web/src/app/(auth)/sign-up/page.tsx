"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Loader2, User, Mail, Lock, Eye, EyeOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUp } from "@/lib/auth-client";

function SignUpForm() {
 const router = useRouter();
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [agreed, setAgreed] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Password strength calculation
 const passwordStrength = (() => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
 })();

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  if (!agreed) {
   setError("You must agree to the Terms of Service and Privacy Policy.");
   return;
  }
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
  <div className="mx-auto w-full max-w-md">
   {/* Logo */}
   <div className="mb-8 text-center">
    <h1 className="font-display text-3xl font-bold text-primary">1auction</h1>
    <p className="mt-2 text-sm text-muted-foreground">
     Create an account to start bidding.
    </p>
   </div>

   {/* Card */}
   <div className="border border-border bg-card p-8">
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
     <div className="flex flex-col gap-2">
      <Label htmlFor="name" className="font-mono text-xs uppercase tracking-wider">
       Full Name
      </Label>
      <div className="relative">
       <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
       <Input
        id="name"
        type="text"
        autoComplete="name"
        placeholder="John Doe"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        required
        className="border-0 border-b border-border bg-transparent pl-10 text-sm outline-none ring-0 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
       />
      </div>
     </div>

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
        placeholder="john@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        required
        className="border-0 border-b border-border bg-transparent pl-10 text-sm outline-none ring-0 focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
       />
      </div>
     </div>

     <div className="flex flex-col gap-2">
      <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider">
       Password
      </Label>
      <div className="relative">
       <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
       <Input
        id="password"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        required
        minLength={8}
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

     {/* Password strength indicator */}
     <div className="flex gap-1">
      {[1, 2, 3, 4].map((i) => (
       <div
        key={i}
        className={`h-1 flex-1 rounded-full transition-colors ${
         i <= passwordStrength ? "bg-primary" : "bg-border"
        }`}
       />
      ))}
     </div>

     <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
       type="checkbox"
       checked={agreed}
       onChange={(e) => setAgreed(e.target.checked)}
       className="h-4 w-4 rounded border-border accent-primary"
      />
      I agree to the{" "}
      <Link href="#" className="text-primary hover:underline">
       Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="#" className="text-primary hover:underline">
       Privacy Policy
      </Link>
      .
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
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
        account…
       </>
      ) : (
       "Create Account"
      )}
     </Button>
    </form>
   </div>

   <p className="mt-6 text-center text-sm text-muted-foreground">
    Already have an account?{" "}
    <Link
     href="/sign-in"
     className="font-medium text-primary underline-offset-4 hover:underline"
    >
     Sign In
    </Link>
   </p>
  </div>
 );
}

export default function SignUpPage() {
 return (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
   <Suspense
    fallback={
     <div className="flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
     </div>
    }
   >
    <SignUpForm />
   </Suspense>
  </div>
 );
}
