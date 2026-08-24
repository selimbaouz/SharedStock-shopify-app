import type { ActionFunctionArgs } from "react-router";

// Placeholder required by Shopify CLI 4.7 (`[[events.subscription]]`).
// SharedStock still uses webhooks for inventory/order sync.
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  return new Response(null, { status: 200 });
};
