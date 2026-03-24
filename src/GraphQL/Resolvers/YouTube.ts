import YouTube from '../../Core/Scraper/youtube';
import { GraphQLContext } from '../../Core/Types/GraphQL';

export default {
    Query: {
        searchYouTube: async (_: any, { query }: { query: string }, ctx: GraphQLContext) => {
            const key = `yt_search_${query}`;

            const cached = ctx.cache.get(key);
            if (cached) return cached;

            try {
                const scraper = new YouTube();
                const results = await scraper.search(query);

                ctx.cache.set(key, results, 300);
                return results;
            } catch (error) {
                console.error('Error in searchYouTube resolver:', error);
                throw new Error('Failed to search YouTube');
            }
        }
    }
};