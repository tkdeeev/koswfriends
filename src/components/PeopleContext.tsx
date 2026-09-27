"use client";
import { createContext } from "react";
import type { PersonOverview } from "@/lib/availability";
import type { Person } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

// Keep avatar consumers independent of the profile/dialog implementation.
export const PeopleContext = createContext<{
  people: PersonOverview[];
  open: (p: Person) => void;
  locale: Locale;
  now: number;
}>({ people: [], open: () => {}, locale: "en", now: 0 });
