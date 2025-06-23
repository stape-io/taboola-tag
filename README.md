# Taboola Tag for Google Tag Manager Server Container

The **Taboola Tag for GTM Server Side** enables server-to-server (S2S) conversion tracking by sending event data directly to Taboola. It supports both **PageView** and **Conversion** events and is fully configurable for deduplication, cookie handling, consent, and logging.

## How to Use the Taboola Tag

The template supports two types of events:

### PageView

When a user clicks on a Taboola ad, a `{click_id}` (e.g., `tblci`) is appended to the landing page URL. This tag will:

- Extract the click ID from the specified URL parameter.
- Store it in the `taboola_cid` cookie.
- Allow configuration of:
  - Parameter name
  - Cookie expiration time
  - Cookie domain

This click ID is then used later for conversion tracking.

### Conversion

When a conversion occurs, the tag:

- Sends an HTTP POST request to Taboola’s server-side conversion endpoint.
- Includes key parameters such as:
  - **Event Name** (required)
  - **Revenue** (optional)
  - **Currency** (optional)
  - **Order ID** (optional)
  - **Click ID** (from override, `taboola_cid` cookie, or common cookie)

#### Optional: Send Event from Browser

- Enable this option to also send the event from the browser.
- Helps deduplicate client and server-side events using a shared Event ID.
- When enabled, additional parameters such as **Account ID**, **GDPR/CCPA consent strings**, and others may be included.
- Useful for hybrid tracking and attribution consistency.

#### Additional Features

- **Event Deduplication**
  Optionally send the event from the browser with a matching Event ID for deduplication across client and server.

- **Consent Mode**
  Choose to send data only when marketing consent is given, or always.

- **IP Redaction**
  You can choose to redact or include the user’s IP in the HTTP headers.

- **Logging Options**
  Supports logging to console (debug/always/never) and BigQuery (with configurable project, dataset, and table).

### Useful Resources

- [Taboola server-side tracking using server Google Tag Manager](https://stape.io/blog/taboola-server-side-tracking-using-server-google-tag-manager)

## Open Source

The **Taboola Tag for GTM Server Side** is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
