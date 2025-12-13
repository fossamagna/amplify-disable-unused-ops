import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource.js';

export const client = generateClient<Schema>();
