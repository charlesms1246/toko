"use client";

import { useSyncExternalStore } from "react";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import Switch from "@/components/ui/Switch";
import { useIsAdmin, useSettings, useStoreActions } from "@/lib/api/hooks";
import {
  MUSIC_PARTS,
  music,
  setSoundEnabled,
  VOLUME_DEFAULTS,
} from "@/lib/sound";
import { setHapticsEnabled } from "@/lib/haptics";
import TapTarget from "@/components/ui/TapTarget";
import { SkipBack, SkipForward, Play, Pause } from "lucide-react";

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0">
      <div className="flex-1">
        <div className="text-sm font-bold">{label}</div>
        {description && (
          <div className="text-[11px] text-text-3">{description}</div>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Fader({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs tabular-nums text-text-3">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-brand-500)]"
      />
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const actions = useStoreActions();
  const admin = useIsAdmin();

  const musicState = useSyncExternalStore(
    music.subscribe,
    music.getSnapshot,
    music.getServerSnapshot,
  );

  return (
    <>
      <MenuSection title="Feel">
        <SettingRow
          label="Confirm trades"
          description="Show a confirmation sheet before every play."
          checked={settings.confirmTrades}
          onChange={(v) => actions.updateSettings({ confirmTrades: v })}
        />
        <SettingRow
          label="Sounds"
          description="Key clicks, stingers and UI taps."
          checked={settings.sounds}
          onChange={(v) => {
            actions.updateSettings({ sounds: v });
            setSoundEnabled(v);
          }}
        />
        <SettingRow
          label="Haptics"
          description="Vibration on presses, detents and results."
          checked={settings.haptics}
          onChange={(v) => {
            actions.updateSettings({ haptics: v });
            setHapticsEnabled(v);
          }}
        />
        <SettingRow
          label="Reduce motion"
          description="Calms the backdrop drift and card springs."
          checked={settings.reduceMotion}
          onChange={(v) => actions.updateSettings({ reduceMotion: v })}
        />
      </MenuSection>

      <MenuSection title="Sound">
        <div className="border-b border-[var(--color-line)] px-4 py-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Now playing
          </div>
          <div className="mt-0.5 text-sm font-bold">{musicState.title}</div>
          <div className="mt-3 flex items-center gap-2">
            <TapTarget
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line-strong)] disabled:opacity-40"
              onClick={() => music.previousPart()}
              aria-label="Previous part"
            >
              <SkipBack size={16} />
            </TapTarget>
            <TapTarget
              className="grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-black"
              onClick={() => music.toggle()}
              aria-label={musicState.playing ? "Pause" : "Play"}
            >
              {musicState.playing ? <Pause size={18} /> : <Play size={18} />}
            </TapTarget>
            <TapTarget
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line-strong)]"
              onClick={() => music.nextPart()}
              aria-label="Next part"
            >
              <SkipForward size={16} />
            </TapTarget>
            <span className="ml-1 text-[11px] text-text-3">
              {MUSIC_PARTS.length} parts
            </span>
          </div>
        </div>

        <Fader
          label="SFX volume"
          value={musicState.sfxVolume}
          onChange={(v) => music.setSfxVolume(v)}
        />
        <Fader
          label="Background music volume"
          value={musicState.musicVolume}
          onChange={(v) => music.setMusicVolume(v)}
        />
        <MenuRow
          label="Reset to recommended"
          value={`${Math.round(VOLUME_DEFAULTS.music * 100)}%`}
          onClick={() => music.reset()}
        />
      </MenuSection>

      <MenuSection title="Developer">
        <SettingRow
          label="Admin mode"
          description="Unlocks the lab games and the admin dashboard."
          checked={admin}
          onChange={(v) => actions.setAdmin(v)}
        />
        <MenuRow label="Dev tools" href="/dev" />
      </MenuSection>
    </>
  );
}
