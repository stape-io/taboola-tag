const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
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
const BigQuery = require('BigQuery');
const getTimestampMillis = require('getTimestampMillis');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const isBigQueryLoggingEnabled = determinateIsLoggingEnabledForBigQuery();
const traceId = getRequestHeader('trace-id');

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
  data.gtmOnSuccess();
} else {
  const commonCookie = getEventData('common_cookie') || {};
  const clickId =
    data.clickId || getCookieValues('taboola_cid')[0] || commonCookie.taboola_cid || '';

  if (!clickId) {
    log({
      Name: 'Taboola',
      Type: 'Message',
      EventName: data.eventName,
      ResponseBody: 'No click ID found. Taboola request skipped.'
    });
    data.gtmOnSuccess();
    return;
  }

  let requestUrl =
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

  log({
    Name: 'Taboola',
    Type: 'Request',
    EventName: data.eventName,
    RequestMethod: 'POST',
    RequestUrl: requestUrl,
    RequestBody: {
      name: data.eventName,
      'click-id': clickId,
      revenue: data.revenue,
      currency: data.currencyCode,
      orderid: data.orderId
    }
  });

  sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'Taboola',
        Type: 'Response',
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

function determinateIsLoggingEnabled() {
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

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (isLoggingEnabled) logDestinationsHandlers.console = logConsole;
  if (isBigQueryLoggingEnabled) logDestinationsHandlers.bigQuery = logToBigQuery;

  rawDataToLog.TraceId = traceId;

  const keyMappings = {
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

  BigQuery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}
