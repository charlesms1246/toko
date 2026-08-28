import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        404
      </span>
      <p className="text-sm font-bold text-text">No such screen.</p>
      <Link
        href="/games"
        className="mt-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-extrabold text-black"
      >
        Back to games
      </Link>
    </div>
  );
}
