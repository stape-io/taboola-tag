const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const parseUrl = require('parseUrl');
const JSON = require('JSON');
const getRequestHeader = require('getRequestHeader');
const encodeUriComponent = require('encodeUriComponent');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');

const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
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
    const clickId = getCookieValues('taboola_cid')[0] || '';
    let requestUrl = 'https://trc.taboola.com/'+enc(data.merchantId)+'/log/3/unip?id='+enc(data.merchantId)+'&click-id='+enc(clickId)+'&click_id='+enc(clickId)+'&name='+enc(data.eventName)+'&en='+enc(data.eventName)+'&revenue='+enc(data.revenue)+'&orderId='+enc(data.orderId)+'&currency=' + enc(data.currencyCode);

    if (isLoggingEnabled) {
        logToConsole(JSON.stringify({
            'Name': 'Taboola',
            'Type': 'Request',
            'TraceId': traceId,
            'EventName': data.eventName,
            'RequestMethod': 'GET',
            'RequestUrl': requestUrl,
        }));
    }

    sendHttpRequest(requestUrl, (statusCode, headers, body) => {
        if (isLoggingEnabled) {
            logToConsole(JSON.stringify({
                'Name': 'Taboola',
                'Type': 'Response',
                'TraceId': traceId,
                'EventName': data.eventName,
                'ResponseStatusCode': statusCode,
                'ResponseHeaders': headers,
                'ResponseBody': body,
            }));
        }

        if (statusCode >= 200 && statusCode < 300) {
            data.gtmOnSuccess();
        } else {
            data.gtmOnFailure();
        }
    }, {method: 'GET'});
}

function enc(data) {
    data = data || '';
    return encodeUriComponent(data);
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
