import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-1.5 rounded-sm transition-colors",
    isActive ? "text-stock" : "text-stock/55 hover:text-stock/85",
  ].join(" ");

export default function Layout() {
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
      </header>

      <main className="pb-24">
        <Outlet />
      </main>
    </div>
  );
}
