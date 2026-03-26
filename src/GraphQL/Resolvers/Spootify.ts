import Spotify from '../../Core/Scraper/spotify';
import { GraphQLContext } from '../../Core/Types/GraphQL';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a raw Spotify track object (from scraper) into the GraphQL shape.
 * Keeps the resolver thin and avoids repeating the same mapping logic.
 */
function normaliseTrack(raw: any) {
    return {
        id:         raw.id,
        title:      raw.title,
        duration:   typeof raw.duration === 'number' ? raw.duration : null,
        popularity: raw.popularity ?? null,
        thumbnail:  raw.thumbnail  ?? null,
        date:       raw.date       ?? null,
        url:        raw.url,
        artists:    Array.isArray(raw.artist)
            ? raw.artist.map((a: any) => ({ id: a.id, name: a.name, type: a.type ?? null }))
            : [],
    };
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

export default {
    Query: {
        /**
         * Full-text Spotify track search.
         * Cache key: `spotify_search_<query>_<limit>` — TTL 5 min.
         * Throws a user-friendly GraphQL error on scraper failure.
         */
        searchSpotify: async (
            _: unknown,
            { query, limit = 20 }: { query: string; limit?: number },
            ctx: GraphQLContext,
        ) => {
            if (!query?.trim()) {
                throw new Error('El parámetro "query" no puede estar vacío.');
            }

            const clampedLimit = Math.min(Math.max(1, limit), 50);
            const cacheKey     = `spotify_search_${query}_${clampedLimit}`;
            const cached       = ctx.cache.get(cacheKey);
            if (cached) return cached;

            let scraper: Spotify;
            try {
                scraper = new Spotify();
            } catch (initErr: any) {
                // Missing env vars — surface clearly instead of a cryptic 500
                throw new Error(
                    'Spotify no está configurado en este entorno. ' +
                    'Contacta al administrador. (' + initErr.message + ')',
                );
            }

            try {
                const results = await scraper.search(query, 'track', clampedLimit);
                const normalised = results.map(normaliseTrack);
                ctx.cache.set(cacheKey, normalised, 300); // 5 min
                return normalised;
            } catch (err: any) {
                // Log internally but never leak internal details to the client
                console.error('[GraphQL][searchSpotify] Scraper error:', err?.message ?? err);
                throw new Error('No se pudo completar la búsqueda en Spotify. Inténtalo de nuevo.');
            }
        },

        /**
         * Fetch a single track by its Spotify URL.
         * Cache key: `spotify_track_<trackId>` — TTL 10 min.
         */
        spotifyTrack: async (
            _: unknown,
            { url }: { url: string },
            ctx: GraphQLContext,
        ) => {
            if (!url?.includes('spotify.com/track/')) {
                throw new Error('URL de Spotify inválida. Debe incluir "/track/".');
            }

            const trackId  = url.split('track/')[1]?.split('?')[0];
            const cacheKey = `spotify_track_${trackId}`;
            const cached   = ctx.cache.get(cacheKey);
            if (cached) return cached;

            let scraper: Spotify;
            try {
                scraper = new Spotify();
            } catch (initErr: any) {
                throw new Error(
                    'Spotify no está configurado en este entorno. (' + initErr.message + ')',
                );
            }

            try {
                const info       = await scraper.getInfo(url);
                const normalised = normaliseTrack(info);
                ctx.cache.set(cacheKey, normalised, 600); // 10 min
                return normalised;
            } catch (err: any) {
                console.error('[GraphQL][spotifyTrack] Scraper error:', err?.message ?? err);
                throw new Error('No se pudo obtener la información del track. Verifica la URL.');
            }
        },
    },
};