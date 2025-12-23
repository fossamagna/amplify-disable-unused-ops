import { generateClient } from "aws-amplify/data";
import type { Schema } from './amplify/data/resource.js';

type DataClientEnv = 'prod' | 'dev';

export async function createAmplifyClient(
  env: DataClientEnv,
): Promise<any> {
  // Some configuration logic here
  return generateClient<Schema>();
}
