/*!
* 
*   @analytics-debugger/ga4mp 0.0.8
*   https://github.com/analytics-debugger/ga4mp
*
*   Copyright (c) David Vallejo (https://www.thyngster.com).
*   This source code is licensed under the MIT license found in the
*   LICENSE file in the root directory of this source tree.
*
*/

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.ga4mp = factory());
})(this, (function () { 'use strict';

  function _extends() {
    _extends = Object.assign ? Object.assign.bind() : function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
    return _extends.apply(this, arguments);
  }

  var trim = function trim(str, chars) {
    if (typeof str === 'string') {
      return str.substring(0, chars);
    } else {
      return str;
    }
  };
  var isFunction = function isFunction(val) {
    if (!val) return false;
    return Object.prototype.toString.call(val) === '[object Function]' || typeof val === 'function' && Object.prototype.toString.call(val) !== '[object RegExp]';
  };
  var isNumber = function isNumber(val) {
    return 'number' === typeof val && !isNaN(val);
  };
  var isString = function isString(val) {
    return val != null && typeof val === 'string';
  };
  var randomInt = function randomInt() {
    return Math.floor(Math.random() * (2147483647 - 0 + 1) + 0);
  };
  var timestampInSeconds = function timestampInSeconds() {
    return Math.floor(new Date() * 1 / 1000);
  };
  var getEnvironment = function getEnvironment() {
    var env;
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') env = 'browser';else if (typeof process !== 'undefined' && process.versions != null && process.versions.node != null) env = 'node';
    return env;
  };

  /**
   * Function to sanitize values based on GA4 Model Limits
   * @param {string} val
   * @param {integer} maxLength
   * @returns
   */

  var sanitizeValue = function sanitizeValue(val, maxLength) {
    // Trim a key-value pair value based on GA4 limits
    /*eslint-disable */
    try {
      val = val.toString();
    } catch (e) {}
    /*eslint-enable */
    if (!isString(val) || !maxLength || !isNumber(maxLength)) return val;
    return trim(val, maxLength);
  };

  var ga4Schema = {
    _em: 'em',
    event_name: 'en',
    protocol_version: 'v',
    _page_id: '_p',
    _is_debug: '_dbg',
    tracking_id: 'tid',
    hit_count: '_s',
    user_id: 'uid',
    client_id: 'cid',
    page_location: 'dl',
    language: 'ul',
    firebase_id: '_fid',
    traffic_type: 'tt',
    ignore_referrer: 'ir',
    screen_resolution: 'sr',
    global_developer_id_string: 'gdid',
    redact_device_info: '_rdi',
    geo_granularity: '_geo',
    _is_passthrough_cid: 'gtm_up',
    _is_linker_valid: '_glv',
    _user_agent_architecture: 'uaa',
    _user_agent_bitness: 'uab',
    _user_agent_full_version_list: 'uafvl',
    _user_agent_mobile: 'uamb',
    _user_agent_model: 'uam',
    _user_agent_platform: 'uap',
    _user_agent_platform_version: 'uapv',
    _user_agent_wait: 'uaW',
    _user_agent_wow64: 'uaw',
    error_code: 'ec',
    session_id: 'sid',
    session_number: 'sct',
    session_engaged: 'seg',
    page_referrer: 'dr',
    page_title: 'dt',
    currency: 'cu',
    campaign_content: 'cc',
    campaign_id: 'ci',
    campaign_medium: 'cm',
    campaign_name: 'cn',
    campaign_source: 'cs',
    campaign_term: 'ck',
    engagement_time_msec: '_et',
    event_developer_id_string: 'edid',
    is_first_visit: '_fv',
    is_new_to_site: '_nsi',
    is_session_start: '_ss',
    is_conversion: '_c',
    euid_mode_enabled: 'ecid',
    non_personalized_ads: '_npa',
    create_google_join: 'gaz',
    is_consent_update: 'gsu',
    user_ip_address: '_uip',
    google_consent_state: 'gcs',
    google_consent_update: 'gcu',
    us_privacy_string: 'us_privacy',
    document_location: 'dl',
    document_path: 'dp',
    document_title: 'dt',
    document_referrer: 'dr',
    user_language: 'ul',
    document_hostname: 'dh',
    item_id: 'id',
    item_name: 'nm',
    item_brand: 'br',
    item_category: 'ca',
    item_category2: 'c2',
    item_category3: 'c3',
    item_category4: 'c4',
    item_category5: 'c5',
    item_variant: 'va',
    price: 'pr',
    quantity: 'qt',
    coupon: 'cp',
    item_list_name: 'ln',
    index: 'lp',
    item_list_id: 'li',
    discount: 'ds',
    affiliation: 'af',
    promotion_id: 'pi',
    promotion_name: 'pn',
    creative_name: 'cn',
    creative_slot: 'cs',
    location_id: 'lo',
    // legacy ecommerce
    id: 'id',
    name: 'nm',
    brand: 'br',
    variant: 'va',
    list_name: 'ln',
    list_position: 'lp',
    list: 'ln',
    position: 'lp',
    creative: 'cn'
  };
  var ecommerceEvents = ['add_payment_info', 'add_shipping_info', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'select_item', 'view_item_list', 'select_promotion', 'view_promotion', 'purchase', 'refund', 'view_item', 'add_to_wishlist'];

  var sendRequest = function sendRequest(endpoint, payload) {
    var mode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'browser';
    var opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    var qs = new URLSearchParams(JSON.parse(JSON.stringify(payload))).toString();
    if (mode === 'browser') {
      var _navigator;
      (_navigator = navigator) === null || _navigator === void 0 ? void 0 : _navigator.sendBeacon([endpoint, qs].join('?'));
    } else {
      var scheme = endpoint.split('://')[0];
      var req = require("".concat(scheme));
      var options = {
        headers: {
          'User-Agent': opts.user_agent
        },
        timeout: 500
      };
      var request = req.get([endpoint, qs].join('?'), options, function (resp) {
        resp.on('data', function (chunk) {
        });
        resp.on('end', function () {
          // TO-DO Handle Server Side Responses                    
        });
      }).on('error', function (err) {
        console.log('Error: ' + err.message);
      });
      request.on('timeout', function () {
        request.destroy();
      });
    }
  };

  var clientHints = function clientHints(mode) {
    var _navigator, _navigator$userAgentD;
    if (mode === 'node' || typeof window === 'undefined' || typeof window !== 'undefined' && !('navigator' in window)) {
      return new Promise(function (resolve) {
        resolve(null);
      });
    }
    if (!((_navigator = navigator) !== null && _navigator !== void 0 && (_navigator$userAgentD = _navigator.userAgentData) !== null && _navigator$userAgentD !== void 0 && _navigator$userAgentD.getHighEntropyValues)) return new Promise(function (resolve) {
      resolve(null);
    });
    return navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'model', 'uaFullVersion', 'bitness', 'fullVersionList', 'wow64']).then(function (d) {
      var _navigator2, _navigator2$userAgent, _navigator3, _navigator3$userAgent, _navigator4, _navigator4$userAgent;
      return {
        _user_agent_architecture: d.architecture,
        _user_agent_bitness: d.bitness,
        _user_agent_full_version_list: encodeURIComponent((Object.values(d.fullVersionList) || ((_navigator2 = navigator) === null || _navigator2 === void 0 ? void 0 : (_navigator2$userAgent = _navigator2.userAgentData) === null || _navigator2$userAgent === void 0 ? void 0 : _navigator2$userAgent.brands)).map(function (h) {
          return [h.brand, h.version].join(';');
        }).join('|')),
        _user_agent_mobile: d.mobile ? 1 : 0,
        _user_agent_model: d.model || ((_navigator3 = navigator) === null || _navigator3 === void 0 ? void 0 : (_navigator3$userAgent = _navigator3.userAgentData) === null || _navigator3$userAgent === void 0 ? void 0 : _navigator3$userAgent.mobile),
        _user_agent_platform: d.platform || ((_navigator4 = navigator) === null || _navigator4 === void 0 ? void 0 : (_navigator4$userAgent = _navigator4.userAgentData) === null || _navigator4$userAgent === void 0 ? void 0 : _navigator4$userAgent.platform),
        _user_agent_platform_version: d.platformVersion,
        _user_agent_wow64: d.wow64 ? 1 : 0
      };
    });
  };

  /**
   * Populate Page Related Details
   */
  var pageDetails = function pageDetails() {
    return {
      page_location: document.location.href,
      page_referrer: document.referrer,
      page_title: document.title,
      language: (navigator && (navigator.language || navigator.browserLanguage) || '').toLowerCase(),
      screen_resolution: (window.screen ? window.screen.width : 0) + 'x' + (window.screen ? window.screen.height : 0)
    };
  };

  var version = '0.0.8';

  /**
   * Main Class Function
   * @param {array|string} measurement_ids
   * @param {object} config
   * @returns
   */

  var ga4mp = function ga4mp(measurement_ids) {
    var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    if (!measurement_ids) throw 'Tracker initialization aborted: missing tracking ids';
    var internalModel = _extends({
      version: version,
      debug: false,
      mode: getEnvironment() || 'browser',
      measurement_ids: null,
      queueDispatchTime: 5000,
      queueDispatchMaxEvents: 10,
      queue: [],
      eventParameters: {},
      persistentEventParameters: {},
      userProperties: {},
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 [GA4MP/".concat(version, "]"),
      user_ip_address: null,
      hooks: {
        beforeLoad: function beforeLoad() {},
        beforeRequestSend: function beforeRequestSend() {}
      },
      endpoint: 'https://www.google-analytics.com/g/collect',
      payloadData: {}
    }, config);

    // Initialize Tracker Data
    internalModel.payloadData.protocol_version = 2;
    internalModel.payloadData.tracking_id = Array.isArray(measurement_ids) ? measurement_ids : [measurement_ids];
    internalModel.payloadData.client_id = config.client_id ? config.client_id : [randomInt(), timestampInSeconds()].join('.');
    internalModel.payloadData._is_debug = config.debug ? 1 : undefined;
    internalModel.payloadData.non_personalized_ads = config.non_personalized_ads ? 1 : undefined;
    internalModel.payloadData.hit_count = 1;

    // Initialize Session Data
    internalModel.payloadData.session_id = config.session_id ? config.session_id : timestampInSeconds();
    internalModel.payloadData.session_number = config.session_number ? config.session_number : 1;

    // Initialize User Data
    internalModel.payloadData.user_id = config.user_id ? trim(config.user_id, 256) : undefined;
    internalModel.payloadData.user_ip_address = config.user_ip_address ? config.user_ip_address : undefined;
    internalModel.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 [GA4MP/".concat(version, "]");

    // Initialize Tracker Data
    if (internalModel === 'node' && config.user_agent) {
      internalModel.user_agent = config.user_agent;
    }
    // Grab data only browser data
    if (internalModel.mode === 'browser') {
      var pageData = pageDetails();
      if (pageData) {
        internalModel.payloadData = _extends(internalModel.payloadData, pageData);
      }
    }
    /**
     * Dispatching Queue
     * TO-DO
     */
    var dispatchQueue = function dispatchQueue() {
      internalModel.queue = [];
    };

    /**
     * Grab current ClientId
     * @returns string
     */
    var getClientId = function getClientId() {
      return internalModel.payloadData.client_id;
    };

    /**
     * Grab current Session ID
     * @returns string
     */
    var getSessionId = function getSessionId() {
      return internalModel.payloadData.session_id;
    };

    /**
     * Set an Sticky Event Parameter, it wil be attached to all events
     * @param {string} key
     * @param {string|number|Fn} value
     * @returns
     */
    var setEventsParameter = function setEventsParameter(key, value) {
      if (isFunction(value)) {
        try {
          value = value();
        } catch (e) {}
      }
      key = sanitizeValue(key, 40);
      value = sanitizeValue(value, 100);
      internalModel['persistentEventParameters'][key] = value;
    };

    /**
     * setUserProperty
     * @param {*} key
     * @param {*} value
     * @returns
     */
    var setUserProperty = function setUserProperty(key, value) {
      key = sanitizeValue(key, 24);
      value = sanitizeValue(value, 36);
      internalModel['userProperties'][key] = value;
    };

    /**
     * Generate Payload
     * @param {object} customEventParameters
     */
    var buildPayload = function buildPayload(eventName, customEventParameters) {
      var payload = {};
      if (internalModel.payloadData.hit_count === 1) internalModel.payloadData.session_engaged = 1;
      Object.entries(internalModel.payloadData).forEach(function (pair) {
        var key = pair[0];
        var value = pair[1];
        if (ga4Schema[key]) {
          payload[ga4Schema[key]] = typeof value === 'boolean' ? +value : value;
        }
      });
      // GA4 Will have different Limits based on "unknown" rules
      // const itemsLimit = isP ? 27 : 10
      var eventParameters = _extends(JSON.parse(JSON.stringify(internalModel.persistentEventParameters)), JSON.parse(JSON.stringify(customEventParameters)));
      eventParameters.event_name = eventName;
      Object.entries(eventParameters).forEach(function (pair) {
        var key = pair[0];
        var value = pair[1];
        if (key === 'items' && ecommerceEvents.indexOf(eventName) > -1 && Array.isArray(value)) {
          // only 200 items per event
          var items = value.slice(0, 200);
          var _loop = function _loop() {
            if (items[i]) {
              var item = {
                core: {},
                custom: {}
              };
              Object.entries(items[i]).forEach(function (pair) {
                if (ga4Schema[pair[0]]) {
                  if (typeof pair[1] !== 'undefined') item.core[ga4Schema[pair[0]]] = pair[1];
                } else item.custom[pair[0]] = pair[1];
              });
              var productString = Object.entries(item.core).map(function (v) {
                return v[0] + v[1];
              }).join('~') + '~' + Object.entries(item.custom).map(function (v, i) {
                var customItemParamIndex = 10 > i ? '' + i : String.fromCharCode(65 + i - 10);
                return "k".concat(customItemParamIndex).concat(v[0], "~v").concat(customItemParamIndex).concat(v[1]);
              }).join('~');
              payload["pr".concat(i + 1)] = productString;
            }
          };
          for (var i = 0; i < items.length; i++) {
            _loop();
          }
        } else {
          if (ga4Schema[key]) {
            payload[ga4Schema[key]] = typeof value === 'boolean' ? +value : value;
          } else {
            payload[(isNumber(value) ? 'epn.' : 'ep.') + key] = value;
          }
        }
      });
      Object.entries(internalModel.userProperties).forEach(function (pair) {
        var key = pair[0];
        var value = pair[1];
        if (ga4Schema[key]) {
          payload[ga4Schema[key]] = typeof value === 'boolean' ? +value : value;
        } else {
          payload[(isNumber(value) ? 'upn.' : 'up.') + key] = value;
        }
      });
      return payload;
    };

    /**
     * setUserId
     * @param {string} value
     * @returns
     */
    var setUserId = function setUserId(value) {
      internalModel.payloadData.user_id = sanitizeValue(value, 256);
    };

    /**
     * Track Event
     * @param {string} eventName
     * @param {object} eventParameters
     * @param {boolean} forceDispatch
     */
    var getHitIndex = function getHitIndex() {
      return internalModel.payloadData.hit_count;
    };
    var trackEvent = function trackEvent(eventName) {
      var eventParameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var forceDispatch = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
      // We want to wait for the CH Promise to fullfill
      clientHints(internalModel === null || internalModel === void 0 ? void 0 : internalModel.mode).then(function (ch) {
        if (ch) {
          internalModel.payloadData = _extends(internalModel.payloadData, ch);
        }
        var payload = buildPayload(eventName, eventParameters);
        if (payload && forceDispatch) {
          for (var i = 0; i < payload.tid.length; i++) {
            var r = JSON.parse(JSON.stringify(payload));
            r.tid = payload.tid[i];
            sendRequest(internalModel.endpoint, r, internalModel.mode, {
              user_agent: internalModel === null || internalModel === void 0 ? void 0 : internalModel.user_agent
            });
          }
          internalModel.payloadData.hit_count++;
        } else {
          var eventsCount = internalModel.queue.push(event);
          if (eventsCount >= internalModel.queueDispatchMaxEvents) {
            dispatchQueue();
          }
        }
      });
    };
    return {
      version: internalModel.version,
      mode: internalModel.mode,
      getHitIndex: getHitIndex,
      getSessionId: getSessionId,
      getClientId: getClientId,
      setUserProperty: setUserProperty,
      setEventsParameter: setEventsParameter,
      setUserId: setUserId,
      trackEvent: trackEvent
    };
  };

  return ga4mp;

}));
