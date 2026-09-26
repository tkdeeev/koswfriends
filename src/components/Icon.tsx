import type { SVGProps } from "react";

export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & {
  name:
    | "sun"
    | "moon"
    | "plus"
    | "chevron"
    | "users"
    | "calendar"
    | "planner"
    | "refresh"
    | "filters"
    | "link";
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
      {name === "calendar" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18M7 15h3m4 0h3m-10 3h3" />
        </>
      )}
      {name === "planner" && (
        <>
          <path d="M9 5H5v16h14V5h-4" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m8 12 1 1 2-2m2 1h3m-8 5 1 1 2-2m2 1h3" />
        </>
      )}
      {name === "refresh" && (
        <>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M6 7a7 7 0 0 1 11-1l3 6M4 12l3 6a7 7 0 0 0 11-1" />
        </>
      )}
      {name === "filters" && (
        <>
          <path d="M3 6h3m4 0h11M3 12h11m4 0h3M3 18h5m4 0h9" />
          <circle cx="8" cy="6" r="2" />
          <circle cx="16" cy="12" r="2" />
          <circle cx="10" cy="18" r="2" />
        </>
      )}
      {name === "link" && (
        <>
          <path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2" />
        </>
      )}
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
