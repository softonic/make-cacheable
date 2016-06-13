import getTTLGenerator from '../es/getTTLGenerator';

describe('getTTLGenerator({ ttl, ttlRandomFactor })', () => {
  it('should return a function', () => {
    expect(getTTLGenerator({ ttl: 100, ttlRandomFactor: 0.1 })).toEqual(jasmine.any(Function));
  });

  describe('the function it returns', () => {
    it('should return a random value in ttl +- ttl * ttlRandomFactor', () => {
      const ttlGenerator = getTTLGenerator({ ttl: 100, ttlRandomFactor: 0.1 });

      spyOn(Math, 'random');

      Math.random.and.returnValue(0);
      expect(ttlGenerator()).toBe(90);

      Math.random.and.returnValue(0.5);
      expect(ttlGenerator()).toBe(100);

      Math.random.and.returnValue(1);
      expect(ttlGenerator()).toBe(110);
    });

    it('should return the ttl if the ttlRandomFactor is not passed or it is 0', () => {
      expect(getTTLGenerator({ ttl: 100 })()).toBe(100);
      expect(getTTLGenerator({ ttl: 100, ttlRandomFactor: 0 })()).toBe(100);
    });
  });

  describe('when ttl is a string', () => {
    it('should be parsed as a time format', () => {
      expect(getTTLGenerator({ ttl: '430' })()).toBe(430);
      expect(getTTLGenerator({ ttl: '30s' })()).toBe(30 * 1000);
      expect(getTTLGenerator({ ttl: '5m' })()).toBe(5 * 60 * 1000);
      expect(getTTLGenerator({ ttl: '3.5h' })()).toBe(3.5 * 60 * 60 * 1000);
      expect(getTTLGenerator({ ttl: '1.5d' })()).toBe(1.5 * 24 * 60 * 60 * 1000);
    });
  });

  describe('when ttl does not resolve to a positive number', () => {
    it('should throw an error', () => {
      expect(() => {
        getTTLGenerator({ ttl: () => {} });
      }).toThrow();

      expect(() => {
        getTTLGenerator({ ttl: '14gs' });
      }).toThrow();

      expect(() => {
        getTTLGenerator({ ttl: -1 });
      }).toThrow();
    });
  });

  describe('when ttlRandomFactor is not a number between 0 and 1', () => {
    it('should throw an error', () => {
      expect(() => {
        getTTLGenerator({ ttl: 1000, ttlRandomFactor: () => {} });
      }).toThrow();

      expect(() => {
        getTTLGenerator({ ttl: 1000, ttlRandomFactor: '' });
      }).toThrow();

      expect(() => {
        getTTLGenerator({ ttl: 1000, ttlRandomFactor: -1 });
      }).toThrow();

      expect(() => {
        getTTLGenerator({ ttl: 1000, ttlRandomFactor: 2 });
      }).toThrow();
    });
  });
});
