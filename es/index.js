import catbox from 'catbox';

import getKeyGenerator from './getKeyGenerator';
import getTTLGenerator from './getTTLGenerator';

/**
 * Returns a decorated version of the given function that caches its results
 * @param  {Function} fn Function to cache
 * @param  {Object} options
 * @param  {catbox.Client} options.cacheClient
 * @param  {string} options.segment Cache segment for the cached values
 * @param  {number|string} options.ttl TTL of the cached values in ms
 * @param  {number} [options.ttlRandomFactor=0] TTL will be in ttl +- ttl * ttlRandomFactor
 * @param  {Function} [options.key] Function to generate the cache key.
 *                                  Receives the arguments passed to the original function.
 *                                  Defaults to a function that generates a hash from the arguments.
 * @param  {Function} [options.regenerateIf] Function to specify that the cached value should be
 *                                           ignored. Receives the function arguments.
 * @return {Function}
 */
export default function makeCacheable(fn, options) {
  const { cacheClient, segment, regenerateIf } = options;

  const generateTtl = getTTLGenerator(options);
  const generateKey = getKeyGenerator(options);

  const policy = new catbox.Policy({
    async generateFunc({ args }, flags) {
      flags.ttl = generateTtl(...args);
      return fn(...args);
    },
    generateTimeout: false,
    // An error in the generate function does NOT remove the value from cache
    dropOnError: false
  }, cacheClient, segment);

  async function cachedFunction(...args) {
    const id = generateKey(...args);
    const shouldRegenerate = regenerateIf && regenerateIf(...args);

    if (shouldRegenerate) {
      await policy.drop(id);
    }

    return policy.get({ id, args });
  }

  cachedFunction.setCached = (args, value) => {
    const key = {
      segment,
      id: generateKey(...args)
    };
    const ttl = generateTtl(args);
    return cacheClient.set(key, value, ttl);
  };

  return cachedFunction;
}
