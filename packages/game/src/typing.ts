export type IfNever<T, TRUE, FALSE> = [T] extends [never] ? TRUE : FALSE;
