import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsButtonProps extends ComponentPropsWithoutRef<typeof Button> {
  hasNotification?: boolean;
}

export const SettingsButton = forwardRef<
  HTMLButtonElement,
  SettingsButtonProps
>(({ className, children, ...rest }, ref) => {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn('relative rounded-full shrink-0', className)}
      {...rest}
    >
      <Settings className="h-6 w-6" />

      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#ff4841] ring-2 ring-background" />

      <span className="sr-only">Ayarlar</span>
    </Button>
  );
});
