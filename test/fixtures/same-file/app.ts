import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource.js';

const client = generateClient<Schema>();

async function createTodo(content: string) {
  await client.models.Todo.create({ content });
}

async function listTodos() {
  const todos = await client.models.Todo.list();
  return todos;
}

async function getTodo(id: string) {
  const todo = await client.models.Todo.get({ id });
  return todo;
}

async function updatePost(id: string, title: string) {
  await client.models.Post.update({ id, title });
}

async function deletePost(id: string) {
  await client.models.Post.delete({ id });
}
