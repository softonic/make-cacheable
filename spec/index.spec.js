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
function createFakeCacheClient({
  fakeCacheGet,
  fakeCacheSet,
  fakeCacheDrop,
  cached
} = {}) {
  const cacheClient = jasmine.createSpyObj('cacheClient', [
    'get', 'set', 'drop', 'validateSegmentName'
  ]);

  // We need segments to be valid in order to test
  cacheClient.validateSegmentName.and.returnValue(null);

  const cachedValue = cached ? { item: cached } : cached;
  /* eslint-disable no-param-reassign */
  fakeCacheGet = fakeCacheGet || (() => Promise.resolve(cachedValue));
  fakeCacheSet = fakeCacheSet || (() => Promise.resolve());
  fakeCacheDrop = fakeCacheDrop || (() => Promise.resolve());
  /* eslint-enable */

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

  it('should return a cached function', () => {
    const fn = () => {};
    const cachedFn = makeCacheable(fn, generateDefaultOptions());
    expect(cachedFn).toEqual(jasmine.any(Function));
    expect(cachedFn).not.toBe(fn);
  });

  describe('the cached function function', () => {
    it('should have a setCached method', () => {
      const fn = () => {};
      const cachedFn = makeCacheable(fn, generateDefaultOptions());
      expect(cachedFn.setCached).toEqual(jasmine.any(Function));
    });

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
      });
    });

    it('should return a promise', () => {
      const options = generateDefaultOptions();
      const cachedFn = makeCacheable(() => {}, options);
      const returnValue = cachedFn();
      expect(returnValue).toEqual(jasmine.any(Promise));
    });

    describe('when passing a `regenerateIf` option', () => {
      it('should be called with the received arguments', () => {
        const options = generateDefaultOptions();
        options.regenerateIf = jasmine.createSpy('regenerateIf');

        const expectedResult = { foo: 'bar' };
        options.cacheClient = createFakeCacheClient({ cached: expectedResult });

        const fn = () => {};
        const cachedFn = makeCacheable(fn, options);

        const args = [1, 'foo'];
        cachedFn(...args);

        expect(options.regenerateIf).toHaveBeenCalledWith(...args);
      });

      describe('when it returns true', () => {
        it('should drop the item from the cache', async () => {
          const options = generateDefaultOptions();
          options.regenerateIf = () => true;

          const expectedResult = { foo: 'bar' };
          options.cacheClient = createFakeCacheClient({ cached: expectedResult });

          const fn = () => {};
          const cachedFn = makeCacheable(fn, options);

          const key = getKeyGenerator(options)('foo', 'bar');
          await cachedFn('foo', 'bar');

          expect(options.cacheClient.drop).toHaveBeenCalledWith(
            { segment: options.segment, id: key }
          );
        });

        describe('and dropping from the cache fails', () => {
          it('should go on with the flow', async () => {
            const options = generateDefaultOptions();
            options.regenerateIf = () => true;

            const expectedResult = { foo: 'bar' };
            options.cacheClient = createFakeCacheClient({
              cached: expectedResult,
              fakeCacheDrop: () => Promise.reject()
            });

            const fn = () => { };
            const cachedFn = makeCacheable(fn, options);

            await cachedFn('foo', 'bar');

            expect(options.cacheClient.get).toHaveBeenCalled();
          });
        });
      });

      describe('when it returns false', () => {
        it('should NOT drop the item from the cache', async () => {
          const options = generateDefaultOptions();
          options.regenerateIf = () => false;

          const expectedResult = { foo: 'bar' };
          options.cacheClient = createFakeCacheClient({ cached: expectedResult });

          const fn = () => {};
          const cachedFn = makeCacheable(fn, options);

          await cachedFn('foo', 'bar');

          expect(options.cacheClient.drop).not.toHaveBeenCalled();
        });
      });
    });

    describe('when the value IS cached', () => {
      it('should return a promise that resolves with it', async () => {
        const options = generateDefaultOptions();

        const expectedResult = { foo: 'bar' };
        options.cacheClient = createFakeCacheClient({ cached: expectedResult });

        const fn = () => {};
        const cachedFn = makeCacheable(fn, options);

        const returnValue = await cachedFn('foo', 'bar');

        expect(returnValue).toBe(expectedResult);
      });
    });

    describe('when the value is NOT cached', () => {
      it('should call the original function with the same parameters', (done) => {
        const options = generateDefaultOptions();

        const fn = (...args) => {
          expect(args).toEqual(['foo', 'bar']);
          done();
        };

        const cachedFn = makeCacheable(fn, options);
        cachedFn('foo', 'bar');
      });

      it('should return a promise that resolves with its result', async () => {
        const options = generateDefaultOptions();

        const expectedResult = { foo: 'bar' };
        const fn = () => expectedResult;
        const cachedFn = makeCacheable(fn, options);

        const returnValue = await cachedFn('foo', 'bar');

        expect(returnValue).toBe(expectedResult);
      });

      it('should cache the result', (done) => {
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

    describe('setCached(args, value)', () => {
      it('should set the value in the cache with the same configuration', (done) => {
        const fn = () => {};

        const options = generateDefaultOptions();
        options.cacheClient = createFakeCacheClient({
          fakeCacheSet(key, value, ttl) {
            const expectedKey = getKeyGenerator(options)({ foo: 'bar' }, 123);

            expect(key).toEqual({
              segment: options.segment,
              id: expectedKey
            });
            expect(value).toEqual({ id: 'softonic' });
            expect(ttl).toBe(options.ttl);
            done();
          }
        });

        const cachedFn = makeCacheable(fn, options);

        cachedFn.setCached([{ foo: 'bar' }, 123], { id: 'softonic' });
      });

      it('should return a promise that resolves when the value has been cached', async () => {
        const fn = () => {};

        const options = generateDefaultOptions();
        options.cacheClient = createFakeCacheClient();

        const cachedFn = await makeCacheable(fn, options);

        await cachedFn.setCached([{ foo: 'bar' }, 123], { id: 'softonic' });
      });

      it('should return a promise that rejects when with any error caching the value', (done) => {
        const fn = () => {};

        const cacheError = new Error('Cache error');

        const options = generateDefaultOptions();
        options.cacheClient = createFakeCacheClient({
          fakeCacheSet: () => Promise.reject(cacheError)
        });

        const cachedFn = makeCacheable(fn, options);

        cachedFn.setCached([{ foo: 'bar' }, 123], { id: 'softonic' }).then(done.fail, (error) => {
          expect(error).toBe(cacheError);
          done();
        });
      });
    });
  });
});
