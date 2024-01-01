const caches = new Set<WeakRef<Map<string, any>>>();

export function clearMemoizationCache() {
	for (const ref of Array.from(caches.values())) {
		const cache = ref.deref();

		if (cache === undefined) {
			caches.delete(ref);
			continue;
		}

		cache.clear();
	}
}

export function memoize<T extends (...args: any[]) => any>(fn: T): T {
	const cache = new Map<string, ReturnType<T>>();

	const memoizedFn = ((...args: Parameters<T>) => {
		const key = args.join('\0');
		if (cache.has(key)) return cache.get(key);
		const result = fn(...args);
		cache.set(key, result);
		return result;
	}) as T;

	caches.add(new WeakRef(cache));

	return memoizedFn;
}
