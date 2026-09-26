import { eq, or } from "drizzle-orm";
import { database } from "./db";
import {
  users,
  snapshots,
  personalEvents,
  plans,
  grants,
  overrides,
  blocks,
  friendships,
  groups,
  members,
} from "./schema";
import { AppError } from "./security";

/** Export account data without credentials or another person's private records. */
export async function exportAccount(userId: string) {
  return database().transaction(
    async (tx) => {
      const [profile] = await tx
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          semester: users.semester,
          createdAt: users.createdAt,
          activeAt: users.activeAt,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (!profile) throw new AppError("unauthorized", 401);

      const timetableSnapshots = await tx
        .select({
          semester: snapshots.semester,
          events: snapshots.events,
          window: snapshots.window,
          lastAttempt: snapshots.lastAttempt,
          lastSuccess: snapshots.lastSuccess,
          error: snapshots.error,
        })
        .from(snapshots)
        .where(eq(snapshots.userId, userId));
      const events = await tx
        .select({
          id: personalEvents.id,
          semester: personalEvents.semester,
          details: personalEvents.details,
        })
        .from(personalEvents)
        .where(eq(personalEvents.owner, userId));
      const draftPlans = await tx
        .select({
          semester: plans.semester,
          choices: plans.choices,
          updatedAt: plans.updatedAt,
        })
        .from(plans)
        .where(eq(plans.userId, userId));
      const outgoingGrants = await tx
        .select({
          viewerId: grants.viewer,
          calendar: grants.calendar,
          plans: grants.plans,
        })
        .from(grants)
        .where(eq(grants.owner, userId));
      const sharingOverrides = await tx
        .select({
          viewerId: overrides.viewer,
          calendar: overrides.calendar,
          plans: overrides.plans,
        })
        .from(overrides)
        .where(eq(overrides.owner, userId));
      const blocked = await tx
        .select({ targetId: blocks.target })
        .from(blocks)
        .where(eq(blocks.owner, userId));
      const relations = await tx
        .select({
          a: friendships.a,
          b: friendships.b,
          requester: friendships.requester,
          status: friendships.status,
          createdAt: friendships.createdAt,
        })
        .from(friendships)
        .where(or(eq(friendships.a, userId), eq(friendships.b, userId)));
      const groupMemberships = await tx
        .select({
          groupId: groups.id,
          name: groups.name,
          ownerId: groups.owner,
          createdAt: groups.createdAt,
          status: members.status,
          calendar: members.calendar,
          plans: members.plans,
        })
        .from(members)
        .innerJoin(groups, eq(groups.id, members.groupId))
        .where(eq(members.userId, userId));
      const ownedGroups = await tx
        .select({
          id: groups.id,
          name: groups.name,
          createdAt: groups.createdAt,
        })
        .from(groups)
        .where(eq(groups.owner, userId));

      return {
        format: "koswfriends-account-export",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        profile,
        timetableSnapshots,
        personalEvents: events,
        draftPlans,
        sharing: {
          grants: outgoingGrants,
          overrides: sharingOverrides,
          blocked,
        },
        friendships: relations.map((relation) => ({
          otherUserId: relation.a === userId ? relation.b : relation.a,
          requestedByMe: relation.requester === userId,
          status: relation.status,
          createdAt: relation.createdAt,
        })),
        groupMemberships,
        ownedGroups,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
