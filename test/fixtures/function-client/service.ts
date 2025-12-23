import { createAmplifyClient } from "./amplify-client";

export async function getTodos() {
  const client = await createAmplifyClient('prod');
  const { data: todos } = await client.models.Todo.list();
  return todos;
}

export async function createPost(title: string) {
  const client = await createAmplifyClient('prod');
  const { data: post } = await client.models.Post.create({ title });
  return post;
}
