import type { ActionFunctionArgs } from "react-router";
import { parseCustomerDataRequestPayload } from "../lib/compliance";
import { findStoredOrderIds } from "../lib/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const parsed = parseCustomerDataRequestPayload(
    payload as Record<string, unknown>,
  );
  const storedOrderIds = await findStoredOrderIds(shop, parsed.ordersRequested);

  console.log(
    `[SharedStock] ${topic} for ${shop} request=${parsed.dataRequestId ?? "unknown"} storedOrderIds=${storedOrderIds.length}`,
  );

  return new Response();
};
