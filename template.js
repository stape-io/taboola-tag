const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

if (data.type === 'page_view') {
  const url = getEventData('page_location') || getRequestHeader('referer');

  if (url) {
    const value = parseUrl(url).searchParams[data.clickIdParameterName];

    if (value) {
      const options = {
        domain: 'auto',
        path: '/',
        secure: true,
        httpOnly: false
      };

      if (data.expiration > 0) options['max-age'] = data.expiration;

      setCookie('taboola_cid', value, options, false);
    }
  }
  return data.gtmOnSuccess();
} else {
  const commonCookie = getEventData('common_cookie') || {};
  const clickId =
    data.clickId || getCookieValues('taboola_cid')[0] || commonCookie.taboola_cid || '';

  if (!clickId) {
    log({
      Name: 'Taboola',
      Type: 'Message',
      EventName: data.eventName,
      Message: '⚠️ [WARNING] No Click ID found. Taboola request skipped.'
    });
    return data.gtmOnSuccess();
  }

  const requestUrl =
    'https://trc.taboola.com/actions-handler/log/3/s2s-action?name=' +
    enc(data.eventName) +
    '&click-id=' +
    enc(clickId) +
    '&revenue=' +
    enc(data.revenue) +
    '&currency=' +
    enc(data.currencyCode) +
    '&orderid=' +
    enc(data.orderId);

  sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    },
    { method: 'POST' }
  );
}

/*==============================================================================
Helpers
==============================================================================*/

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function enc(data) {
  if (['null', 'undefined'].indexOf(getType(data)) !== -1) data = '';
  return encodeUriComponent(makeString(data));
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
