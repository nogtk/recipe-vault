export type Env = {
  DB: D1Database;
  APP_PASSWORD: string;
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
