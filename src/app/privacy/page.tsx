import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
export const metadata: Metadata = {
  title: "Ochrana osobních údajů · KOSwFriends",
  description:
    "Zpracování údajů, sdílení, analytika a vaše práva v KOSwFriends.",
};
export default function Page() {
  return <LegalPage kind="privacy" />;
}
