const BigQuery = require('BigQuery');
const encodeUriComponent = require('encodeUriComponent');
const generateRandom = require('generateRandom');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const getTimestampMillis = require('getTimestampMillis');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const parseUrl = require('parseUrl');
const sendPixelFromBrowser = require('sendPixelFromBrowser');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const traceId = getRequestHeader('trace-id');
const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired()) {
  return data.gtmOnSuccess();
}

const url = eventData.page_location || getRequestHeader('referer');
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const actionHandlers = {
  page_view: handlePageViewEvent,
  conversion: handleConversionEvent
};

const handler = actionHandlers[data.type];
if (handler) {
  handler(data, eventData);
} else {
  return data.gtmOnFailure();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function handlePageViewEvent(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');

  if (url) {
    const value = parseUrl(url).searchParams[data.clickIdParameterName];

    if (value) {
      const options = {
        domain: data.cookieDomain || 'auto',
        path: '/',
        secure: true,
        httpOnly: false
      };

      if (data.expiration > 0) options['max-age'] = data.expiration;

      setCookie('taboola_cid', value, options, false);
    }
  }

  return data.gtmOnSuccess();
}

function handleConversionEvent(data, eventData) {
  const commonCookie = eventData.common_cookie || {};
  const clickId =
    data.clickId || getCookieValues('taboola_cid')[0] || commonCookie.taboola_cid || '';

  const eventId = getEventId(data, eventData);

  if (
    isUIFieldTrue(data.sendEventFromBrowser) &&
    data.accountId /* Backward compatibility check */
  ) {
    let unipPixelUrl =
      'https://trc.taboola.com/' +
      data.accountId +
      '/log/3/unip?it=sGTM' +
      '&en=' +
      enc(data.eventName) +
      '&tim=' +
      enc(getTimestampMillis());

    if (clickId) unipPixelUrl += '&tblci=' + enc(clickId);
    if (eventId) unipPixelUrl += '&event_id=' + enc(eventId);

    const sstSystemProperties = eventData['x-sst-system_properties'] || {};

    const gdprConsent = data.hasOwnProperty('gdprConsent')
      ? data.gdprConsent
      : sstSystemProperties.gdpr_consent;
    if (gdprConsent) unipPixelUrl += '&gdpr_consent=' + enc(gdprConsent);

    const gdpr = data.hasOwnProperty('gdpr') ? data.gdpr : sstSystemProperties.gdpr;
    if (isValidValue(gdpr)) unipPixelUrl += '&gdpr=' + enc(gdpr);

    const gpp = data.hasOwnProperty('gpp') ? data.gpp : sstSystemProperties.gpp;
    if (gpp) unipPixelUrl += '&gpp=' + enc(gpp);

    const gppSid = data.hasOwnProperty('gppSid') ? data.gppSid : sstSystemProperties.gpp_sid;
    if (gppSid) unipPixelUrl += '&gpp_sid=' + enc(gppSid);

    const ccpa = data.hasOwnProperty('ccpa') ? data.ccpa : sstSystemProperties.us_privacy;
    if (ccpa) unipPixelUrl += '&ccpa_ps=' + enc(ccpa);

    sendPixelFromBrowser(unipPixelUrl);
  }

  if (!clickId) {
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
    enc(data.orderId) +
    (eventId ? '&event_id=' + enc(eventId) : '');

  log({
    Name: 'Taboola',
    Type: 'Request',
    TraceId: traceId,
    EventName: data.eventName,
    RequestMethod: 'POST',
    RequestUrl: requestUrl
  });

  sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'Taboola',
        Type: 'Response',
        TraceId: traceId,
        EventName: data.eventName,
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    },
    {
      headers: generateRequestHeaders(data, eventData),
      method: 'POST'
    }
  );
}

function generateRequestHeaders(data, eventData) {
  const requestHeaders = {};
  if (
    data.hasOwnProperty('redactIpAddress') /* Backward compatibility check */ &&
    !isUIFieldTrue(data.redactIpAddress) &&
    eventData.ip_override
  ) {
    requestHeaders['X-Forwarded-For'] = eventData.ip_override;
  }
  return requestHeaders;
}

/*==============================================================================
  Helpers
==============================================================================*/

function getEventId(data, eventData) {
  return (
    data.eventId ||
    eventData.eventId ||
    eventData.event_id ||
    eventData.unique_event_id ||
    eventData.transaction_id ||
    getTimestampMillis() + '_' + generateRandom(100000000, 999999999)
  );
}

function isUIFieldTrue(field) {
  return [true, 'true'].indexOf(field) !== -1;
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function enc(data) {
  if (data === undefined || data === null) data = '';
  return encodeUriComponent(makeString(data));
}

function isConsentGivenOrNotRequired() {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  const bigquery =
    getType(BigQuery) === 'function' ? BigQuery() /* Only during Unit Tests */ : BigQuery;
  bigquery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
