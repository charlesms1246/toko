"use client";

import { usePathname } from "next/navigation";
import Panel from "@/components/shell/Panel";

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isIndex = pathname === "/dev";
  const leaf = pathname.split("/").pop()?.replace(/-/g, " ") ?? "dev";

  return (
    <Panel
      title={isIndex ? "Dev" : leaf}
      backHref={isIndex ? undefined : "/dev"}
      screenLabel="Dev tools"
      status={{ left: "DEV", right: isIndex ? "INDEX" : leaf.toUpperCase() }}
    >
      {children}
    </Panel>
  );
}
