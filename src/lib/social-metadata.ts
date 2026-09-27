import type { Metadata } from "next";

const origin = "https://kos.deeev.cz";
const cards = {
  home: {
    title: "KOS++ | KOS with Friends",
    description:
      "Your CTU timetable, shared lessons and personal events. Compare schedules with friends and groups.",
    path: "/",
  },
  friend: {
    title: "Friend invitation · KOS++",
    description:
      "Connect on KOS with Friends to share timetables and see your lessons together. Sign in with your CTU account to review the invitation.",
    path: "/invite/friend",
  },
  group: {
    title: "Group invitation · KOS++",
    description:
      "Join a group on KOS with Friends and compare your timetables. Sign in with your CTU account to review the invitation and choose what you share.",
    path: "/invite/group",
  },
};

/** Public, static previews only. Never query accounts, membership or invite tokens. */
export function socialMetadata(kind: keyof typeof cards): Metadata {
  const card = cards[kind];
  const image = {
    url: `${origin}/social/${kind}.png`,
    width: 1200,
    height: 630,
    alt: card.title,
    type: "image/png",
  };
  return {
    title: card.title,
    description: card.description,
    openGraph: {
      type: "website",
      siteName: "KOS++ | KOS with Friends",
      title: card.title,
      description: card.description,
      url: origin + card.path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description: card.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
