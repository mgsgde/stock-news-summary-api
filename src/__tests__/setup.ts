// Vitest setup: lets Knex load the TypeScript migrations. Knex loads them with the plain Node
// require(), which cannot read .ts files, so tsx registers its loader for require() here.

import { register } from 'tsx/cjs/api';

register();
