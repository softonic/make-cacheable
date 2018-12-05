# make-cacheable

Decorates functions to cache their results in a given [catbox](https://github.com/hapijs/catbox) cache client.

## Installation

```bash
npm install make-cacheable
```

## Usage

```js
// CommonJS
// const makeCacheable = require('make-cacheable');

// ES6
import makeCacheable from 'make-cacheable/es';

import catbox from 'catbox';

// See https://github.com/hapijs/catbox#client
const cacheClient = new catbox.Client(/* ... */);

function hardToComputeFunction(param1, param2) {
  /* ... */
}

const cachedFunction = makeCacheable(hardToComputeFunction, {
  cacheClient,
  segment: 'hard-to-compute-function', // Unique name within the cache client
  key: (param1, param2) => {
    return `unique-cache-key-for-the-received-params-${param1}-${param2}`;
  },
  ttl: '5h', // TTL in miliseconds or in the 'ms' package duration format

  // Optional
  ttlRandomFactor: 0.5, // TTL = ttl +- ttl * ttlRandomFactor
  dropIf: (param1, param2) => {
    return param1 === 'always refresh cache for this value';
  },
  onMiss: (...args) => { console.log('MISS', args); },
  onHit: (...args) => { console.log('HIT', args); },
  onDrop: (...args) => { console.log('DROP', args); },
});

(async () => {
  let result = await cachedFunction(param1, param2);
  // Cached!
  result = await cachedFunction(param1, param2);

  // Cache values on demand
  await cachedFunction.setCached(['param1', 'param2'], 42);
})();
```

## Testing

Clone the repository and execute:

```bash
npm test
```

## Contribute

1. Fork it: `git clone https://github.com/softonic/make-cacheable.git`
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Added some feature'`
4. Check the build: `npm run build`
5. Push to the branch: `git push origin my-new-feature`
6. Submit a pull request :D
