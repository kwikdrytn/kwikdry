// YouTube URL parsing
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch YouTube metadata via oEmbed
export async function fetchYouTubeMetadata(videoId: string) {
  const url = `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title,
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      author_name: data.author_name
    };
  } catch {
    return null;
  }
}

// Format duration (seconds to MM:SS)
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parse duration input (MM:SS to seconds)
export function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}
