import objectHash from 'object-hash';
import getKeyGenerator from '../getKeyGenerator';

describe('getKeyGenerator({ key } = {})', () => {
  describe('when key is a function', () => {
    it('should return a function', () => {
      const generator = getKeyGenerator({
        key: () => {},
      });
      expect(generator).toBeInstanceOf(Function);
    });

    describe('the returned function', () => {
      it('should forward its parameters to the key function', () => {
        const key = jest.fn(() => 'foo');

        const keyGenerator = getKeyGenerator({ key });

        keyGenerator('foo', 'bar');

        expect(key).toHaveBeenCalledWith('foo', 'bar');
      });

      describe('when the key function returns a string', () => {
        it('should return it', () => {
          const key = () => 'foo';
          const keyGenerator = getKeyGenerator({ key });
          expect(keyGenerator()).toBe('foo');
        });
      });

      describe('when the key function returns something else', () => {
        it('should return a hash of the value', () => {
          const key = () => ['foo'];
          const keyGenerator = getKeyGenerator({ key });
          expect(keyGenerator()).toBe(objectHash(['foo']));
        });
      });
    });
  });

  describe('when key is not a function', () => {
    it('should throw an error', () => {
      expect(() => {
        getKeyGenerator({ key: '123' });
      }).toThrow();
    });
  });

  describe('when key is NOT defined', () => {
    it('should return a function', () => {
      expect(getKeyGenerator()).toBeInstanceOf(Function);
    });

    describe('the returned function', () => {
      it('should return a hash of its arguments', () => {
        const keyGenerator = getKeyGenerator();

        const result = keyGenerator('foo', 'bar');
        const expectedResult = objectHash(['foo', 'bar']);

        expect(result).toBe(expectedResult);
      });
    });
  });
});
