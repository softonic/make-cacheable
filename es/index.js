import catbox from 'catbox';

import getKeyGenerator from './getKeyGenerator';
import getTTLGenerator from './getTTLGenerator';

/**
 * Returns a decorated version of the given function that caches its results
 * @param  {Function} fn Function to cache
 * @param  {Object} options
 * @param  {catbox.Client} options.cacheClient
 * @param  {String} options.segment Cache segment for the cached values
 *
 * @param  {Function} [options.keyGenerator] Generates the cache key. Receives the arguments passed
 * to the original function.
 * @param  {Function} [options.key] See getTTLGenerator.js
 *
 * @param  {Function} [options.ttlGenerator] Generates the TTL of the cached values in ms.
 * @param  {Number|String} [options.ttl] See getTTLGenerator.js
 * @param  {Number} [options.ttlRandomFactor=0] See getTTLGenerator.js
 *
 * @param  {Function} [options.dropIf] Function to specify that the cached value should be
 * dropped. Receives the function arguments.
 * @param  {Function} [onMiss] Called when a MISS occurs
 * @param  {Function} [onHit] Called when a HIT occurs
 * @param  {Function} [onDrop] Called when a DROP occurs
 * @return {Function}
 */
export default function makeCacheable(fn, options) {
  const {
    cacheClient,
    segment,
    keyGenerator = getKeyGenerator(options),
    ttlGenerator = getTTLGenerator(options),
    dropIf = () => false,
    onMiss = () => {},
    onHit = () => {},
    onDrop = () => {},
  } = options;

  const policyOptions = {
    //  relative expiration in the number of milliseconds since the item was saved in the cache
    expiresIn: ttlGenerator(),
    // generates a new cache item if one is not found in the cache when calling policy.get()
    generateFunc: async ({ args }) => fn(...args),
    // no timeouts when calling policy.get() as we already have Axios timeouts
    generateTimeout: false,
    // an error in the generate function does NOT remove the value from cache
    dropOnError: false,
    // policy.get() will return an object with { value, cached, report }
    getDecoratedValue: true,
  };

  const policy = new catbox.Policy(policyOptions, cacheClient, segment);

  /**
   * @param {...*} args
   * @return {Promise}
   */
  const cachedFunction = async (...args) => {
    const id = keyGenerator(...args);
    const shouldDrop = dropIf(...args);

    if (shouldDrop) {
      onDrop({
        segment,
        args,
        id,
      });

      await policy.drop(id);
    }

    const result = await policy.get({ id, args });
    const { value, cached } = result;

    const onCallbackParams = {
      segment,
      args,
      id,
      result,
      stats: policy.stats,
    };

    if (cached) {
      onHit(onCallbackParams);
    } else {
      onMiss(onCallbackParams);
    }

    return value;
  };

  /**
   * @param {Array} args
   * @param {*} value
   * @return {Promise}
   */
  cachedFunction.setCached = async (args, value) => {
    const key = {
      segment,
      id: keyGenerator(...args),
    };
    const ttl = ttlGenerator();
    return cacheClient.set(key, value, ttl);
  };

  return cachedFunction;
}
