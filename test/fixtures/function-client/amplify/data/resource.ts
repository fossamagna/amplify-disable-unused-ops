import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
    done: a.boolean(),
  }),
  Post: a.model({
    title: a.string(),
    content: a.string(),
  }),
  Comment: a.model({
    text: a.string(),
  }),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({ schema });
