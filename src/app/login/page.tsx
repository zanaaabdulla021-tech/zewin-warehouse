import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const DEMO = [
  { email: "zana@zewin.app", role: "Super Admin" },
  { email: "ahmed@zewin.app", role: "Admin" },
  { email: "shirin@zewin.app", role: "Accounting" },
  { email: "karwan@zewin.app", role: "Warehouse Manager" },
  { email: "dilan@zewin.app", role: "Warehouse Employee" },
];

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/");
  // demo accounts are shown only outside production
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "1" ? DEMO : [];
  return <LoginForm callbackUrl={searchParams.callbackUrl ?? "/"} demo={demo} />;
}
