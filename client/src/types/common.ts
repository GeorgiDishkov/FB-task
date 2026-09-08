export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type Nullable<Value> = Value | null;

/** Every component that accepts an outer class name. */
export interface WithClassName {
  className?: string;
}
