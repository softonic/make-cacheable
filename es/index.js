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
 * @return {Function}
 */
export default function makeCacheable(fn, options) {
  const { cacheClient, segment } = options;

  const generateTtl = getTTLGenerator(options);
  const generateKey = getKeyGenerator(options);

  const policy = new catbox.Policy({
    generateFunc({ id, args }, next) {
      const wrapped = new Promise(resolve => resolve(fn(...args)));
      const ttl = generateTtl(...args);
      wrapped.then(result => next(null, result, ttl), next);
    },
    generateTimeout: false
  }, cacheClient, segment);

  function cachedFunction(...args) {
    return new Promise((resolve, reject) => {
      const id = generateKey(...args);
      policy.get({ id, args }, (err, value) => {
        if (err) {
          return reject(err);
        }

        resolve(value);
      });
    });
  }

  cachedFunction.setCached = (args, value) => {
    return new Promise((resolve, reject) => {
      const key = {
        segment,
        id: generateKey(...args)
      };
      const ttl = generateTtl(args);
      cacheClient.set(key, value, ttl, (error) => {
        return error ? reject(error) : resolve();
      });
    });
  };

  return cachedFunction;
}
