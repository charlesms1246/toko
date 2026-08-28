"use client";

/**
 * The universal tap target.
 *
 * Everything tappable in the app goes through this so sound and haptics are
 * consistent: a tap plays the `tap` sample, a disabled tap plays `disabled`,
 * and `sfx={null}` silences it.
 */

import Link from "next/link";
import { forwardRef } from "react";
import haptics, { type PressPreset } from "@/lib/haptics";
import { playSfx, type SfxName } from "@/lib/sound";

type Common = {
  sfx?: SfxName | null;
  haptic?: PressPreset | null;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type ButtonProps = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
    href?: undefined;
  };

type LinkProps = Common &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type TapTargetProps = ButtonProps | LinkProps;

function feedback(sfx: SfxName | null, haptic: PressPreset | null, disabled: boolean) {
  if (disabled) {
    playSfx("disabled");
    return;
  }
  if (sfx) playSfx(sfx);
  if (haptic) haptics.press(haptic);
}

const TapTarget = forwardRef<HTMLElement, TapTargetProps>(function TapTarget(
  { sfx = "tap", haptic = "tick", disabled = false, className, children, ...rest },
  ref,
) {
  if ("href" in rest && rest.href !== undefined) {
    const { href, onClick, ...anchorProps } = rest as LinkProps;
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={className}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            playSfx("disabled");
            return;
          }
          feedback(sfx, haptic, false);
          onClick?.(event);
        }}
        {...anchorProps}
      >
        {children}
      </Link>
    );
  }

  const { onClick, type = "button", ...buttonProps } = rest as ButtonProps;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type as "button" | "submit" | "reset"}
      className={className}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          playSfx("disabled");
          return;
        }
        feedback(sfx, haptic, false);
        onClick?.(event);
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
});

export default TapTarget;
