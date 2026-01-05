interface ImportMeta {
  glob(
    pattern: string,
    options?: {
      readonly eager?: boolean;
      readonly import?: string;
      readonly query?: string;
    },
  ): Record<string, () => Promise<unknown>>;
}

