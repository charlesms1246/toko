import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import Surround from "@/components/console/Surround";
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
            On a desktop the app is a phone-shaped COLUMN on a backdrop. On a
            phone it is the whole screen — the column only exists from 640px up,
            which is what the reference does and what `globals.css` explains.
            
            The reference does this and it is upstream of a whole class of
            problems we had been fixing one at a time: a menu sized against a
            variable frame, a screen scale that had to stop clamping, a
            customizer that needed a band reserved, a landing that framed the
            device out of its own page. Inside a column that is always
            phone-shaped, none of them arise.
            
            `app-shell` fills the page behind the column, and carries the one
            backdrop: the tiled surround, around the phone rather than inside it.
            A photographic desk was tried here and removed — it was the
            reference's, and two backdrops is one too many.
          */}
          <div className="app-shell">
            <Surround />
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
