import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/shell/AppShell";
import ConsoleStage from "@/components/console/ConsoleStage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TOKO · World's First Virtual Gamified Trading Console",
  description:
    "The simplest, most fun way to trade. A gamified trading console on Somnia.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TOKO",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "TOKO · World's First Virtual Gamified Trading Console",
    description: "Built for fun and money.",
    url: SITE_URL,
    images: ["/toko-og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden">
        <Providers>
          <AppShell>
            <ConsoleStage>{children}</ConsoleStage>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
