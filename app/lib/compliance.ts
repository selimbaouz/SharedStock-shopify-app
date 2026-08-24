export function orderIdLookupValues(id: string | number): string[] {
  const raw = String(id).trim();
  if (!raw) return [];
  const numeric = raw.replace(/^gid:\/\/shopify\/Order\//, "");
  return [...new Set([raw, numeric, `gid://shopify/Order/${numeric}`])];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

export function parseShopRedactPayload(
  payload: Record<string, unknown>,
): { shopDomain: string | null } {
  const shopDomain =
    payload.shop_domain == null ? null : String(payload.shop_domain).trim();
  return { shopDomain: shopDomain || null };
}

export function parseCustomerRedactPayload(
  payload: Record<string, unknown>,
): { shopDomain: string | null; ordersToRedact: string[] } {
  const { shopDomain } = parseShopRedactPayload(payload);
  return {
    shopDomain,
    ordersToRedact: readIdList(payload.orders_to_redact),
  };
}

export function parseCustomerDataRequestPayload(
  payload: Record<string, unknown>,
): {
  shopDomain: string | null;
  dataRequestId: string | null;
  ordersRequested: string[];
} {
  const { shopDomain } = parseShopRedactPayload(payload);
  const dataRequest = asRecord(payload.data_request);
  const dataRequestId =
    dataRequest?.id == null ? null : String(dataRequest.id).trim();

  return {
    shopDomain,
    dataRequestId: dataRequestId || null,
    ordersRequested: readIdList(payload.orders_requested),
  };
}
