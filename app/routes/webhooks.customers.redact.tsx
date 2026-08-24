import type { ActionFunctionArgs } from "react-router";
import { parseCustomerRedactPayload } from "../lib/compliance";
import { redactCustomerOrderData } from "../lib/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const parsed = parseCustomerRedactPayload(
    payload as Record<string, unknown>,
  );
  const deleted = await redactCustomerOrderData(shop, parsed.ordersToRedact);

  console.log(
    `[SharedStock] ${topic} for ${shop} deletedProcessedOrders=${deleted}`,
  );

  return new Response();
};
