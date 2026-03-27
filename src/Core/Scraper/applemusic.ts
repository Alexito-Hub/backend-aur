import axios from "axios";

interface AppleMusicSong {
  title: string;
  artist: string;
  album: string;
  url: string;
  thumbnail: string;
  download: string | null;
}

export default new class AppleMusic {
  private async getToken(): Promise<string> {
    const base = "https://music.apple.com";

    const { data: html } = await axios.get(base, {
      headers: { "user-agent": "Mozilla/5.0" }
    });

    const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!jsMatch) throw new Error("JS bundle not found");

    const { data: js } = await axios.get(base + jsMatch[1], {
      headers: { "user-agent": "Mozilla/5.0" }
    });

    const tokenMatch = js.match(/eyJh[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);
    if (!tokenMatch) throw new Error("Token not found");

    return `Bearer ${tokenMatch[0]}`;
  }

  async search(query: string): Promise<AppleMusicSong[] | { error: string }> {
    try {
      const token = await this.getToken();

      const { data } = await axios.get(
        "https://amp-api-edge.music.apple.com/v1/catalog/id/search",
        {
          params: {
            term: query,
            limit: 5,
            types: "songs"
          },
          headers: {
            authorization: token,
            origin: "https://music.apple.com",
            referer: "https://music.apple.com/",
            "user-agent": "Mozilla/5.0"
          }
        }
      );

      const songs = data?.results?.songs?.data || [];

      return songs.map((v: any) => ({
        title: v.attributes.name,
        artist: v.attributes.artistName,
        album: v.attributes.albumName,
        url: v.attributes.url,
        thumbnail: v.attributes.artwork.url
          .replace("{w}", "500")
          .replace("{h}", "500"),
        download: v.attributes.previews?.[0]?.url || null
      }));
    } catch (e: any) {
      return { error: e.toString() };
    }
  }
}