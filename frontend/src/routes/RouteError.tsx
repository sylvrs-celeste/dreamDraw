import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

/** Error boundary for the route tree.
 *
 *  Previously NotFound was wired up as the errorElement, which meant any
 *  render crash presented itself as "that page does not exist" -- so a real
 *  bug looked like a typo in the URL. Worth keeping them distinct.
 */
export default function RouteError() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6">
      <h1 className="font-hand text-4xl text-stock">Something broke</h1>
      <p className="mt-3 text-stock/60">
        Not your fault — the page failed to render.
      </p>

      {/* Shown in dev only. In production this would just leak internals at
          a visitor who can do nothing with them. */}
      {import.meta.env.DEV && (
        <pre className="mt-6 overflow-x-auto rounded bg-well p-4 text-xs text-accent-rust">
          {message}
          {error instanceof Error && error.stack && (
            <span className="block pt-2 text-stock/40">{error.stack}</span>
          )}
        </pre>
      )}

      <Link to="/" className="mt-8 text-sm underline underline-offset-4">
        Back to the start
      </Link>
    </div>
  );
}
