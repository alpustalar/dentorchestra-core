export function TopbarTitle() {
  return (
    <div className="flex flex-col leading-tight">
      <h1 className="text-base font-semibold text-foreground md:text-lg truncate">
        Genel Bakış
      </h1>
      <p className="hidden text-xs text-muted-foreground sm:block truncate">
        Salı, 9 Ağustos 2026
      </p>
    </div>
  );
}
