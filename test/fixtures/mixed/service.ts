import { generateClient } from 'aws-amplify/data';
import { sharedClient } from './client.js';
import type { Schema } from './amplify/data/resource.js';

// Local client usage
const localClient = generateClient<Schema>();

export async function createLocalTodo(content: string) {
  await localClient.models.Todo.create({ content });
}

export async function listLocalTodos() {
  return await localClient.models.Todo.list();
}

// Shared client usage
export async function createSharedPost(title: string) {
  await sharedClient.models.Post.create({ title });
}

export async function deleteSharedPost(id: string) {
  await sharedClient.models.Post.delete({ id });
}
