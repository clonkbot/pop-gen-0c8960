import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Video posts in the feed
  posts: defineTable({
    userId: v.id("users"),
    username: v.string(),
    prompt: v.string(),
    videoStorageId: v.optional(v.id("_storage")),
    videoUrl: v.optional(v.string()),
    status: v.union(v.literal("generating"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    likes: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Likes tracking
  likes: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
  })
    .index("by_post", ["postId"])
    .index("by_user_post", ["userId", "postId"]),
});
