import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AetherOS",
  description:
    "A local browser desktop with files, a text editor, a terminal and settings.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
