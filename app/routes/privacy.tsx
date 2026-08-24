import styles from "../styles/legal.module.css";

export const meta = () => [{ title: "Privacy policy — SharedStock" }];

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <p className={styles.nav}>
          <a href="/">SharedStock</a>
          <a href="/terms">Terms</a>
        </p>
        <h1>Privacy policy</h1>
        <p className={styles.updated}>Last updated: August 24, 2026</p>
        <p>
          SharedStock is an embedded Shopify app published by Brandionary. This
          policy explains what we store when a merchant installs the app. It
          applies to merchants and, where relevant, their customers.
        </p>

        <h2>Who we are</h2>
        <p>
          Brandionary operates SharedStock. Questions about this policy or a
          data request:{" "}
          <a href="mailto:hello@brandionary.com">hello@brandionary.com</a>.
        </p>

        <h2>What we collect</h2>
        <p>
          SharedStock syncs bundle inventory. We store only what that job
          needs:
        </p>
        <ul>
          <li>Shop domain and Shopify OAuth session (access token).</li>
          <li>
            Staff account fields Shopify sends during login (name, email), used
            only to keep the session valid.
          </li>
          <li>
            Bundle and component product variant IDs, inventory item IDs, and
            quantities needed per pack.
          </li>
          <li>
            Shopify order IDs after a bundle sale, so the same order is never
            deducted twice. We do not store customer names, emails, phone
            numbers, or addresses.
          </li>
        </ul>

        <h2>How we use data</h2>
        <p>
          We use this data to calculate pack availability, deduct component
          stock when a pack sells, and keep the app authenticated. We do not
          sell personal data, and we do not use it for advertising.
        </p>

        <h2>Where data is stored</h2>
        <p>
          The app and its database are hosted on Railway (PostgreSQL). Shopify
          also holds merchant and customer data under Shopify&apos;s own
          policies.
        </p>

        <h2>Sharing</h2>
        <p>
          We share data with Shopify (API calls required to sync inventory) and
          with our hosting provider. We do not share it with other third
          parties except if the law requires it.
        </p>

        <h2>Retention</h2>
        <p>
          Shop data is kept while the app is installed. After uninstall,
          Shopify asks us to delete shop data (typically within 48 hours). We
          then delete sessions, bundle links, and stored order IDs for that
          shop. Customer-related order IDs are deleted when Shopify sends a
          customer redaction request.
        </p>

        <h2>Your rights</h2>
        <p>
          Merchants can uninstall the app at any time. Shopify also forwards
          customer data and deletion requests to us. We respond to those
          webhooks and complete deletion within 30 days. For any other request,
          email{" "}
          <a href="mailto:hello@brandionary.com">hello@brandionary.com</a>.
        </p>

        <h2>Children</h2>
        <p>
          SharedStock is a merchant tool. It is not directed at children and
          does not knowingly collect data from children.
        </p>
      </article>
    </main>
  );
}
