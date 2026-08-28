"use client";

import Image from "next/image";
import { useAchievements } from "@/lib/api/hooks";

export default function AchievementsPage() {
  const achievements = useAchievements();
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-bold">
          {unlocked} of {achievements.length}
        </span>
        <span className="text-xs text-text-3">
          {Math.round((unlocked / achievements.length) * 100)}% complete
        </span>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${(unlocked / achievements.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {achievements.map((achievement) => (
          <div
            key={achievement.slug}
            className="flex flex-col items-center rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-3 text-center"
            title={achievement.description}
          >
            <Image
              src={achievement.image}
              alt=""
              width={56}
              height={56}
              className={
                achievement.unlocked
                  ? ""
                  : "opacity-30 grayscale"
              }
            />
            <div
              className={`mt-2 text-[11px] font-bold leading-tight ${
                achievement.unlocked ? "text-text" : "text-text-3"
              }`}
            >
              {achievement.name}
            </div>
            {!achievement.unlocked && achievement.progress > 0 && (
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-text-3"
                  style={{ width: `${achievement.progress * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
