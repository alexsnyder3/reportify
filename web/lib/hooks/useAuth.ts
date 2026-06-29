'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe, login, logout, User } from '../auth';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { user, isLoading, isAuthenticated: !!user, error };
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(['me'], user);
      router.push('/dashboard');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.push('/login');
    },
  });
}
