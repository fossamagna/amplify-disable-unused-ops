import { generateClient } from 'aws-amplify/data';
import React from 'react';
import type { Schema } from './amplify/data/resource.js';

const amplifyClient = generateClient<Schema>();

type Todo = Schema["Todo"]["type"];

export function TodoList() {
  const [todos, setTodos] = React.useState<Todo[]>([]);

  React.useEffect(() => {
    amplifyClient.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos(data.items),
    });
  }, []);

  const handleCreate = async (content: string) => {
    await amplifyClient.models.Todo.create({ content });
  };

  const handleDelete = async (id: string) => {
    await amplifyClient.models.Todo.delete({ id });
  };

  return <div></div>;
}
