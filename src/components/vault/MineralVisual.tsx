import { cn } from "@/lib/utils";
import {
  Coins,
  Gem,
  Layers3,
  Mountain,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Mineral, MineralType } from "@/lib/vault/types";

const TYPE_ICONS: Record<MineralType, LucideIcon> = {
  "Gold Bar": Layers3,
  "Gold Coin": Coins,
  "Gold Nugget": Sparkles,
  "Silver Bar": Layers3,
  Diamond: Gem,
  Emerald: Gem,
  Ruby: Gem,
  Sapphire: Gem,
  "Platinum Coin": Coins,
  "Rare Earth": Mountain,
};

function fallbackClass(type: MineralType) {
  if (type === "Gold Bar" || type === "Gold Coin" || type === "Gold Nugget") {
    return "from-[#2b1d06] via-[#0d0903] to-[#050403] text-[#f6d58b]";
  }
  if (type === "Silver Bar" || type === "Platinum Coin") {
    return "from-[#24303d] via-[#0b1118] to-[#05080d] text-[#dbe8f4]";
  }
  if (type === "Diamond") {
    return "from-[#263342] via-[#0b111a] to-[#04070c] text-[#e7f1ff]";
  }
  if (type === "Emerald") {
    return "from-[#0b2b20] via-[#06120e] to-[#030806] text-[#9dffdc]";
  }
  if (type === "Ruby") {
    return "from-[#2d0a12] via-[#120509] to-[#070203] text-[#ffb7c4]";
  }
  if (type === "Sapphire") {
    return "from-[#111f3c] via-[#070d1d] to-[#02050c] text-[#bdd3ff]";
  }
  return "from-[#20241f] via-[#0b0f0d] to-[#040706] text-[#d3e8df]";
}

export function MineralVisual({
  mineral,
  className,
  imageClassName,
  overlay = true,
  children,
}: {
  mineral: Pick<Mineral, "photos" | "name" | "type" | "vaultId">;
  className?: string;
  imageClassName?: string;
  overlay?: boolean;
  children?: ReactNode;
}) {
  const src = mineral.photos[0];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  const Icon = TYPE_ICONS[mineral.type] ?? Gem;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-[#071227]",
        className,
      )}
    >
      {failed ? (
        <div
          className={cn(
            "starfield absolute inset-0 grid place-items-center bg-gradient-to-br",
            fallbackClass(mineral.type),
          )}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.14),transparent_58%)]" />
          <div className="relative grid size-20 place-items-center rounded-full border border-white/15 bg-white/[0.04]">
            <Icon className="size-9" strokeWidth={1.1} />
          </div>
          <p className="absolute bottom-4 left-5 text-[0.55rem] font-semibold uppercase tracking-[0.24em] opacity-55">
            {mineral.type}
          </p>
        </div>
      ) : (
        <img
          src={src}
          alt={`${mineral.name}, ${mineral.type}, vault record ${mineral.vaultId}`}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]",
            imageClassName,
          )}
        />
      )}
      {overlay && (
        <>
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(4,10,20,0.86)_0%,rgba(4,10,20,0.18)_46%,rgba(4,10,20,0.02)_70%)]" />
          <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        </>
      )}
      {children}
    </div>
  );
}

export function MineralTypeIcon({
  type,
  className,
}: {
  type: MineralType;
  className?: string;
}) {
  const Icon = TYPE_ICONS[type] ?? Gem;
  return <Icon className={className} strokeWidth={1.8} />;
}
