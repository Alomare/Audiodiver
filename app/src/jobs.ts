import { t } from "@lingui/core/macro";

/** A background job's kind in words: [what it is, what it is doing]. The first is a noun (a build, an export), with a
    context that keeps it apart from the buttons with the same English. */
export const JOB_NAMES: Record<string, [string, string]> = {
  build: [t({ message: "Build", context: "Name of a background job" }), t`Building`],
  import: [t({ message: "Import", context: "Name of a background job" }), t`Importing`],
  export: [t({ message: "Export", context: "Name of a background job" }), t`Exporting`],
  repatch: [t({ message: "Repatch", context: "Name of a background job" }), t`Repatching`],
  pack: [t({ message: "Pack", context: "Name of a background job" }), t`Packing`],
  unpack: [t({ message: "Unpack", context: "Name of a background job" }), t`Unpacking`],
  check: [t({ message: "Check", context: "Name of a background job" }), t`Checking`],
  combine_read: [t`Conflict check`, t`Checking for conflicts`],
  combine: [t({ message: "Combine", context: "Name of a background job" }), t`Combining`],
};
