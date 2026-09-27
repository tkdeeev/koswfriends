import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

// Static brand artwork: social crawlers never need a session or private data.
const logo = (await readFile("public/logo.svg", "utf8")).replace(
  'width="512" height="512" viewBox="0 0 512 512"',
  'x="72" y="66" width="192" height="72" viewBox="0 160 512 192"',
);
await mkdir("public/social", { recursive: true });
for (const [kind, title, line1, line2] of [
  [
    "home",
    "KOS with Friends",
    "Your CTU timetable.",
    "Your lessons, together.",
  ],
  [
    "friend",
    "Friend invitation",
    "Connect and share your timetable.",
    "See which lessons you have together.",
  ],
  [
    "group",
    "Group invitation",
    "Join your friends in one group.",
    "Compare timetables. Choose what you share.",
  ],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#172d3b"/>
    <path d="M0 622h1200" stroke="#0079c1" stroke-width="16"/>
    ${logo}
    <g font-family="DejaVu Sans, sans-serif" fill="#fff">
      <text x="72" y="270" font-size="49" font-weight="bold">${title}</text>
      <text x="72" y="336" font-size="23" fill="#c2d4df">${line1}</text>
      <text x="72" y="375" font-size="23" fill="#c2d4df">${line2}</text>
      <text x="72" y="540" font-size="22" fill="#88bce0">kos.deeev.cz</text>
    </g>
    <g transform="translate(786 115)">
      <rect width="342" height="398" rx="16" fill="#203b4d" stroke="#456374"/>
      <path d="M0 64h342M0 143h342M0 223h342M0 302h342M114 64v334M228 64v334" fill="none" stroke="#456374"/>
      <g font-family="DejaVu Sans, sans-serif" font-size="17" text-anchor="middle" fill="#c2d4df"><text x="57" y="39">MON</text><text x="171" y="39">TUE</text><text x="285" y="39">WED</text></g>
      <rect x="12" y="78" width="90" height="128" rx="5" fill="#145a86" stroke="#51b1e6"/>
      <rect x="126" y="162" width="90" height="129" rx="5" fill="#315448" stroke="#8fc9aa"/>
      <rect x="240" y="78" width="90" height="84" rx="5" fill="#624576" stroke="#c596e1"/>
      <rect x="240" y="240" width="90" height="139" rx="5" fill="#145a86" stroke="#51b1e6"/>
      <g fill="#fff" opacity=".8"><rect x="24" y="93" width="55" height="5" rx="2"/><rect x="138" y="178" width="55" height="5" rx="2"/><rect x="252" y="93" width="55" height="5" rx="2"/><rect x="252" y="256" width="55" height="5" rx="2"/></g>
      <g stroke="#203b4d" stroke-width="3"><circle cx="33" cy="179" r="14" fill="#dfab74"/><circle cx="54" cy="179" r="14" fill="#76ae9c"/><circle cx="75" cy="179" r="14" fill="#9d9ddd"/><circle cx="148" cy="264" r="14" fill="#dfab74"/><circle cx="169" cy="264" r="14" fill="#9d9ddd"/></g>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/social/${kind}.png`);
}
