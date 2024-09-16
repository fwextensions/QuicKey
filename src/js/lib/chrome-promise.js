/*!
 * chrome-promise 2.0.3
 * https://github.com/tfoxy/chrome-promise
 *
 * Copyright 2015 Tomás Fox
 * Released under the MIT license
 */

var slice = Array.prototype.slice,
  hasOwnProperty = Object.prototype.hasOwnProperty;

  ////////////////

export function ChromePromise(options) {
    options = options || {};
    var chrome = options.chrome || window.chrome;
    var Promise = options.Promise || window.Promise;
    var runtime = chrome.runtime;

    fillProperties(chrome, this);

    ////////////////

    function setPromiseFunction(fn, thisArg) {

      return function() {
        var args = slice.call(arguments);

        return new Promise(function(resolve, reject) {
          args.push(callback);

          fn.apply(thisArg, args);

          function callback() {
            var err = runtime.lastError;
            var results = slice.call(arguments);
            if (err) {
              reject(err);
            } else {
              switch (results.length) {
                case 0:
                  resolve();
                  break;
                case 1:
                  resolve(results[0]);
                  break;
                default:
                  resolve(results);
              }
            }
          }
        });

      };

    }

    function fillProperties(source, target) {
      for (var key in source) {
        if (hasOwnProperty.call(source, key)) {
          var val = source[key];
          var type = typeof val;

          if (type === 'object' && !(val instanceof ChromePromise)) {
            target[key] = {};
            fillProperties(val, target[key]);
          } else if (type === 'function') {
            target[key] = setPromiseFunction(val, source);
          } else {
            target[key] = val;
          }
        }
      }
    }
  }
