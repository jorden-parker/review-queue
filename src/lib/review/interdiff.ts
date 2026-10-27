import { prepareFiles, type PreparedFile, type PreparedReview } from "./prepare";

export type Interdiff = { baselineHeadSha: string; headSha: string; files: PreparedFile[] };

export async function interdiffFor(
  review: PreparedReview,
  baselineHeadSha: string,
): Promise<Interdiff> {
  const files = await prepareFiles(await review.diffFrom(baselineHeadSha));
  return { baselineHeadSha, headSha: review.data.headSha, files };
}
