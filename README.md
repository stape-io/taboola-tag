# Taboola s2s tag for Google Tag Manager Server Side

When a user clicks on an ad, the {click_id} parameter is generated in their URL. Our tag will store {click_id} inside the taboola_cid cookie. 
When a conversion event triggers, it sends a request to Taboola Postback URL with click_id, event name, value, and currency.

## How to use the Taboola s2s tag

Taboola tag can track two event types:

- PageView event captures Taboola {click_id} from a visitor's browser and stores it in taboola_cid cookie for later use. You can set the URL parameter name and cookie lifetime.
- Conversion events send a request to Taboola postback URL. Adding event name is mandatory, revenue and currency fields are optional.

### Useful links:
- [Taboola server-side tracking using server Google Tag Manager](https://stape.io/blog/taboola-server-side-tracking-using-server-google-tag-manager)

## Open Source

Taboola Tag for GTM Server Side is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
