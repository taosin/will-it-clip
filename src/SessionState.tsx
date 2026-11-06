import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
export type Memory = Map<string, unknown>;
export const SessionMemory = createContext<Memory | null>(null);
// The map belongs to one image and is destroyed when it is removed. Nothing is persisted.
export function useImageState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const memory = useContext(SessionMemory)!;
  const [value, update] = useState<T>(() =>
    memory.has(key) ? (memory.get(key) as T) : initial,
  );
  if (!memory.has(key)) memory.set(key, value);
  const setValue: Dispatch<SetStateAction<T>> = (next) => {
    const value =
      typeof next === "function"
        ? (next as (previous: T) => T)(memory.get(key) as T)
        : next;
    memory.set(key, value);
    update(value);
    queueMicrotask(() =>
      (memory.get("_notify") as (() => void) | undefined)?.(),
    );
  };
  return [value, setValue];
}
