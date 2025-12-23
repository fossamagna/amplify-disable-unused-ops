import type { V6Client } from "@aws-amplify/api-graphql";
import type { Schema } from "./amplify/data/resource";

// Variable declared with V6Client<Schema> type
const client: V6Client<Schema> = null as any;

export async function getTodos() {
  const result = await client.models.Todo.list();
  return result.data;
}

export async function createPost(title: string, content: string) {
  const result = await client.models.Post.create({ title, content });
  return result.data;
}
