"use client";

import { MenuSection } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import {
  playAchievement,
  playCashOut,
  playCountdown,
  playError,
  playKeyPress,
  playKeyRelease,
  playLose,
  playSfx,
  playStepUp,
  playTick,
  playWhoosh,
  playWin,
  type SfxName,
  type Voice,
} from "@/lib/sound";

const SAMPLES: SfxName[] = ["tap", "swipe", "toggleOn", "toggleOff", "disabled"];

const SYNTH: [string, () => void][] = [
  ["Win", playWin],
  ["Lose", playLose],
  ["Cash out", playCashOut],
  ["Achievement", playAchievement],
  ["Whoosh", playWhoosh],
  ["Tick", playTick],
  ["Error", playError],
  ["Countdown", playCountdown],
  ["Step ladder", () => [0, 8, 16, 24, 32, 40].forEach((s, i) => setTimeout(() => playStepUp(s), i * 90))],
];

const VOICES: Voice[] = [
  "main",
  "action1",
  "action2",
  "menu",
  "home",
  "knob",
  "thumbwheel",
];

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 p-3">{children}</div>;
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TapTarget
      sfx={null}
      className="rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-xs font-bold text-text-2"
      onClick={onClick}
    >
      {label}
    </TapTarget>
  );
}

export default function DevSoundsPage() {
  return (
    <>
      <MenuSection title="UI samples">
        <Grid>
          {SAMPLES.map((name) => (
            <Btn key={name} label={name} onClick={() => playSfx(name)} />
          ))}
        </Grid>
      </MenuSection>

      <MenuSection title="Synth stingers">
        <Grid>
          {SYNTH.map(([label, fn]) => (
            <Btn key={label} label={label} onClick={fn} />
          ))}
        </Grid>
      </MenuSection>

      <MenuSection title="Console hardware">
        <Grid>
          {VOICES.map((voice) => (
            <Btn
              key={voice}
              label={voice}
              onClick={() => {
                playKeyPress(voice);
                setTimeout(() => playKeyRelease(voice), 90);
              }}
            />
          ))}
        </Grid>
      </MenuSection>

      <p className="px-1 text-[11px] leading-relaxed text-text-3">
        Each hardware voice has its own detune, gain, filter and pan profile, so
        repeated presses never sound identical. If a sample fails to load the
        voice falls back to a synth click shaped by the same profile.
      </p>
    </>
  );
}
