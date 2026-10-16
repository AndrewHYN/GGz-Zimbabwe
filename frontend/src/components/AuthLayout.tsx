import Link from "next/link";
import { GamepadIcon } from "@/components/icons";
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[75vh] max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-2 lg:py-16">
      <aside className="hidden lg:block">
        <Link href="/" className="ggz-eyebrow">
          GGz / Zimbabwe’s player network
        </Link>
        <h2 className="mt-7 text-6xl font-extrabold leading-[1.05] tracking-[-.05em]">
          You bring
          <br />
          the game.
          <br />
          <span className="text-ggz-amber">
            We bring
            <br />
            the people.
          </span>
        </h2>
        <p className="mt-6 max-w-sm leading-7 text-ggz-text-secondary">
          Find teammates who get you. Compete close to home. Build a reputation
          that belongs to you.
        </p>
        <div className="mt-8 flex items-center gap-4 border-t border-ggz-border pt-6">
          <GamepadIcon size={38} className="text-ggz-amber" />
          <p className="text-xs uppercase tracking-widest text-ggz-text-muted">
            Local scene. Big energy.
          </p>
        </div>
      </aside>
      <div className="flex justify-center">{children}</div>
    </div>
  );
}
