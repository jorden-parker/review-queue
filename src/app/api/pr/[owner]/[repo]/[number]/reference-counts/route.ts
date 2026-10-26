import { referenceCountsIn } from "@/lib/review/reference-counts";
import { fileLookupRoute } from "@/lib/review/symbol-query";

export const GET = fileLookupRoute(referenceCountsIn);
