import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { syncBundlesForInventoryUpdate } from "../lib/sync-bundle-inventory.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const startedAt = Date.now();

  const respond = () => {
    console.log(`Traitement webhook : ${Date.now() - startedAt}ms`);
    return new Response();
  };

  const { shop, session, topic, payload, admin } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!session || !admin) {
    return respond();
  }

  try {
    await syncBundlesForInventoryUpdate({
      admin,
      shop,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[SharedStock] inventory_levels/update failed for ${shop}: ${message}`,
    );
  }

  return respond();
};
