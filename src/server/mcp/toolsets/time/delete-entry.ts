import { z } from "zod";

import { deleteTimeEntry, getMemberTimeEntry } from "@/src/server/time-tracking";

import { fail, ok, runTool } from "../../results";
import { dayTotal, entryId, entryView } from "../../schemas/common";
import { REQUIRES_USER_INTERACTION, UPDATE_ANNOTATIONS, type McpTool } from "../../tool";
import { entryLine, readDay, toDayTotal, toEntryView } from "./shared";

const inputSchema = z.object({ entryId }).strict();

/**
 * `restorable` is a literal `true`, not a boolean.
 *
 * A model that reads `restorable: boolean` has to reason about the false branch, and the safe way to
 * resolve that ambiguity is to hedge — to ask again before an ordinary "drop that entry, it's
 * wrong". Saying it in the schema removes the branch: on this API a delete is never the
 * irreversible kind.
 */
const outputSchema = z
  .object({
    deleted: entryView,
    day: dayTotal,
    restorable: z.literal(true),
  })
  .strict();

const DESCRIPTION = `Delete one of the signed-in member's time entries.

This is a **soft** delete and it is reversible: \`time_restore_entry\` with the same \`entryId\` puts the entry back exactly as it was, so a wrong delete costs one more call rather than lost work. Deleting many entries is fine to propose for the same reason — but each call asks the member to confirm in the client, so expect one approval per entry instead of one for the batch.

Fails if the id is not one of this member's entries (\`ENTRY_NOT_FOUND\`), if the entry is locked by a submitted timesheet (\`ENTRY_LOCKED\`), if its month is locked (\`PERIOD_LOCKED\`), or if it belongs to a declared month (\`ENTRY_IS_DECLARED\`) — declared hours are corrected a month at a time in the web app.

Returns the entry as it stood before the delete, the day's total after it, and \`restorable: true\`.`;

export const deleteEntryTool: McpTool = {
  name: "time_delete_entry",
  scope: "time:write",
  register(server, actor) {
    server.registerTool(
      "time_delete_entry",
      {
        title: "Delete time entry",
        description: DESCRIPTION,
        inputSchema,
        outputSchema,
        annotations: UPDATE_ANNOTATIONS,
        /*
         * The only tool in the server that forces a human click, whatever the client's
         * auto-approve setting. Not because it is the most dangerous — it is a soft delete with
         * `time_restore_entry` behind it — but because it is the one action a member regrets, and
         * an agent that misreads "that Tuesday is wrong" can sweep a week in seconds. One click
         * per entry is a cheap brake; restoring twenty entries one id at a time is not.
         */
        _meta: REQUIRES_USER_INTERACTION,
      },
      async (args) =>
        runTool("time_delete_entry", async () => {
          /*
           * Read BEFORE the write. A soft delete only sets `deletedAt`, and the read path hides
           * such rows — so after `deleteTimeEntry` the usual `readMutationResult` echo would come
           * back empty and the agent would have nothing to name what it just removed, nor a
           * project and duration to offer back when the member says "no, not that one".
           */
          const row = await getMemberTimeEntry({
            memberId: actor.member.id,
            timeEntryId: args.entryId,
          });

          if (!row) {
            // Answered without touching the write path: `deleteTimeEntry` would raise the same
            // code, but calling it on a known-missing id would also write an audit attempt.
            return fail("ENTRY_NOT_FOUND", "No entry with that id belongs to this member.", {
              entryId: args.entryId,
            });
          }

          await deleteTimeEntry({
            memberId: actor.member.id,
            // Both, and both the actor's own — the same structural guard the other mutations use.
            // A differing `actorMemberId` is how the domain layer recognises an admin correction,
            // so an agent must never be able to produce one.
            actorMemberId: actor.member.id,
            timeEntryId: args.entryId,
            requestMetadata: actor.requestMetadata,
          });

          // The day as it now stands. Read after the delete on purpose: the new total is the one
          // fact the agent cannot derive itself, since other entries may share the day.
          const day = await readDay(actor, row.date);

          const structured = {
            deleted: toEntryView(row, actor),
            day: toDayTotal(row.date, day.totalMinutes, actor),
            restorable: true as const,
          };

          return ok(structured, [
            `Deleted: ${entryLine(structured.deleted)}`,
            `${structured.day.date} total: ${structured.day.totalText}`,
            // Repeated in the text channel because a client that renders only text would otherwise
            // show a bare "deleted", and the model's summary to the member should say it is undoable.
            `Soft delete — time_restore_entry with id ${structured.deleted.id} puts it back.`,
          ]);
        }),
    );
  },
};
