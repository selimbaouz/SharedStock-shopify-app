export function toShopifyGid(
  resource: "InventoryItem" | "Location" | "ProductVariant",
  id: string | number,
): string {
  const value = String(id).trim();
  if (value.startsWith("gid://")) return value;
  return `gid://shopify/${resource}/${value}`;
}

export function toInventoryItemLookupId(id: string | number): string {
  const value = String(id).trim();
  const match = value.match(/^(?:gid:\/\/shopify\/InventoryItem\/)?(\d+)$/);
  return match?.[1] ?? value;
}
