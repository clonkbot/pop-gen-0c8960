import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Get all posts for the feed
export const list = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .collect();

    // Get video URLs for completed posts
    const postsWithUrls = await Promise.all(
      posts.map(async (post) => {
        let videoUrl = post.videoUrl;
        if (post.videoStorageId && !videoUrl) {
          videoUrl = await ctx.storage.getUrl(post.videoStorageId) ?? undefined;
        }
        return { ...post, videoUrl };
      })
    );

    return postsWithUrls;
  },
});

// Get user's posts
export const myPosts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const postsWithUrls = await Promise.all(
      posts.map(async (post) => {
        let videoUrl = post.videoUrl;
        if (post.videoStorageId && !videoUrl) {
          videoUrl = await ctx.storage.getUrl(post.videoStorageId) ?? undefined;
        }
        return { ...post, videoUrl };
      })
    );

    return postsWithUrls;
  },
});

// Create a new post (starts video generation)
export const create = mutation({
  args: {
    prompt: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const postId = await ctx.db.insert("posts", {
      userId,
      username: args.username,
      prompt: args.prompt,
      status: "generating",
      createdAt: Date.now(),
      likes: 0,
    });

    return postId;
  },
});

// Update post with generated video
export const updateWithVideo = mutation({
  args: {
    postId: v.id("posts"),
    videoStorageId: v.id("_storage"),
    videoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      videoStorageId: args.videoStorageId,
      videoUrl: args.videoUrl,
      status: "completed",
    });
  },
});

// Mark post as failed
export const markFailed = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      status: "failed",
    });
  },
});

// Toggle like on a post
export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", args.postId))
      .first();

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.postId, { likes: Math.max(0, post.likes - 1) });
    } else {
      await ctx.db.insert("likes", { postId: args.postId, userId });
      await ctx.db.patch(args.postId, { likes: post.likes + 1 });
    }
  },
});

// Check if user liked a post
export const userLikes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user_post", (q) => q.eq("userId", userId))
      .collect();

    return likes.map((l) => l.postId);
  },
});

// Generate video action
export const generateVideo = action({
  args: {
    postId: v.id("posts"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Enhance prompt for Pixar-style kids content
      const enhancedPrompt = `Pixar-style 3D animated scene for children: ${args.prompt}. Bright colors, cute characters, smooth animation, family-friendly, wholesome, playful, high quality CGI animation.`;

      const result = await ctx.runAction(api.ai.generateVideo, {
        prompt: enhancedPrompt,
        aspectRatio: "16:9",
      });

      if (result && result.storageId && result.url) {
        await ctx.runMutation(api.posts.updateWithVideo, {
          postId: args.postId,
          videoStorageId: result.storageId,
          videoUrl: result.url,
        });
      } else {
        await ctx.runMutation(api.posts.markFailed, { postId: args.postId });
      }
    } catch (error) {
      console.error("Video generation failed:", error);
      await ctx.runMutation(api.posts.markFailed, { postId: args.postId });
    }
  },
});

// Delete a post
export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post || post.userId !== userId) throw new Error("Not authorized");

    // Delete associated likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();

    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    // Delete storage if exists
    if (post.videoStorageId) {
      await ctx.storage.delete(post.videoStorageId);
    }

    await ctx.db.delete(args.postId);
  },
});
