import { z } from "zod";
import type { Localized } from "./types";

export const taskStatuses = ["todo", "doing", "done"] as const;
export const taskStatus = z.enum(taskStatuses);
export const checklistItem = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1).max(160),
  done: z.boolean(),
});
export const taskData = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000),
  dueDate: z.iso.date().nullable(),
  checklist: z
    .array(checklistItem)
    .max(30)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
    ),
});
export const boardKey = z.object({
  semester: z.string().regex(/^B\d{2}[12]$/),
  course: z.string().trim().min(1).max(100),
});
export const boardAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("notes"), notes: z.string().max(8000) }),
  z.object({ action: z.literal("add"), task: taskData, status: taskStatus }),
  z.object({ action: z.literal("edit"), id: z.uuid(), task: taskData }),
  z.object({ action: z.literal("delete"), id: z.uuid() }),
  z.object({
    action: z.literal("check"),
    id: z.uuid(),
    itemId: z.uuid(),
    done: z.boolean(),
  }),
  z.object({
    action: z.literal("move"),
    id: z.uuid(),
    status: taskStatus,
    beforeId: z.uuid().optional(),
  }),
]);
export type TaskStatus = z.infer<typeof taskStatus>;
export type TaskData = z.infer<typeof taskData>;
export type SubjectTask = TaskData & { id: string; status: TaskStatus };
export type BoardAction = z.infer<typeof boardAction>;
export type SubjectBoard = {
  course: string;
  semester: string;
  notes: string;
  tasks: SubjectTask[];
  revision: number;
};
export type SubjectSummary = { course: string; title: Localized };
