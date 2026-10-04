import { withAuth } from "next-auth/middleware";

/** Every page except login, auth API and static assets needs a session. */
export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
