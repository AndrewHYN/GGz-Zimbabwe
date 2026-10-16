import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins/username";
import { nextCookies } from "better-auth/next-js";
import { database } from "./db";
import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { verifyPassword, hashPassword } from "better-auth/crypto";

let instance: ReturnType<typeof buildAuth> | undefined;
function buildAuth(db: Awaited<ReturnType<typeof database>>) {
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  return betterAuth({
    database: { db, type: "postgres" },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    user: { modelName: "ggz_user" },
    session: { modelName: "ggz_session" },
    account: { modelName: "ggz_account" },
    verification: { modelName: "ggz_verification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "ggz_rate_limit",
      window: 60,
      max: 30,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      password: {
        hash: hashPassword,
        async verify({ hash, password }) {
          // Preserve migrated Django PBKDF2 passwords; new passwords use Better Auth's scrypt.
          if (!hash.startsWith("pbkdf2_sha256$"))
            return verifyPassword({ hash, password });
          const [, iterations, salt, expected] = hash.split("$");
          const count = Number(iterations);
          if (
            !salt ||
            !expected ||
            !Number.isInteger(count) ||
            count < 1 ||
            count > 2000000
          )
            return false;
          const actual = pbkdf2Sync(password, salt, count, 32, "sha256");
          const target = Buffer.from(expected, "base64");
          return (
            actual.length === target.length && timingSafeEqual(actual, target)
          );
        },
      },
      sendResetPassword: process.env.SMTP_URL
        ? async ({ user, url }) => {
            const { createTransport } = await import("nodemailer");
            await createTransport(process.env.SMTP_URL!).sendMail({
              from: process.env.EMAIL_FROM,
              to: user.email,
              subject: "Reset your GGz password",
              text: `Reset your password: ${url}\nIf you did not request this, ignore this email.`,
            });
          }
        : undefined,
    },
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },
    plugins: [username(), nextCookies()],
  });
}
export async function auth() {
  return (instance ??= buildAuth(await database()));
}
