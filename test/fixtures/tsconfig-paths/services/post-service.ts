// Using path mapping to import amplifyClient
import { amplifyClient } from "@/lib/amplify-client";

export async function getPost(id: string) {
  const { data } = await amplifyClient.models.Post.get({ id });
  return data;
}

export async function updatePost(id: string, content: string) {
  const { data } = await amplifyClient.models.Post.update({ id, content });
  return data;
}

export async function deletePost(id: string) {
  const { data } = await amplifyClient.models.Post.delete({ id });
  return data;
}
