'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { AuthProvider } from '@/store/auth-store';
import { AlertProvider } from '@/store/alert-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          if (error?.status === 404) return false;
          return failureCount < 3;
        },
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AlertProvider>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </AlertProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}