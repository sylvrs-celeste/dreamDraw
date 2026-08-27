import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../hooks/useSession";

/** Client-side gate. Convenience only -- it hides admin screens from someone
 *  who is not signed in, but every mutating endpoint checks the session
 *  server-side regardless. Nothing here is a security boundary. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <p className="py-24 text-center text-stock/40">…</p>;

  if (!authenticated) {
    // Remember where they were going so login can send them back.
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
