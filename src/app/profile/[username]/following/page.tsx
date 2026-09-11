import { FollowList } from "@/components/FollowList";

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FollowList username={username} direction="following" />;
}
