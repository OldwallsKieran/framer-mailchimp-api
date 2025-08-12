// api/mailchimp-signup.js
import crypto from "crypto";

/**
 * Expects environment variables:
 * - MAILCHIMP_API_KEY (e.g. 123abc-us10)
 * - MAILCHIMP_LIST_ID (your audience ID)
 *
 * NOTE: restrict CORS to your domain in production.
 */
export default async function handler(req, res) {
  // Basic CORS support (adjust origin in production)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*"); // <-- change "*" to your Framer domain for prod
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    email,
    firstName,
    lastName,
    phone,
    brouchureDownload,
    contactMethod,
    interestedVenue,
  } = req.body || {};

  if (!email) return res.status(400).json({ error: "Email required" });

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  if (!apiKey || !listId) {
    return res.status(500).json({ error: "Mailchimp env vars not set" });
  }

  // Data center is the suffix after the dash in the API key (e.g. "-us10")
  const dc = apiKey.split("-").pop();
  const subscriberHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

  const payload = {
    email_address: email,
    // status_if_new is useful when upserting (will subscribe new users)
    status_if_new: "subscribed",
    merge_fields: {
      FNAME: firstName || "",
      LNAME: lastName || "",
      PHONE: phone || "",
      MMERGE5: brouchureDownload || "",
      MMERGE6: contactMethod || "",
      MMERGE7: interestedVenue || "",
    },
  };

  try {
    // Upsert member
    const mcRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `apikey ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const mcData = await mcRes.json();
    if (!mcRes.ok) {
      return res.status(mcRes.status).json({ error: mcData });
    }

    // Add a tag (optional) — makes automations that watch for tags work reliably
    await fetch(`${url}/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `apikey ${apiKey}`,
      },
      body: JSON.stringify({ tags: [{ name: "Website Signup", status: "active" }] }),
    });

    return res.status(200).json({ success: true, data: mcData });
  } catch (err) {
    console.error("Mailchimp error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
