import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/shell/AppShell";
import ConsoleStage from "@/components/console/ConsoleStage";
import ScreenGate from "@/components/shell/ScreenGate";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TOKO · Virtual Gamified Trading Console",
  description:
    "The simplest, most fun way to trade. A gamified trading console on Somnia, playing real DreamDEX Event Contracts.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TOKO",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "TOKO · Virtual Gamified Trading Console",
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
  // A focused input should shrink the viewport rather than float over the
  // console, so the device keeps fitting the space it is actually given.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden">
        <Providers>
          {/*
            The app is a phone-width COLUMN on a backdrop, not a full-bleed
            page.
            
            The reference does this and it is upstream of a whole class of
            problems we had been fixing one at a time: a menu sized against a
            variable frame, a screen scale that had to stop clamping, a
            customizer that needed a band reserved, a landing that framed the
            device out of its own page. Inside a column that is always
            phone-shaped, none of them arise.
            
            `app-shell` fills the page behind the column. The console's own
            tiled surround is the only backdrop — a photographic one was tried
            here and removed: it was the reference's desk, it fought the tile
            already drifting behind the device, and two backdrops is one too
            many.
          */}
          <div className="app-shell">
            <div className="app-frame">
              <AppShell>
                <ConsoleStage>
                  <ScreenGate>{children}</ScreenGate>
                </ConsoleStage>
              </AppShell>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
