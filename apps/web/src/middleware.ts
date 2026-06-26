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

  if (!isProtected) return NextResponse.next();

  const authToken =
    request.cookies.get("1auction.session_token")?.value ??
    request.cookies.get("better-auth.session_token")?.value;

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