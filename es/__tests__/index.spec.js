import CatboxMemory from 'catbox-memory';
import makeCacheable from '../index';

function buildTestOptions() {
  const cacheClient = new CatboxMemory();

  const segment = 'cache-segment';
  const id = 'item-id';
  const ttl = 60000;

  return {
    cacheClient,
    segment,
    keyGenerator: jest.fn(() => 'item-id'),
    id,
    ttlGenerator: jest.fn(() => ttl),
    ttl,
    dropIf: jest.fn(() => false),
    onMiss: jest.fn(),
    onHit: jest.fn(),
    onDrop: jest.fn(),
  };
}

describe('makeCacheable(fn, options)', () => {
  it('should be a function', () => {
    expect(makeCacheable).toBeInstanceOf(Function);
  });

  it('should return a cached function', () => {
    const fn = () => {};

    const cachedFn = makeCacheable(fn, buildTestOptions());

    expect(cachedFn).toBeInstanceOf(Function);
    expect(cachedFn).not.toBe(fn);
  });

  describe('the cached function', () => {
    describe('when called', () => {
      it('should return a promise', () => {
        const fn = () => {};
        const cachedFn = makeCacheable(fn, buildTestOptions());

        const result = cachedFn();

        expect(result).toBeInstanceOf(Promise);
      });

      it('should use the "keyGenerator" (function) option to generate a cache key', async () => {
        const fn = () => {};
        const options = buildTestOptions();
        const {
          keyGenerator,
        } = options;

        const cachedFn = makeCacheable(fn, options);

        await cachedFn('foo', 'bar');

        expect(keyGenerator).toHaveBeenCalledWith('foo', 'bar');
      });

      it('should use the "ttlGenerator" (function) option to generate a TTL value', async () => {
        const fn = () => {};
        const options = buildTestOptions();
        const {
          ttlGenerator,
        } = options;

        const cachedFn = makeCacheable(fn, options);

        await cachedFn('foo', 'bar');

        expect(ttlGenerator).toHaveBeenCalled();
      });

      it('should try to get the value from the cache', async () => {
        const fn = () => {};
        const options = buildTestOptions();
        const {
          cacheClient,
          segment,
          id,
        } = options;

        jest.spyOn(cacheClient, 'get');

        const cachedFn = makeCacheable(fn, options);

        await cachedFn('foo', 'bar');

        expect(cacheClient.get).toHaveBeenCalledWith({ segment, id });
      });

      describe('when the value is not in cache', () => {
        it('should call the original function with the same parameters & return its value', async () => {
          const fn = jest.fn(() => 'fn-result');
          const options = buildTestOptions();
          const {
            cacheClient,
          } = options;

          jest.spyOn(cacheClient, 'get').mockResolvedValue(null);

          const cachedFn = makeCacheable(fn, options);

          const result = await cachedFn('foo', 'bar');

          expect(fn).toHaveBeenCalledWith('foo', 'bar');
          expect(result).toBe('fn-result');
        });

        it('should store the value in the cache, using the proper configuration (segment, id, ttl)', async () => {
          const fn = jest.fn(() => 'fn-result');
          const options = buildTestOptions();
          const {
            cacheClient,
            segment,
            id,
            ttl,
          } = options;

          jest.spyOn(cacheClient, 'get').mockResolvedValue(null);
          jest.spyOn(cacheClient, 'set').mockResolvedValue(null);

          const cachedFn = makeCacheable(fn, options);

          const result = await cachedFn('foo', 'bar');

          expect(cacheClient.set).toHaveBeenCalledWith({ segment, id }, result, ttl);
        });
      });

      describe('when the value is already in cache', () => {
        it('should not call the original function & just return the value stored', async () => {
          const fn = jest.fn();
          const options = buildTestOptions();
          const {
            cacheClient,
          } = options;

          jest.spyOn(cacheClient, 'get').mockResolvedValue({ item: 'fn-result' });

          const cachedFn = makeCacheable(fn, options);

          const result = await cachedFn('foo', 'bar');

          expect(fn).not.toHaveBeenCalledWith();
          expect(result).toBe('fn-result');
        });
      });

      describe('when passing a "dropIf" (function) option', () => {
        it('should be called with the arguments passed to the original function', async () => {
          const fn = jest.fn();
          const options = buildTestOptions();
          const {
            dropIf,
          } = options;

          const cachedFn = makeCacheable(fn, options);

          await cachedFn('foo', 'bar');

          expect(dropIf).toHaveBeenCalledWith('foo', 'bar');
        });

        describe('when returning true', () => {
          it('should force the item to be dropped from the cache', async () => {
            const fn = jest.fn();
            const options = buildTestOptions();
            const {
              cacheClient,
              segment,
              id,
              dropIf,
            } = options;

            dropIf.mockReturnValue(true);
            jest.spyOn(cacheClient, 'drop').mockResolvedValue(true);

            const cachedFn = makeCacheable(fn, options);

            await cachedFn('foo', 'bar');

            expect(cacheClient.drop).toHaveBeenCalledWith({ segment, id });
          });

          describe('when dropping the item from the cache fails', () => {
            it('should not propagate the error', async () => {
              const fn = jest.fn();
              const options = buildTestOptions();
              const {
                cacheClient,
                dropIf,
              } = options;

              dropIf.mockReturnValue(true);
              const dropError = new Error('Ooops! Drop error.');
              jest.spyOn(cacheClient, 'drop').mockRejectedValue(dropError);
              jest.spyOn(cacheClient, 'get').mockResolvedValue({ item: 'fn-result' });

              const cachedFn = makeCacheable(fn, options);

              const result = cachedFn('foo', 'bar');

              await expect(result).resolves.toBe('fn-result');
            });
          });
        });

        describe('when returning false', () => {
          it('should not drop the item from the cache', async () => {
            const fn = jest.fn();
            const options = buildTestOptions();
            const {
              cacheClient,
              dropIf,
            } = options;

            dropIf.mockReturnValue(false);
            jest.spyOn(cacheClient, 'drop').mockResolvedValue(true);

            const cachedFn = makeCacheable(fn, options);

            await cachedFn('foo', 'bar');

            expect(cacheClient.drop).not.toHaveBeenCalled();
          });
        });
      });

      describe('when passing a "onMiss" (function) option', () => {
        it('should call it when the item is not found in cache', async () => {
          const fn = jest.fn(() => 'fn-result');
          const options = buildTestOptions();
          const {
            cacheClient,
            segment,
            id,
            onMiss,
          } = options;

          jest.spyOn(cacheClient, 'get').mockResolvedValue(null);

          const cachedFn = makeCacheable(fn, options);

          await cachedFn('foo', 'bar');

          expect(onMiss).toHaveBeenCalledWith({
            segment,
            args: ['foo', 'bar'],
            id,
            result: {
              cached: null,
              value: 'fn-result',
              report: expect.any(Object),
            },
            stats: expect.any(Object),
          });
        });
      });

      describe('when passing a "onHit" (function) option', () => {
        it('should call it when the item is found in cache', async () => {
          const fn = jest.fn(() => 'fn-result');
          const options = buildTestOptions();
          const {
            cacheClient,
            segment,
            id,
            onHit,
          } = options;

          jest.spyOn(cacheClient, 'get').mockResolvedValue({ item: 'fn-result' });

          const cachedFn = makeCacheable(fn, options);

          await cachedFn('foo', 'bar');

          expect(onHit).toHaveBeenCalledWith({
            segment,
            args: ['foo', 'bar'],
            id,
            result: {
              cached: expect.objectContaining({
                item: 'fn-result',
              }),
              value: 'fn-result',
              report: expect.any(Object),
            },
            stats: expect.any(Object),
          });
        });
      });

      describe('when passing a "onDrop" (function) option', () => {
        it('should call it when the item is dropped from cache', async () => {
          const fn = jest.fn();
          const options = buildTestOptions();
          const {
            cacheClient,
            segment,
            id,
            dropIf,
            onDrop,
          } = options;

          dropIf.mockReturnValue(true);
          jest.spyOn(cacheClient, 'drop').mockResolvedValue(true);

          const cachedFn = makeCacheable(fn, options);

          await cachedFn('foo', 'bar');

          expect(onDrop).toHaveBeenCalledWith({
            segment,
            args: ['foo', 'bar'],
            id,
          });
        });

        describe('when there is an error while dropping the item from the cache', () => {
          it('should call it with the error', async () => {
            const fn = jest.fn();
            const options = buildTestOptions();
            const {
              cacheClient,
              dropIf,
              onDrop,
            } = options;

            dropIf.mockReturnValue(true);
            const dropError = new Error('Ooops! Drop error.');
            jest.spyOn(cacheClient, 'drop').mockRejectedValue(dropError);

            const cachedFn = makeCacheable(fn, options);

            await cachedFn('foo', 'bar');

            await expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({
              error: dropError,
            }));
          });
        });
      });
    });
  });

  it('should have a "setCached" method', () => {
    const fn = () => {};

    const cachedFn = makeCacheable(fn, buildTestOptions());

    expect(cachedFn.setCached).toBeInstanceOf(Function);
  });

  describe('setCached(args, value)', () => {
    it('should store the value in the cache', async () => {
      const fn = jest.fn();
      const options = buildTestOptions();
      const {
        cacheClient,
        segment,
        id,
        ttl,
      } = options;

      jest.spyOn(cacheClient, 'set').mockResolvedValue(true);

      const cachedFn = makeCacheable(fn, options);

      await cachedFn.setCached(['foo', 'bar'], 'fn-result');

      expect(cacheClient.set).toHaveBeenCalledWith({ segment, id }, 'fn-result', ttl);
    });

    it('should return a promise that resolves when the value has been cached', async () => {
      const fn = jest.fn();
      const options = buildTestOptions();
      const {
        cacheClient,
      } = options;

      jest.spyOn(cacheClient, 'set').mockResolvedValue('set-result');

      const cachedFn = makeCacheable(fn, options);

      const result = cachedFn.setCached(['foo', 'bar'], 'fn-result');

      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe('set-result');
    });

    it('should return a promise that rejects when there is an error caching the value', async () => {
      const fn = jest.fn();
      const options = buildTestOptions();
      const {
        cacheClient,
      } = options;

      const setError = new Error('Ooops! Cache set error.');
      jest.spyOn(cacheClient, 'set').mockRejectedValue(setError);

      const cachedFn = makeCacheable(fn, options);

      const result = cachedFn.setCached(['foo', 'bar'], 'fn-result');

      await expect(result).rejects.toEqual(setError);
    });
  });
});
