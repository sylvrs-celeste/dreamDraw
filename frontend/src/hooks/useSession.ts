import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";

const KEY = ["session"];

export function useSession() {
  const query = useQuery({
    queryKey: KEY,
    queryFn: api.session,
    // Sessions expire after 24h and the cookie can be cleared in another tab,
    // so this is worth rechecking rather than trusting for half an hour.
    staleTime: 60 * 1000,
    retry: false,
  });
  return {
    authenticated: query.data?.authenticated ?? false,
    isPending: query.isPending,
  };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.login(password),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    // Everything is refetched: what the admin could see and what a visitor
    // can see are not the same, and stale admin data must not linger.
    onSuccess: () => qc.invalidateQueries(),
  });
}
