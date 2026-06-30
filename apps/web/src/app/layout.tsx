import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";

export const metadata: Metadata = {
 title: "Interactive Auction Hub — Live Auction Rooms",
 description:
  "A realtime auction platform. Create a room, list your items, and let bidders compete live.",
};

export const viewport: Viewport = {
 themeColor: "#F4F4F4",
};

export default function RootLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
  <html lang="en" suppressHydrationWarning>
   <body className="min-h-screen bg-background font-sans antialiased">
    <QueryProvider>{children}</QueryProvider>
   </body>
  </html>
 );
}