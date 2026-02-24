export default new class Cache {
    private cache: Map<string, { data: any; expiry: number }> = new Map();

    /**
     * Set a value in cache
     * @param key cache key
     * @param value data to store
     * @param ttlSeconds time to live in seconds
     */
    public set(key: string, value: any, ttlSeconds: number = 600) {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { data: value, expiry });
    }

    /**
     * Get a value from cache if it exists and is not expired
     */
    public get(key: string): any | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    /**
     * Clear expired items (can be called periodically)
     */
    public sweep() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
            }
        }
    }
}
