import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "./prisma";
import { serverEnv } from "./env";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: serverEnv.betterAuthSecret,
  baseURL:
    process.env.NODE_ENV === "production"
      ? {
          allowedHosts: ["1auction.cooldash.xyz"],
          fallback: "https://1auction.cooldash.xyz",
          protocol: "auto",
        }
      : serverEnv.betterAuthUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      activeRole: {
        type: "string",
        required: false,
        defaultValue: "BIDDER",
        input: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    crossSubDomain: {
      enabled: false,
    },
    cookiePrefix: "1auction",
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 10,
    max: 100,
  },
});