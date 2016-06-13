import makeCacheable from '../es/index';
import getKeyGenerator from '../es/getKeyGenerator';

/* HELPERS */

/**
 * Creates a fake cache client. Allows to redefine the default "get" and "set" methods.
 * If not set, "get" returns a not cached value.
 * If not set, "set" calls the callback as if the result were cached.
 * @param  {Function} [options.fakeCacheGet] Method to call as "get"
 * @param  {Function} [options.fakeCacheSet] Method to call as "set".
 * @param  {Object} [options.cached] If "fakeCacheGet" is not passed, this is the cached value
 *                                   for the client
 * @return {catbox.Client}
 */
function createFakeCacheClient({ fakeCacheGet, fakeCacheSet, cached } = {}) {
  const cacheClient = jasmine.createSpyObj('cacheClient', [
    'get', 'set', 'drop', 'validateSegmentName'
  ]);

  // We need segments to be valid in order to test
  cacheClient.validateSegmentName.and.returnValue(null);

  const cachedValue = cached ? { item: cached } : cached;
  fakeCacheGet = fakeCacheGet || ((key, callback) => callback(null, cachedValue));
  fakeCacheSet = fakeCacheSet || ((key, value, ttl, callback) => callback());
  const fakeCacheDrop = (key, callback) => callback();

  cacheClient.get.and.callFake(fakeCacheGet);
  cacheClient.set.and.callFake(fakeCacheSet);
  cacheClient.drop.and.callFake(fakeCacheDrop);

  return cacheClient;
}

/**
 * Creates a default set of options for a cached function
 * @return {{ cacheClient: catbox.Client, segment: string, ttl: number }}
 */
function generateDefaultOptions() {
  return {
    cacheClient: createFakeCacheClient(),
    segment: 'fnSegment',
    ttl: 1000
  };
}

/* TEST */

describe('makeCacheable(method, options)', () => {
  it('should be a function', () => {
    expect(makeCacheable).toEqual(jasmine.any(Function));
  });

  it('should return a decorated function', () => {
    const fn = () => {};
    const cachedFn = makeCacheable(fn, generateDefaultOptions());
    expect(cachedFn).toEqual(jasmine.any(Function));
    expect(cachedFn).not.toBe(fn);
  });

  describe('the decorated function', () => {
    it('should check if the value is cached', () => {
      const options = generateDefaultOptions();
      const { cacheClient } = options;

      const fn = () => {};
      const cachedFn = makeCacheable(fn, options);

      cachedFn('foo', 'bar');

      const expectedSegment = options.segment;
      const expectedId = getKeyGenerator(options)('foo', 'bar');

      expect(cacheClient.get).toHaveBeenCalledWith({
        segment: expectedSegment,
        id: expectedId
      }, jasmine.any(Function));
    });

    it('should return a promise', () => {
      const options = generateDefaultOptions();
      const cachedFn = makeCacheable(() => {}, options);
      const returnValue = cachedFn();
      expect(returnValue).toEqual(jasmine.any(Promise));
    });

    describe('when the value IS cached', () => {
      it('should return a promise that resolves with it', done => {
        const options = generateDefaultOptions();

        const expectedResult = { foo: 'bar' };
        options.cacheClient = createFakeCacheClient({ cached: expectedResult });

        const fn = () => {};
        const cachedFn = makeCacheable(fn, options);

        const returnValue = cachedFn('foo', 'bar');

        returnValue.then(result => {
          expect(result).toBe(expectedResult);
          done();
        }, done.fail);
      });
    });

    describe('when the value is NOT cached', () => {
      it('should call the original function with the same parameters', done => {
        const options = generateDefaultOptions();

        const fn = (...args) => {
          expect(args).toEqual(['foo', 'bar']);
          done();
        };

        const cachedFn = makeCacheable(fn, options);
        cachedFn('foo', 'bar');
      });

      it('should return a promise that resolves with its result', done => {
        const options = generateDefaultOptions();

        const expectedResult = { foo: 'bar' };
        const fn = () => expectedResult;
        const cachedFn = makeCacheable(fn, options);

        const returnValue = cachedFn('foo', 'bar');
        returnValue.then(result => {
          expect(result).toBe(expectedResult);
          done();
        }, done.fail);
      });

      it('should cache the result', done => {
        const options = generateDefaultOptions();

        const expectedResult = { foo: 'bar' };
        const fn = () => expectedResult;

        const expectedKey = getKeyGenerator(options)('foo', 'bar');

        options.cacheClient = createFakeCacheClient({
          fakeCacheSet(key, value, ttl) {
            expect(key).toEqual({
              segment: options.segment,
              id: expectedKey
            });
            expect(value).toBe(expectedResult);
            expect(ttl).toBe(options.ttl);
            done();
          }
        });

        const cachedFn = makeCacheable(fn, options);
        cachedFn('foo', 'bar');
      });
    });
  });
});
