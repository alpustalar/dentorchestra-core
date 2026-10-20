import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Props = {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
};

export function ProfileSection({ title, action, onAction, children }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {action ? (
          <Button variant="outline" size="sm" onClick={onAction}>
            <Plus data-icon="inline-start" />
            {action}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  );
}
