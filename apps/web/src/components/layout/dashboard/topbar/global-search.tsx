'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function GlobalSearch() {

  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const isSearchExpanded = searchFocused || searchQuery.length > 0;

  return (
    <div className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        placeholder={
          isSearchExpanded ? t('Common.searchPlaceholder') : t('Common.search')
        }
        aria-label={t('Common.searchPlaceholder')}
        className={cn(
          'origin-right rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground transition-[width,box-shadow,border-color] duration-300 ease-out focus:border-ring focus:ring-2 focus:ring-ring/20',
          isSearchExpanded ? 'w-72' : 'w-28'
        )}
      />
    </div>
  );
}
