import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { useEffect, type ReactNode } from "react";
import { getToken } from "@/lib/auth";

import { trpc } from "./trpc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 0, gcTime: 0 },
  },
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = getToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          cache: "no-store",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const clear = () => {void queryClient.cancelQueries();queryClient.clear();};
    window.addEventListener('quickchat-account-change',clear);
    return () => window.removeEventListener('quickchat-account-change',clear);
  }, []);
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
