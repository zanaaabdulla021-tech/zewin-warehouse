import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="zw-card">
      <EmptyState
        icon={<SearchX className="h-5 w-5" />}
        title="Not found"
        body="The record you're looking for doesn't exist or was removed."
        action={
          <Link href="/" className="text-[14px] font-medium text-brand-700 hover:underline">
            ← Dashboard
          </Link>
        }
      />
    </div>
  );
}
