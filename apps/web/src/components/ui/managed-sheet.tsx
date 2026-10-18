'use client';

import * as React from 'react';
import { Check, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type ManagedSheetProps = React.ComponentProps<typeof SheetContent> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function ManagedSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  ...props
}: ManagedSheetProps) {
  const [dismissOnOutside, setDismissOnOutside] = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [shake, setShake] = React.useState(false);
  const shakeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(
    () => () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    },
    []
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || dismissOnOutside) {
      onOpenChange(nextOpen);
      return;
    }

    setShake(false);
    requestAnimationFrame(() => setShake(true));
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShake(false), 520);
  };

  const closeSheet = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        {...props}
        showCloseButton={false}
        className={cn(shake && 'animate-sheet-shake', className)}
      >
        <SheetHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle>{title}</SheetTitle>
              {description ? (
                <SheetDescription>{description}</SheetDescription>
              ) : null}
            </div>
            <div className="relative flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Drawer ayarlarını aç"
                aria-expanded={settingsOpen}
                title="Drawer ayarları"
                onClick={() => setSettingsOpen((value) => !value)}
              >
                <Settings2 data-icon="inline-start" />
              </Button>
              {settingsOpen ? (
                <div
                  role="dialog"
                  aria-label="Drawer ayarları"
                  className="absolute right-0 top-10 z-10 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
                >
                  <div className="mb-2 text-sm font-medium">
                    Drawer ayarları
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-md p-2 text-left text-sm hover:bg-muted"
                    onClick={() => setDismissOnOutside((value) => !value)}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 items-center justify-center rounded-sm border',
                        dismissOnOutside &&
                          'border-primary bg-primary text-primary-foreground'
                      )}
                    >
                      {dismissOnOutside ? <Check /> : null}
                    </span>
                    <span>
                      <span className="block font-medium">
                        Dışarı tıklayınca kapat
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Kapalıysa drawer kapanmaz ve kısa süre titrer.
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Kapat"
                onClick={closeSheet}
              >
                <X data-icon="inline-start" />
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {dismissOnOutside
              ? 'Pencere dışına tıklayınca kapanır.'
              : 'Pencere dışına tıklayınca kapanmaz; kapatmak için X kullanın.'}
          </p>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export default ManagedSheet;
