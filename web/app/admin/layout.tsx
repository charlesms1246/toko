"use client";

import { usePathname } from "next/navigation";
import Panel from "@/components/shell/Panel";
import { useRequireAdmin } from "@/lib/games/lab";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = useRequireAdmin();
  const pathname = usePathname();
  const isIndex = pathname === "/admin";

  return (
    <Panel
      title={isIndex ? "Admin" : (pathname.split("/").pop() ?? "admin")}
      backHref={isIndex ? undefined : "/admin"}
      screenLabel="Admin"
      status={{ left: "ADMIN", right: admin ? "OK" : "DENIED" }}
    >
      {admin ? (
        children
      ) : (
        <p className="py-10 text-center text-sm text-text-3">
          Admin access only. Enable admin mode in Settings.
        </p>
      )}
    </Panel>
  );
}
