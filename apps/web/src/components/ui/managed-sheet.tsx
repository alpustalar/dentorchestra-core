'use client';

import * as React from 'react';
import { useRef, useState } from 'react';
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

// ─── Context ──────────────────────────────────────

type ManagedSheetContextValue = {
  dismissOnOutside: boolean;
  setDismissOnOutside: React.Dispatch<React.SetStateAction<boolean>>;
  closeSheet: () => void;
};

const ManagedSheetContext =
  React.createContext<ManagedSheetContextValue | null>(null);

function useManagedSheet() {
  const context = React.useContext(ManagedSheetContext);

  if (!context) {
    throw new Error(
      'ManagedSheet components must be used inside ManagedSheet.'
    );
  }

  return context;
}

// ─── Main component ───────────────────────────────

type ManagedSheetProps = Omit<
  React.ComponentProps<typeof SheetContent>,
  'children'
> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function ManagedSheetRoot({
  open,
  onOpenChange,
  children,
  className,
  ...props
}: ManagedSheetProps) {
  const [dismissOnOutside, setDismissOnOutside] = useState(true);
  const [shake, setShake] = useState(false);

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || dismissOnOutside) {
      onOpenChange(nextOpen);
      return;
    }

    setShake(false);

    requestAnimationFrame(() => {
      setShake(true);
    });

    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
    }

    shakeTimerRef.current = setTimeout(() => {
      setShake(false);
      shakeTimerRef.current = null;
    }, 520);
  };

  const closeSheet = () => onOpenChange(false);

  const contextValue = React.useMemo(
    () => ({
      dismissOnOutside,
      setDismissOnOutside,
      closeSheet,
    }),
    [dismissOnOutside, onOpenChange]
  );

  return (
    <ManagedSheetContext.Provider value={contextValue}>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          {...props}
          showCloseButton={false}
          className={cn(shake && 'animate-sheet-shake', className)}
        >
          {children}
        </SheetContent>
      </Sheet>
    </ManagedSheetContext.Provider>
  );
}

// ─── Header ───────────────────────────────────────

type HeaderProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

function Header({ title, description, children, className }: HeaderProps) {
  const { dismissOnOutside } = useManagedSheet();

  return (
    <SheetHeader className={cn('border-b border-border px-5 py-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SheetTitle>{title}</SheetTitle>

          {description && <SheetDescription>{description}</SheetDescription>}
        </div>

        <div className="flex items-center gap-1">{children}</div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {dismissOnOutside
          ? 'Pencere dışına tıklayınca kapanır.'
          : 'Pencere dışına tıklayınca kapanmaz; kapatmak için X kullanın.'}
      </p>
    </SheetHeader>
  );
}

// ─── Settings ─────────────────────────────────────

function Settings() {
  const { dismissOnOutside, setDismissOnOutside } = useManagedSheet();

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Drawer ayarlarını aç"
        aria-expanded={settingsOpen}
        title="Drawer ayarları"
        onClick={() => setSettingsOpen((value) => !value)}
      >
        <Settings2 />
      </Button>

      {settingsOpen && (
        <div
          role="dialog"
          aria-label="Drawer ayarları"
          className="absolute right-0 top-10 z-10 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="mb-2 text-sm font-medium">Drawer ayarları</div>

          <button
            type="button"
            aria-pressed={dismissOnOutside}
            className="flex w-full items-start gap-3 rounded-md p-2 text-left text-sm hover:bg-muted"
            onClick={() => setDismissOnOutside((value) => !value)}
          >
            <span
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                dismissOnOutside &&
                  'border-primary bg-primary text-primary-foreground'
              )}
            >
              {dismissOnOutside && <Check />}
            </span>

            <span>
              <span className="block font-medium">Dışarı tıklayınca kapat</span>

              <span className="text-xs text-muted-foreground">
                Kapalıysa drawer kapanmaz ve kısa süre titrer.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Close ────────────────────────────────────────

function Close() {
  const { closeSheet } = useManagedSheet();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Kapat"
      onClick={closeSheet}
    >
      <X />
    </Button>
  );
}

// ─── Content & Footer ─────────────────────────────

type ContentProps = React.HTMLAttributes<HTMLDivElement>;

function Content({ className, ...props }: ContentProps) {
  return <div className={className} {...props} />;
}

type FooterProps = React.HTMLAttributes<HTMLDivElement>;

function Footer({ className, ...props }: FooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border px-5 py-4',
        className
      )}
      {...props}
    />
  );
}

export const ManagedSheet = Object.assign(ManagedSheetRoot, {
  Header,
  Settings,
  Close,
  Content,
  Footer,
});

export default ManagedSheet;
