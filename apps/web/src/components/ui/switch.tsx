'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={(state) =>
        cn(
          'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-muted-foreground/30 p-0.5 transition-colors outline-none data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          typeof className === 'function' ? className(state) : className
        )
      }
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none size-5 translate-x-0 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
