import assert from 'assert';

import ms from 'ms';

/**
 * Returns a function that generates a random value in ttl +- ttl * ttlRandomFactor
 * @param  {number|string} options.ttl TTL in number of miliseconds or in a duration format
 *                                     ('3ms', '3s', '3m', '3h', '3d'...)
 * @param  {number} [options.ttlRandomFactor=0]
 * @return {Function}
 * @throws {AssertionError} If ttl is not a number or a string that represents a duration
 * @throws {AssertionError} If ttlRandomFactor is not a number between 0 and 1
 */
export default function getTTLGenerator({ ttl, ttlRandomFactor = 0 }) {
  const ttlNumber = typeof ttl === 'string' ? ms(ttl) : ttl;

  assert(typeof ttlNumber === 'number' && ttlNumber >= 0,
    `ttl must be a number >= 0: ${ttlNumber}`);
  assert(typeof ttlRandomFactor === 'number' && ttlRandomFactor >= 0 && ttlRandomFactor <= 1,
    `ttlRandomFactor must be a number between 0 and 1: ${ttlRandomFactor}`);

  if (ttlRandomFactor === 0) {
    return () => ttlNumber;
  }

  const maxVariation = ttlNumber * ttlRandomFactor * 2;
  const minValue = ttlNumber - maxVariation / 2;

  return () => {
    const randomInRange = Math.round(maxVariation * Math.random());
    const randomTTL = minValue + randomInRange;
    return randomTTL;
  };
}
