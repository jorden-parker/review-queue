import { withPreparedReview } from "@/lib/review/route-context";

export const GET = withPreparedReview(async (_request, prepared) =>
  Response.json({ paths: await prepared.index.listFiles() }),
);
