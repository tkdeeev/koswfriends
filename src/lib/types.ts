export type Localized = { cs: string; en: string };
export type Lesson = {
  id: string;
  course: string;
  title: Localized;
  type: string;
  group: string;
  start: string;
  end: string;
  room: string;
  cancelled: boolean;
};
export type Semester = {
  code: string;
  from: string;
  to: string;
  verified: boolean;
};
export type Choice = {
  id: string;
  course: string;
  title: Localized;
  group: string | null;
  note: string;
  verified: boolean;
  events: Lesson[];
};
export type Grant = { calendar: boolean; plans: boolean };
export type Friend = {
  id: string;
  username: string;
  name: string;
  status: "pending" | "accepted";
  incoming: boolean;
  giving: Grant;
  receiving: Grant;
};
export type Calendar = {
  userId: string;
  username: string;
  events: Lesson[];
  lastSuccess: string | null;
  error: string | null;
  semester: Semester;
};
export type Me = {
  id: string;
  username: string;
  name: string;
  csrf: string;
  semester: string;
  reconnect: boolean;
};
