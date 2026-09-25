import type { SVGProps } from "react";

export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & {
  name: "sun" | "moon" | "plus" | "chevron" | "users";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {name === "sun" && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </>
      )}
      {name === "moon" && (
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "chevron" && <path d="m9 5 7 7-7 7" />}
      {name === "users" && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          <circle cx="9" cy="7" r="4" />
        </>
      )}
    </svg>
  );
}
