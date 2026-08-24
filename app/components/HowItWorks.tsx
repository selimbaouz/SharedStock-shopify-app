export function HowItWorks() {
  return (
    <s-section heading="How it works">
      <s-stack gap="base">
        <s-paragraph>
          SharedStock does not create your packs. It syncs inventory between an
          existing pack and its products, so you don't oversell.
        </s-paragraph>
        <s-ordered-list>
          <s-list-item>
            Choose the pack product you already created in Shopify.
          </s-list-item>
          <s-list-item>
            Link the products sold individually and how many of each go into
            one pack.
          </s-list-item>
          <s-list-item>
            SharedStock calculates pack stock and updates it on every sale.
          </s-list-item>
        </s-ordered-list>
        <s-paragraph>
          Example: 6 red tees and 10 yellow tees, pack = 1 red + 1 yellow → pack
          stock = 6. If a red tee sells on its own, the pack drops to 5.
        </s-paragraph>
      </s-stack>
    </s-section>
  );
}
