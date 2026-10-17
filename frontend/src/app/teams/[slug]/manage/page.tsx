import { TeamManager } from "@/components/management/TeamManager";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <TeamManager slug={(await params).slug} />;
}
