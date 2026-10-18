import { Card, CardContent } from '@/components/ui/card';

type Props = {
  icon: React.ElementType;
  title: string;
  value: string;
  detail: string;
};

export function OverviewCard({ icon: Icon, title, value, detail }: Props) {
  return (
    <Card>
      <CardContent className="flex min-h-32 flex-col justify-between p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon />
          {title}
        </div>
        <div>
          <div className="mt-4 font-semibold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}
