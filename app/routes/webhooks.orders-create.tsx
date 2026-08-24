import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deductComponentsForOrder } from "../lib/process-order.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic, payload, admin } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!session || !admin) {
    return new Response();
  }

  try {
    await deductComponentsForOrder({
      admin,
      shop,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[SharedStock] orders/create failed for ${shop}: ${message}`,
    );
  }

  return new Response();
};
