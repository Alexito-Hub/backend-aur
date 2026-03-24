import YouTube from '../../Core/Scraper/youtube';

export default {
    Query: {
        searchYouTube: async (_: any, { query }: { query: string }) => {
            try {
                const scraper = new YouTube();
                const results = await scraper.search(query);
                return results;
            } catch (error) {
                console.error('Error in searchYouTube resolver:', error);
                throw new Error('Failed to search YouTube');
            }
        }
    }
};
