import { action } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// 1. TEXT CHAT — Grok (xAI) via OpenAI-compatible API
// ---------------------------------------------------------------------------
export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(
          v.literal("user"),
          v.literal("assistant"),
          v.literal("system")
        ),
        content: v.string(),
      })
    ),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("XAI_API_KEY not configured");

    const messages = args.systemPrompt
      ? [{ role: "system" as const, content: args.systemPrompt }, ...args.messages]
      : args.messages;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content as string;
  },
});

// ---------------------------------------------------------------------------
// 2. IMAGE GENERATION / EDITING — Gemini (Google)
// ---------------------------------------------------------------------------
export const generateImage = action({
  args: {
    prompt: v.string(),
    referenceImage: v.optional(v.string()), // base64 PNG for editing
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const parts: any[] = [];

    // If editing an existing image, include it as inline_data first
    if (args.referenceImage) {
      parts.push({
        inline_data: { mime_type: "image/png", data: args.referenceImage },
      });
    }
    parts.push({ text: args.prompt });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData
    );
    return (imagePart?.inlineData?.data as string) || null;
  },
});

// ---------------------------------------------------------------------------
// 3. VIDEO GENERATION — Veo (Google) via Gemini API
// ---------------------------------------------------------------------------
export const generateVideo = action({
  args: {
    prompt: v.string(),
    aspectRatio: v.optional(v.string()), // "16:9" (default), "9:16"
    referenceImage: v.optional(v.string()), // base64 PNG for style/subject reference
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

    // Build request body
    const instance: any = { prompt: args.prompt };
    if (args.referenceImage) {
      instance.referenceImages = [
        {
          image: { inlineData: { mimeType: "image/png", data: args.referenceImage } },
          referenceType: "asset",
        },
      ];
    }
    const body: any = { instances: [instance] };
    if (args.aspectRatio) {
      body.parameters = { aspectRatio: args.aspectRatio };
    }

    // Start long-running video generation
    const startRes = await fetch(
      `${BASE_URL}/models/veo-3.1-lite-generate-preview:predictLongRunning`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!startRes.ok) {
      throw new Error(`Veo API error: ${startRes.status} ${startRes.statusText}`);
    }

    const { name: operationName } = await startRes.json();

    // Poll until done (video gen typically takes 30-120 seconds)
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (60 × 5s)
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;

      const pollRes = await fetch(`${BASE_URL}/${operationName}`, {
        headers: { "x-goog-api-key": apiKey },
      });

      if (!pollRes.ok) {
        throw new Error(`Veo poll error: ${pollRes.status} ${pollRes.statusText}`);
      }

      const status = await pollRes.json();
      if (status.done) {
        const videoUri =
          status.response?.generateVideoResponse?.generatedSamples?.[0]?.video
            ?.uri;
        if (!videoUri) throw new Error("Video generation completed but no video URI returned");

        // Download the video and store in Convex file storage (videos exceed 1 MiB value limit)
        const videoRes = await fetch(videoUri, {
          headers: { "x-goog-api-key": apiKey },
          redirect: "follow",
        });
        if (!videoRes.ok) {
          throw new Error(`Video download error: ${videoRes.status}`);
        }

        const videoBlob = await videoRes.blob();
        const storageId = await ctx.storage.store(
          new Blob([videoBlob], { type: "video/mp4" })
        );
        const url = await ctx.storage.getUrl(storageId);
        return { storageId, url }; // { storageId: Id<"_storage">, url: string | null }
      }
    }

    throw new Error("Video generation timed out after 5 minutes");
  },
});

// ---------------------------------------------------------------------------
// 4. TEXT-TO-SPEECH — Gemini TTS (Google)
// ---------------------------------------------------------------------------
export const textToSpeech = action({
  args: {
    text: v.string(),
    voice: v.optional(v.string()), // "Kore", "Puck", "Charon", "Fenrir", "Leda", "Orus"
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: args.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: args.voice || "Kore",
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini TTS error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Returns base64 PCM audio (24kHz, 16-bit, mono)
    return (data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data as string) || null;
  },
});
