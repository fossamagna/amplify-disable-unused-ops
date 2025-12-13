import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource.js';

const sharedClient = generateClient<Schema>();

export { sharedClient };
