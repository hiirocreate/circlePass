type Props = {
  shop: { name?: string; logo_url?: string | null } | null;
};

export function ShopHeader({ shop }: Props) {
  if (!shop) return null;

  return (
    <header className="flex items-center gap-3 pb-1">
      {shop.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
      )}
      <p className="text-sm font-semibold text-black/60">{shop.name ?? "店舗"}</p>
    </header>
  );
}
