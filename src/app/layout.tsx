import type { Metadata } from "next";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "KOSwFriends — Same school. Shared time.",
  description: "School timetables, friends and shared draft semester plans.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
