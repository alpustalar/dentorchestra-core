'use client';

import { useUserFindOneWithUserIdOrEmail } from '@/api/generated/user-query/user-query';
import { useAuth } from '@/data/auth/auth-context';

function capitalizeDisplayName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => {
      const [first, ...rest] = part;
      return `${first?.toLocaleUpperCase('tr-TR') ?? ''}${rest
        .join('')
        .toLocaleLowerCase('tr-TR')}`;
    })
    .join(' ');
}

export function useCurrentUser() {
  const { actor, hasHydrated } = useAuth();
  const userQuery = useUserFindOneWithUserIdOrEmail(actor.userId, {
    query: {
      enabled: hasHydrated && Boolean(actor.userId),
    },
  });

  const displayName = capitalizeDisplayName(
    userQuery.data?.data.displayName || actor.email?.split('@')[0] || 'Kullanıcı'
  );
  const email = userQuery.data?.data.email || actor.email || '';
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('tr-TR');

  return {
    actor,
    displayName,
    email,
    initials: initials || '?',
    user: userQuery.data?.data,
    isLoading: userQuery.isLoading,
  };
}
