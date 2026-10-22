'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Check, Settings2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ManagedDialogLabels = {
  close: string;
  settings: string;
  settingsTitle: string;
  dismissOnOutside: string;
  dismissOnOutsideDescription: string;
  dismissEnabledStatus: string;
  dismissDisabledStatus: string;
};

type ManagedDialogContextValue = {
  dismissOnOutside: boolean;
  setDismissOnOutside: React.Dispatch<React.SetStateAction<boolean>>;
  closeDialog: () => void;
  labels: ManagedDialogLabels;
};

const ManagedDialogContext =
  React.createContext<ManagedDialogContextValue | null>(null);

function useManagedDialog() {
  const context = React.useContext(ManagedDialogContext);
  if (!context) {
    throw new Error(
      'ManagedDialog components must be used inside ManagedDialog.'
    );
  }
  return context;
}

type ManagedDialogProps = Omit<DialogPrimitive.Popup.Props, 'children'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: ManagedDialogLabels;
  children: React.ReactNode;
};

function ManagedDialogRoot({
  open,
  onOpenChange,
  labels,
  children,
  className,
  ...props
}: ManagedDialogProps) {
  const [dismissOnOutside, setDismissOnOutside] = React.useState(true);
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
    shakeTimerRef.current = setTimeout(() => {
      setShake(false);
      shakeTimerRef.current = null;
    }, 520);
  };

  const contextValue = React.useMemo(
    () => ({
      dismissOnOutside,
      setDismissOnOutside,
      closeDialog: () => onOpenChange(false),
      labels,
    }),
    [dismissOnOutside, labels, onOpenChange]
  );

  return (
    <ManagedDialogContext.Provider value={contextValue}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/35 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
          <DialogPrimitive.Popup
            {...props}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,900px)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background text-foreground shadow-2xl outline-none transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
              shake && 'animate-sheet-shake',
              className
            )}
          >
            {children}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ManagedDialogContext.Provider>
  );
}

function Header({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { dismissOnOutside, labels } = useManagedDialog();

  return (
    <header className={cn('border-b px-5 py-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-base font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {dismissOnOutside
          ? labels.dismissEnabledStatus
          : labels.dismissDisabledStatus}
      </p>
    </header>
  );
}

function Settings() {
  const { dismissOnOutside, setDismissOnOutside, labels } = useManagedDialog();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={labels.settings}
        aria-expanded={settingsOpen}
        title={labels.settings}
        onClick={() => setSettingsOpen((value) => !value)}
      >
        <Settings2 />
      </Button>
      {settingsOpen && (
        <div
          role="dialog"
          aria-label={labels.settingsTitle}
          className="absolute right-0 top-10 z-10 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="mb-2 text-sm font-medium">{labels.settingsTitle}</div>
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
              <span className="block font-medium">
                {labels.dismissOnOutside}
              </span>
              <span className="text-xs text-muted-foreground">
                {labels.dismissOnOutsideDescription}
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function Close() {
  const { closeDialog, labels } = useManagedDialog();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={labels.close}
      onClick={closeDialog}
    >
      <X />
    </Button>
  );
}

function Content({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function Footer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t px-5 py-4',
        className
      )}
      {...props}
    />
  );
}

export const ManagedDialog = Object.assign(ManagedDialogRoot, {
  Header,
  Settings,
  Close,
  Content,
  Footer,
});

export default ManagedDialog;
