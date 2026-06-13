export type Env = {
  AI: {
    run: (model: string, input: unknown) => Promise<unknown>;
  };
  AI_MODEL?: string;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALLOWED_EMAIL: string;
  SESSION_SECRET: string;
};

export type RecipeStatus = "want_to_make" | "made";

export type Recipe = {
  id: string;
  url: string;
  title: string;
  status: RecipeStatus;
  tags: string[];
  ingredients: string;
  steps: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeInput = {
  url: string;
  title: string;
  status: RecipeStatus;
  tags: string[];
  ingredients: string;
  steps: string;
  notes: string;
};
