import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
export const metadata: Metadata = {
  title: "Podmínky používání · KOS++ | KOS with Friends",
  description:
    "Podmínky používání nezávislé studentské aplikace KOS++ | KOS with Friends.",
};
export default function Page() {
  return <LegalPage kind="terms" />;
}
