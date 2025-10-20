// Cloudflare Worker: Book Animator Proxy
// Endpoints:
//   POST /images              -> OpenAI images (scene art)
//   POST /voice/openai        -> OpenAI TTS (audio/mpeg)
//   POST /voice/11labs        -> ElevenLabs TTS (audio/mpeg)
//   GET  /sfx/search?query=.. -> Freesound search (JSON)
//   GET  /sfx/get?id=1234     -> Stream MP3 preview by Freesound id
//   POST /sfx/auto            -> Auto-pick an SFX for scene text (streams MP3)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response('', { headers: corsHeaders() });
    }

    try {
      // Health
      if (url.pathname === '/' && request.method === 'GET') {
        return json({ ok: true, service: 'Book Animator Proxy' });
      }

      // ---- IMAGES: OpenAI ----
      if (url.pathname === '/images' && request.method === 'POST') {
        requireEnv(env, ['OPENAI_API_KEY']);
        const body = await request.json();
        const prompt = body.prompt || 'scene illustration';
        const n = Math.min(Math.max(body.n || 1, 1), 4);
        const size = body.size || '512x512';

        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt,
            n,
            size,
          }),
        });
        const out = await res.json();
        return json(out);
      }

      // ---- VOICE: OpenAI TTS -> audio/mpeg ----
      // Body: { text, voice }  // voice examples: ember, maple, juniper, spruce, alloy, aria, sage...
      if (url.pathname === '/voice/openai' && request.method === 'POST') {
        requireEnv(env, ['OPENAI_API_KEY']);
        const { text, voice } = await request.json();
        if (!text) return bad('Missing "text"');

        // Normalize voice to lowercase; fallback to alloy if not set
        const v = (voice || 'alloy').toLowerCase();

        const res = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-tts',
            input: text,
            voice: v,             // client picks (ember/maple/...)
            format: 'mp3'
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return bad(`OpenAI TTS error: ${res.status} ${err}`);
        }
        const audio = await res.arrayBuffer();
        return new Response(audio, { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'audio/mpeg' } });
      }

      // ---- VOICE: ElevenLabs -> audio/mpeg ----
      // Body: { text, voice_id, model_id?, voice_settings? }
      if (url.pathname === '/voice/11labs' && request.method === 'POST') {
        requireEnv(env, ['ELEVEN_API_KEY']);
        const { text, voice_id, model_id, voice_settings } = await request.json();
        if (!text || !voice_id) return bad('Missing "text" or "voice_id"');

        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
          method: 'POST',
          headers: {
            'xi-api-key': env.ELEVEN_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text,
            model_id: model_id || 'eleven_multilingual_v2',
            voice_settings: voice_settings || { stability: 0.5, similarity_boost: 0.75 }
          })
        });

        if (!res.ok) {
          const errTxt = await res.text();
          return bad(`ElevenLabs error: ${res.status} ${errTxt}`);
        }
        const audio = await res.arrayBuffer();
        return new Response(audio, { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'audio/mpeg' } });
      }

      // ---- SFX SEARCH: Freesound ----
      if (url.pathname === '/sfx/search' && request.method === 'GET') {
        requireEnv(env, ['FREESOUND_API_KEY']);
        const query = url.searchParams.get('query') || '';
        if (!query) return bad('Missing ?query');
        const duration_gte = url.searchParams.get('duration_gte') || 0;
        const duration_lte = url.searchParams.get('duration_lte') || 15;
        const page_size = Math.min(parseInt(url.searchParams.get('page_size') || '6', 10), 20);

        const fsUrl = new URL('https://freesound.org/apiv2/search/text/');
        fsUrl.searchParams.set('query', query);
        fsUrl.searchParams.set('page_size', String(page_size));
        fsUrl.searchParams.set('fields', 'id,name,previews,license,filesize,duration,username');
        fsUrl.searchParams.set('filter', `duration:[${duration_gte} TO ${duration_lte}]`);

        const res = await fetch(fsUrl, { headers: { 'Authorization': `Token ${env.FREESOUND_API_KEY}` } });
        if (!res.ok) return bad(`Freesound search error: ${res.status}`);
        const out = await res.json();
        return json(out);
      }

      // ---- SFX GET: stream MP3 preview by id ----
      if (url.pathname === '/sfx/get' && request.method === 'GET') {
        requireEnv(env, ['FREESOUND_API_KEY']);
        const id = url.searchParams.get('id');
        if (!id) return bad('Missing ?id');
        const metaRes = await fetch(`https://freesound.org/apiv2/sounds/${id}/?fields=previews`, {
          headers: { 'Authorization': `Token ${env.FREESOUND_API_KEY}` }
        });
        if (!metaRes.ok) return bad(`Freesound sound error: ${metaRes.status}`);
        const meta = await metaRes.json();
        const mp3 = meta?.previews?.['preview-hq-mp3'] || meta?.previews?.['preview-lq-mp3'];
        if (!mp3) return bad('No MP3 preview available.');
        const mp3Res = await fetch(mp3);
        if (!mp3Res.ok) return bad('Could not fetch preview mp3.');
        const buf = await mp3Res.arrayBuffer();
        return new Response(buf, { headers: { ...corsHeaders(), 'Content-Type': 'audio/mpeg' } });
      }

      // ---- SFX AUTO: pick from scene text ----
      if (url.pathname === '/sfx/auto' && request.method === 'POST') {
        requireEnv(env, ['FREESOUND_API_KEY']);
        const { text, max_duration } = await request.json();
        if (!text) return bad('Missing "text"');
        const q = pickSfxQuery(text);

        // Search
        const fsUrl = new URL('https://freesound.org/apiv2/search/text/');
        fsUrl.searchParams.set('query', q);
        fsUrl.searchParams.set('page_size', '1');
        fsUrl.searchParams.set('fields', 'id,name,previews,license,filesize,duration,username');
        fsUrl.searchParams.set('filter', `duration:[0 TO ${max_duration || 10}]`);
        const res = await fetch(fsUrl, { headers: { 'Authorization': `Token ${env.FREESOUND_API_KEY}` } });
        if (!res.ok) return bad(`Freesound search error: ${res.status}`);
        const out = await res.json();
        const choice = out.results?.[0];
        if (!choice) return bad('No SFX match for: ' + q);

        // Stream MP3
        const mp3 = choice?.previews?.['preview-hq-mp3'] || choice?.previews?.['preview-lq-mp3'];
        if (!mp3) return bad('No MP3 preview.');
        const mp3Res = await fetch(mp3);
        if (!mp3Res.ok) return bad('Could not fetch preview mp3.');
        const buf = await mp3Res.arrayBuffer();
        return new Response(buf, { headers: { ...corsHeaders(), 'Content-Type': 'audio/mpeg' } });
      }

      // Default
      return json({ ok: true, hint: 'Use /images, /voice/openai, /voice/11labs, /sfx/*' });

    } catch (err) {
      return bad(err.message || String(err));
    }
  },
};

