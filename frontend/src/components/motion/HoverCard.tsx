"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

const MotionLink = motion.create(Link);

type SafeAnchorProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  | "onDrag"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDragStart"
  | "onDrop"
>;

interface HoverCardProps extends SafeAnchorProps {
  href: string;
  children: ReactNode;
  lift?: boolean;
}

export function HoverCard({ href, children, className = "", lift = true, ...props }: HoverCardProps) {
  return (
    <MotionLink
      href={href}
      className={className}
      whileHover={lift ? { y: -3 } : undefined}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 450, damping: 32 }}
      {...(props as object)}
    >
      {children}
    </MotionLink>
  );
}
