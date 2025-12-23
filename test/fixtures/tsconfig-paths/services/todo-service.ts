// Using path mapping to import amplifyClient
import { amplifyClient } from "@/lib/amplify-client";

export async function getTodos() {
  const { data } = await amplifyClient.models.Todo.list();
  return data;
}

export async function createTodo(title: string) {
  const { data } = await amplifyClient.models.Todo.create({ title });
  return data;
}