// ---- helpers
function corsHeaders() {
  // TIP: restrict this to your GitHub Pages origin for production.
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, xi-api-key',
  };
}
function json(obj) { return new Response(JSON.stringify(obj), { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }); }
function bad(message, status=400) { return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }); }
function requireEnv(env, keys){ for(const k of keys){ if(!env[k]) throw new Error(`Missing environment variable: ${k}`); } }
function pickSfxQuery(text){
  const t = (text||'').toLowerCase();
  const table = [
    [/thunder|storm|lightning/, 'thunder'],
    [/rain|downpour|drizzle/, 'rain'],
    [/wind|gust|howl/, 'wind'],
    [/ocean|waves|sea|beach/, 'ocean waves'],
    [/river|stream|brook/, 'running water'],
    [/forest|woods|leaves|birds/, 'forest ambience'],
    [/fire|flames|campfire/, 'fire crackle'],
    [/sword|clash|battle|fight/, 'sword clash'],
    [/footsteps|walk|run|sneak/, 'footsteps'],
    [/door|knock|creak/, 'door creak'],
    [/car|engine|drive/, 'car engine'],
    [/city|street|traffic/, 'city ambience'],
    [/crowd|applause|cheer/, 'applause'],
    [/monster|roar|dragon/, 'monster roar'],
    [/magic|spell|sparkle|wand/, 'magical shimmer'],
  ];
  for (const [re, q] of table) if (re.test(t)) return q;
  return 'cinematic whoosh';
}