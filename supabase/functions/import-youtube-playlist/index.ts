import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PlaylistItem {
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    resourceId: {
      videoId: string;
    };
    position: number;
  };
  contentDetails?: {
    videoId: string;
  };
}

interface VideoDetails {
  id: string;
  contentDetails?: {
    duration: string;
  };
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number | null {
  if (!duration) return null;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Extract playlist ID from various URL formats
function extractPlaylistId(url: string): string | null {
  const patterns = [
    /[?&]list=([^&]+)/,
    /\/playlist\?list=([^&]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // If it's already just an ID
  if (/^PL[a-zA-Z0-9_-]+$/.test(url)) {
    return url;
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!youtubeApiKey) {
      console.error('YOUTUBE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'YouTube API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user's profile to check if admin and get org
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { playlistUrl, categoryId } = await req.json();

    if (!playlistUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Playlist URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid playlist URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching playlist: ${playlistId}`);

    // Fetch all playlist items (paginated)
    const allItems: PlaylistItem[] = [];
    let nextPageToken: string | undefined;

    do {
      const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      playlistUrl.searchParams.set('part', 'snippet,contentDetails');
      playlistUrl.searchParams.set('playlistId', playlistId);
      playlistUrl.searchParams.set('maxResults', '50');
      playlistUrl.searchParams.set('key', youtubeApiKey);
      if (nextPageToken) {
        playlistUrl.searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetch(playlistUrl.toString());
      const data = await response.json();

      if (!response.ok) {
        console.error('YouTube API error:', data);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: data.error?.message || 'Failed to fetch playlist' 
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      allItems.push(...(data.items || []));
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    console.log(`Found ${allItems.length} videos in playlist`);

    if (allItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, skipped: 0, message: 'Playlist is empty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video IDs for duration lookup
    const videoIds = allItems.map(item => 
      item.contentDetails?.videoId || item.snippet.resourceId.videoId
    ).filter(Boolean);

    // Fetch video details (duration) in batches of 50
    const videoDetailsMap = new Map<string, VideoDetails>();
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      videosUrl.searchParams.set('part', 'contentDetails');
      videosUrl.searchParams.set('id', batch.join(','));
      videosUrl.searchParams.set('key', youtubeApiKey);

      const response = await fetch(videosUrl.toString());
      const data = await response.json();

      if (response.ok && data.items) {
        for (const video of data.items) {
          videoDetailsMap.set(video.id, video);
        }
      }
    }

    // Check existing videos to avoid duplicates
    const { data: existingVideos } = await supabase
      .from('training_videos')
      .select('youtube_video_id')
      .eq('organization_id', profile.organization_id)
      .in('youtube_video_id', videoIds);

    const existingVideoIds = new Set(existingVideos?.map(v => v.youtube_video_id) || []);

    // Prepare videos for insertion
    const videosToInsert = allItems
      .filter(item => {
        const videoId = item.contentDetails?.videoId || item.snippet.resourceId.videoId;
        return videoId && !existingVideoIds.has(videoId);
      })
      .map((item, index) => {
        const videoId = item.contentDetails?.videoId || item.snippet.resourceId.videoId;
        const videoDetails = videoDetailsMap.get(videoId);
        const thumbnail = item.snippet.thumbnails.high?.url || 
                         item.snippet.thumbnails.medium?.url || 
                         item.snippet.thumbnails.default?.url ||
                         `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        return {
          organization_id: profile.organization_id,
          youtube_video_id: videoId,
          title: item.snippet.title,
          description: item.snippet.description || null,
          thumbnail_url: thumbnail,
          duration_seconds: videoDetails?.contentDetails?.duration 
            ? parseDuration(videoDetails.contentDetails.duration) 
            : null,
          category_id: categoryId || null,
          sort_order: item.snippet.position || index,
          is_active: true,
          is_required: false,
          required_for_roles: [],
        };
      });

    console.log(`Inserting ${videosToInsert.length} new videos (${existingVideoIds.size} already exist)`);

    if (videosToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('training_videos')
        .insert(videosToInsert);

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to insert videos: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: videosToInsert.length,
        skipped: existingVideoIds.size,
        total: allItems.length,
        message: `Imported ${videosToInsert.length} videos${existingVideoIds.size > 0 ? `, skipped ${existingVideoIds.size} duplicates` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error importing playlist:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to import playlist';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
