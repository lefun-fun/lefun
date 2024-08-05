export type IfNever<T, TRUE, FALSE> = [T] extends [never] ? TRUE : FALSE;

// Make sure that this works!
export type IfUnknown<T, TRUE, FALSE> = [T] extends [unknown] ? TRUE : FALSE;

export type IfNull<T, Y, N> = [T] extends [null] ? Y : N;

// export type IfEmptyObject<T, Y, N> = [T]
