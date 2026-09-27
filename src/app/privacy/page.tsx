import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
export const metadata: Metadata = {
  title: "Ochrana osobních údajů · KOS++ | KOS with Friends",
  description:
    "Zpracování údajů, sdílení, analytika a vaše práva v KOS++ | KOS with Friends.",
};
export default function Page() {
  return <LegalPage kind="privacy" />;
}
