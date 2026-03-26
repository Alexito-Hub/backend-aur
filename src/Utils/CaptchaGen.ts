export class CaptchaGen {
    public static generate(width = 200, height = 60, charCount = 5): { svg: string; text: string } {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let text = '';
        for (let i = 0; i < charCount; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const bgColors = ['#1A1B26', '#1E1E2E', '#24283B', '#16161E'];
        const textColors = ['#7AA2F7', '#9ECE6A', '#E0AF68', '#BB9AF7', '#F7768E', '#2AC3DE'];
        const bg = bgColors[Math.floor(Math.random() * bgColors.length)];

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        svg += `<rect width="100%" height="100%" fill="${bg}" />`;

        // Add 5-8 noise lines with random bezier curves
        const pathCount = Math.floor(Math.random() * 4) + 5;
        for (let i = 0; i < pathCount; i++) {
            const color = textColors[Math.floor(Math.random() * textColors.length)];
            const opacity = Math.random() * 0.4 + 0.2;
            const startX = Math.random() * width;
            const startY = Math.random() * height;
            const c1x = Math.random() * width, c1y = Math.random() * height;
            const c2x = Math.random() * width, c2y = Math.random() * height;
            const endX = Math.random() * width, endY = Math.random() * height;
            svg += `<path d="M${startX} ${startY} C${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${Math.random() * 2 + 1}" fill="none" />`;
        }

        // Draw distorted text
        const step = width / (charCount + 1);
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const color = textColors[Math.floor(Math.random() * textColors.length)];
            const x = step * (i + 1) + (Math.random() * 6 - 3);
            const y = height / 2 + 10 + (Math.random() * 10 - 5);
            const angle = Math.random() * 40 - 20; // -20 to 20 degrees
            const scale = Math.random() * 0.4 + 0.9; // 0.9 to 1.3
            const opacity = Math.random() * 0.2 + 0.8;
            
            // Generate basic path for characters using text element for simplicity, but heavily distorted via transform
            svg += `<text x="${x}" y="${y}" fill="${color}" fill-opacity="${opacity}" font-family="monospace, sans-serif" font-size="${30 * scale}px" font-weight="bold" text-anchor="middle" transform="rotate(${angle} ${x} ${y})">${char}</text>`;
        }

        // Add noise dots
        const dotCount = Math.floor(Math.random() * 40) + 20;
        for (let i = 0; i < dotCount; i++) {
            const color = textColors[Math.floor(Math.random() * textColors.length)];
            const x = Math.random() * width;
            const y = Math.random() * height;
            const r = Math.random() * 1.5 + 0.5;
            svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="${Math.random() * 0.5 + 0.1}" />`;
        }

        svg += `</svg>`;
        return { svg, text };
    }
}
