export type DataSource = "supabase" | "mock";

export type DataResult<T> = {
  data: T;
  source: DataSource;
  error?: string;
};

export function mockResult<T>(data: T, error?: unknown): DataResult<T> {
  return {
    data,
    source: "mock",
    error: error instanceof Error ? error.message : typeof error === "string" ? error : undefined
  };
}

export function supabaseResult<T>(data: T): DataResult<T> {
  return {
    data,
    source: "supabase"
  };
}

export function shouldUseMock<T>(data: T[] | null | undefined, error: unknown) {
  return Boolean(error) || !data || data.length === 0;
}
