import { Venue } from "@/components/management/Organizations";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Venue id={(await params).id} />;
}
