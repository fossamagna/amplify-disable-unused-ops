import type { V6Client } from "@aws-amplify/api-graphql";
import type { Schema } from "./amplify/data/resource";

// Function with V6Client<Schema> parameter
export async function deleteTodo(client: V6Client<Schema>, id: string) {
  await client.models.Todo.delete({ id });
}

export async function updatePost(
  client: V6Client<Schema>,
  id: string,
  title: string
) {
  const result = await client.models.Post.update({ id, title });
  return result.data;
}

// Arrow function with V6Client<Schema> parameter
export const observeTodos = (client: V6Client<Schema>) => {
  return client.models.Todo.observeQuery();
};
