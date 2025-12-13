import { client } from './amplify-client.js';

export async function createPost(title: string, content: string) {
  await client.models.Post.create({ title, content });
}

export async function deletePost(id: string) {
  await client.models.Post.delete({ id });
}

export async function subscribeToNewPosts(callback: (post: any) => void) {
  client.models.Post.onCreate().subscribe({
    next: callback,
  });
}
