import { client as amplifyClient } from './amplify-client.js';
import React from 'react';
import { Schema } from './amplify/data/resource.js';

type Comment = Schema["Comment"]["type"];

export function CommentList() {
  const [comments, setComments] = React.useState<Comment[]>([]);

  React.useEffect(() => {
    amplifyClient.models.Comment.observeQuery().subscribe({
      next: (data) => setComments(data.items),
    });
  }, []);

  const handleCreate = async (text: string) => {
    await amplifyClient.models.Comment.create({ text });
  };

  return <div></div>;
}
