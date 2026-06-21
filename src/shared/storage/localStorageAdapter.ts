export interface StorageAdapter<T> {
  load(): T | undefined;
  save(value: T): void;
  clear(): void;
}

export function createLocalStorageAdapter<T>(key: string): StorageAdapter<T> {
  return {
    load() {
      const rawValue = window.localStorage.getItem(key);

      if (!rawValue) {
        return undefined;
      }

      try {
        return JSON.parse(rawValue) as T;
      } catch {
        window.localStorage.removeItem(key);
        return undefined;
      }
    },
    save(value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    clear() {
      window.localStorage.removeItem(key);
    },
  };
}
