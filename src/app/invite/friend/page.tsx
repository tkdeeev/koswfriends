import Workspace from "@/components/Workspace";
import { socialMetadata } from "@/lib/social-metadata";
export const metadata = socialMetadata("friend");
export default function FriendInvitationPage() {
  return <Workspace />;
}
