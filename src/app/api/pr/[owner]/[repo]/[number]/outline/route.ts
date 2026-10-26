import { fileLookupRoute } from "@/lib/review/symbol-query";
import { outlineOf } from "@/lib/symbols/outline";

export const GET = fileLookupRoute((prepared, file) =>
  outlineOf(prepared.index.definitionsIn(file.path)),
);
