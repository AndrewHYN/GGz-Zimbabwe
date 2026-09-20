"use client";

import Image from "next/image";
import { use, useEffect, useState } from "react";

interface ProfileData {
  id: number;
  gamer_tag: string;
  avatar?: string | null;
  bio?: string | null;
  location?: string | null;
  platform?: string | null;
  follower_count: number;
  following_count: number;
  is_following: boolean;
  followers: unknown[];
  following: unknown[];
}

interface ProfilePageProps {
  params: Promise<{ gamerTag: string }>;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { gamerTag } = use(params);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/profiles/detail/${encodeURIComponent(gamerTag)}/`, {
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [gamerTag]);

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-primary">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-primary">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full">
            <Image
              src={profile.avatar ?? "/placeholder.svg"}
              alt={profile.gamer_tag}
              className="object-cover"
              fill
              sizes="80px"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ggz-text-primary">{profile.gamer_tag}</h1>
            <p className="text-ggz-text-secondary">{profile.follower_count} followers</p>
            <p className="text-ggz-text-secondary">{profile.following_count} following</p>
          </div>
        </div>

        {profile.bio && (
          <p className="text-ggz-text-secondary">{profile.bio}</p>
        )}

        {profile.location && (
          <p className="text-ggz-text-secondary">
            {profile.location}
          </p>
        )}

        {profile.platform && (
          <p className="text-ggz-text-secondary text-sm">
            {profile.platform}
          </p>
        )}

        <div className="mt-6">
          <h2 className="text-lg font-bold text-ggz-text-primary">Activity</h2>
          <p className="text-ggz-text-secondary">Profile activity coming soon</p>
        </div>
      </div>
    </div>
  );
}
