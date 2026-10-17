import { Organizations } from "@/components/management/Organizations";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <Organizations slug={(await params).slug} />;
}
