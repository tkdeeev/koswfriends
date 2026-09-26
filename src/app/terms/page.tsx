import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
export const metadata: Metadata = {
  title: "Podmínky používání · KOSwFriends",
  description: "Podmínky používání nezávislé studentské aplikace KOSwFriends.",
};
export default function Page() {
  return <LegalPage kind="terms" />;
}
