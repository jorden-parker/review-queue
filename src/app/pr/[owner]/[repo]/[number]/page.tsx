import { notFound } from "next/navigation";
import { ReviewLoader } from "@/components/review/review-loader";
import { refFromParams } from "@/lib/pr-ref";

type ReviewPageProps = { params: Promise<{ owner: string; repo: string; number: string }> };

export default async function ReviewPage({ params }: ReviewPageProps) {
  const ref = refFromParams(await params);
  if (!ref) notFound();
  return <ReviewLoader pullRequest={ref} />;
}
