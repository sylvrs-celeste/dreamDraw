import { NavLink, Outlet } from "react-router-dom";

import { useLogout, useSession } from "../hooks/useSession";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-1.5 rounded-sm transition-colors",
    isActive ? "text-stock" : "text-stock/55 hover:text-stock/85",
  ].join(" ");

export default function Layout() {
  const { authenticated } = useSession();
  const logout = useLogout();

  return (
    // z-10 lifts the content above the grain overlay painted on body::before.
    <div className="relative z-10 mx-auto min-h-dvh w-full max-w-[2560px] px-4 sm:px-8">
      <header className="flex items-baseline gap-6 py-8">
        <NavLink to="/" className="font-hand text-2xl text-stock">
          dreamDraw
        </NavLink>
        <nav className="flex gap-1 text-sm" aria-label="Main">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/gallery" className={linkClass}>
            Gallery
          </NavLink>
          <NavLink to="/timeline" className={linkClass}>
            Timeline
          </NavLink>
        </nav>

        {/* Admin chrome only appears once signed in. Its own landmark: these
            are navigation links, and burying them in a bare div hides them
            from anyone moving between landmarks. */}
        {authenticated && (
          <nav aria-label="Studio" className="ml-auto flex items-center gap-4 text-sm">
            <NavLink to="/admin" className={linkClass}>
              Studio
            </NavLink>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="text-stock/40 hover:text-stock/75"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="pb-24">
        <Outlet />
      </main>
    </div>
  );
}
