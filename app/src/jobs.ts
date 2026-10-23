/** A background job's kind in words: [what it is, what it is doing]. */
export const JOB_NAMES: Record<string, [string, string]> = {
  build: ["Build", "Building"], import: ["Import", "Importing"], export: ["Export", "Exporting"], repatch: ["Repatch", "Repatching"],
  pack: ["Pack", "Packing"], unpack: ["Unpack", "Unpacking"], check: ["Check", "Checking"],
  combine_read: ["Conflict check", "Checking for conflicts"], combine: ["Combine", "Combining"],
};
