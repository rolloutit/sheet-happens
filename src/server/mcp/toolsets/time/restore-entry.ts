import { z } from "zod";

import { restoreTimeEntry } from "@/src/server/time-tracking";

import { fail, ok, runTool } from "../../results";
import { entryId, mutationResult } from "../../schemas/common";
import { RESTORE_ANNOTATIONS, type McpTool } from "../../tool";
import { entryLine, readMutationResult } from "./shared";

const inputSchema = z.object({ entryId }).strict();

const DESCRIPTION = `Bring a deleted time entry back, exactly as it was.

A restore is re-validated as though the entry were being created now: the month must still be open (\`PERIOD_LOCKED\`), the project assignment must still be tracked per entry rather than declaring its hours monthly (\`PROJECT_DECLARES_MONTHLY\`), and the day must still fit under 24 hours with the entry back in it (\`DAILY_LIMIT_EXCEEDED\`). A restore can therefore fail even though the delete succeeded — the same way undo behaves in the web app.

Only a deleted entry can be restored. An id that is already live, was never deleted, or belongs to another member comes back as \`ENTRY_NOT_FOUND\`, so restoring the same entry twice fails on the second call rather than changing anything.

Returns the entry as it now stands and the day's new total.`;

export const restoreEntryTool: McpTool = {
  name: "time_restore_entry",
  scope: "time:write",
  register(server, actor) {
    server.registerTool(
      "time_restore_entry",
      {
        title: "Restore deleted entry",
        description: DESCRIPTION,
        inputSchema,
        outputSchema: mutationResult,
        annotations: RESTORE_ANNOTATIONS,
      },
      async (args) =>
        runTool("time_restore_entry", async () => {
          await restoreTimeEntry({
            memberId: actor.member.id,
            // Both, and both the actor's own. The domain layer treats a mismatch as an admin
            // correction; passing the same id twice is the structural guarantee that an agent can
            // only ever write against the member it was issued a token for.
            actorMemberId: actor.member.id,
            timeEntryId: args.entryId,
            requestMetadata: actor.requestMetadata,
          });

          // No `includeDeleted`: the row is live again, so the ordinary read is the proof that the
          // restore actually took rather than a second query answering from the deleted copy.
          const result = await readMutationResult(actor, { entryId: args.entryId });

          if (!result) {
            /*
             * `ENTRY_NOT_FOUND`, not `INTERNAL`. A missing echo after a successful restore has a
             * plausible non-bug cause — the entry was deleted again between the write and the read,
             * by the member in the web app or by a second agent turn — and that is a state the model
             * can act on. `INTERNAL` would be a dead end for exactly the same situation.
             */
            return fail("ENTRY_NOT_FOUND", "That entry could not be read back after the restore.", {
              entryId: args.entryId,
            });
          }

          return ok(result, [
            `Restored: ${entryLine(result.entry)}`,
            `${result.day.date} total: ${result.day.totalText}`,
            ...result.warnings,
          ]);
        }),
    );
  },
};
