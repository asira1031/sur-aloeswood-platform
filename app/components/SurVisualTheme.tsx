"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Presentation only: does not read sessions, fetch data, or grant access. */
export default function SurVisualTheme({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const protectedTools = /^\/(admin\/(toh|guardian|recovery)|investor\/recovery)(\/|$)/.test(pathname);
  if (pathname === "/" || protectedTools) return <>{children}</>;
  const area = pathname.startsWith("/admin") ? "admin" : pathname.startsWith("/farmer") ? "caretaker" : "customer";
  return <div className="sur-design" data-sur-area={area}>{children}</div>;
}
