import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useLogin, useSession } from "../../hooks/useSession";
import { ApiError } from "../../api/client";

export default function Login() {
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, isPending } = useSession();

  // Already signed in: go where they were headed rather than showing a form
  // that would just bounce them anyway.
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
  if (!isPending && authenticated) return <Navigate to={from} replace />;

  const error =
    login.error instanceof ApiError
      ? login.error.status === 429
        ? "Too many attempts. Wait a few minutes."
        : "That password is not right."
      : login.error
        ? "Could not reach the server."
        : null;

  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-sm flex-col justify-center">
      <h1 className="font-hand text-4xl text-stock">Let yourself in</h1>
      <p className="mt-2 text-sm text-stock/50">Only you can add to the wall.</p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate(password, { onSuccess: () => navigate(from, { replace: true }) });
        }}
      >
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-sm border border-stock/20 bg-surface px-4 py-3
                     text-stock placeholder:text-stock/30"
          placeholder="Password"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-accent-rust">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending || password.length === 0}
          className="mt-5 w-full rounded-full bg-stock px-6 py-3 text-sm font-medium
                     text-canvas disabled:opacity-40"
        >
          {login.isPending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
