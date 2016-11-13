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
  ttl: '5h', // TTL in miliseconds or in the 'ms' package duration format

  // Optional
  ttlRandomFactor: 0.5, // TTL = ttl +- ttl * ttlRandomFactor
  key: (param1, param2) => {
    return 'unique-cache-key-for-the-received-params';
  }
});

cachedFunction(param1, param2).then(result => {
  // Cached!
});
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
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D
