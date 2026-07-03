import { NextRequest, NextResponse } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/rooms",
  "/active-bids",
  "/my-auctions",
  "/watchlist",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  const authToken =
    request.cookies.get("__Secure-1auction.session_token")?.value ??
    request.cookies.get("1auction.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value ??
    request.cookies.get("better-auth.session_token")?.value;

  // Auth pages: redirect to dashboard if already logged in
  const isAuthPage = pathname === "/" || pathname === "/sign-in" || pathname === "/sign-up";
  if (isAuthPage && authToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtected) return NextResponse.next();

  if (!authToken) {
    const redirect = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/sign-in?redirect=${redirect}`, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/sign-in",
    "/sign-up",
    "/dashboard/:path*",
    "/rooms/:path*",
    "/active-bids/:path*",
    "/my-auctions/:path*",
    "/watchlist/:path*",
    "/settings/:path*",
    "/dashboard",
    "/rooms",
    "/active-bids",
    "/my-auctions",
    "/watchlist",
    "/settings",
  ],
};