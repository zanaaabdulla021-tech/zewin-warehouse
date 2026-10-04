import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(creds) {
        const email = creds?.email?.trim().toLowerCase();
        if (!email || !creds?.password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE" || !user.passwordHash) return null;
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        return ok ? { id: user.id, name: user.name, email: user.email } : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.uid as string;
      return session;
    },
  },
};
