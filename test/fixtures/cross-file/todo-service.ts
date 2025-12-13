import { client } from './amplify-client.js';

export async function createTodo(content: string) {
  const result = await client.models.Todo.create({ content });
  return result;
}

export async function listTodos() {
  const result = await client.models.Todo.list();
  return result;
}

export async function updateTodo(id: string, content: string) {
  await client.models.Todo.update({ id, content });
}
