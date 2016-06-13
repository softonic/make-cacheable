import assert from 'assert';

import objectHash from 'object-hash';

/**
 * Returns a hash generated from the received arguments
 * @param {...*} args
 * @return {string}
 */
function hashArguments(...args) {
  return objectHash(args);
}

/**
 * Returns a function that forwards the call to the passed function.
 * If that function does not return a string, it forces it using a hash of the value.
 * @param  {Function} keyFn
 * @return {string}
 */
function ensureFnReturnsString(keyFn) {
  return (...args) => {
    let key = keyFn(...args);
    if (typeof key !== 'string') {
      key = objectHash(key);
    }
    return key;
  };
}

/**
 * Returns a key generator from the given options.
 * If a key is passed, it ensures that the key returns strings.
 * If not, returns a function that hashes the received arguments.
 * @param  {Function} [options.key]
 * @return {Function}
 */
export default function getKeyGenerator({ key } = {}) {
  assert(!key || typeof key === 'function', 'key must be a function');
  return key ? ensureFnReturnsString(key) : hashArguments;
}
