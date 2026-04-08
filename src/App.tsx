import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Id } from "../convex/_generated/dataModel";

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: "error" | "success"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-4 border-4 border-black shadow-[6px_6px_0_0_#000] ${type === "error" ? "bg-red-400" : "bg-green-400"}`}>
      <div className="flex items-center gap-3">
        <span className="font-black text-black uppercase tracking-wider">{message}</span>
        <button onClick={onClose} className="font-black text-black hover:text-white transition-colors">×</button>
      </div>
    </div>
  );
}

// Auth form component
function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signUp");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      await signIn("password", formData);
    } catch (err) {
      setError(flow === "signIn" ? "Invalid credentials" : "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymous = async () => {
    setIsLoading(true);
    try {
      await signIn("anonymous");
    } catch (err) {
      setError("Guest login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFEB3B] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-6xl md:text-8xl font-black text-black uppercase tracking-tighter transform -rotate-2">
            POP<span className="text-white drop-shadow-[4px_4px_0_#000]">GEN</span>
          </h1>
          <p className="text-lg md:text-xl font-bold text-black mt-2 uppercase tracking-widest">
            Make Pixar Magic ✨
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border-8 border-black p-6 md:p-8 shadow-[12px_12px_0_0_#000] transform rotate-1 hover:rotate-0 transition-transform">
          <h2 className="text-2xl md:text-3xl font-black uppercase mb-6 text-center">
            {flow === "signIn" ? "Welcome Back!" : "Join the Fun!"}
          </h2>

          {error && (
            <div className="bg-red-400 border-4 border-black p-3 mb-4 font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="email"
              type="email"
              placeholder="YOUR EMAIL"
              required
              className="w-full p-4 border-4 border-black font-bold text-lg uppercase placeholder:text-gray-400 focus:outline-none focus:border-[#FF6B6B] transition-colors"
            />
            <input
              name="password"
              type="password"
              placeholder="SECRET PASSWORD"
              required
              className="w-full p-4 border-4 border-black font-bold text-lg uppercase placeholder:text-gray-400 focus:outline-none focus:border-[#FF6B6B] transition-colors"
            />
            <input name="flow" type="hidden" value={flow} />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FF6B6B] text-white p-4 border-4 border-black font-black text-xl uppercase tracking-wider shadow-[6px_6px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "LOADING..." : flow === "signIn" ? "LET'S GO!" : "CREATE ACCOUNT"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
              className="font-bold text-black underline decoration-4 decoration-[#4ECDC4] hover:decoration-[#FF6B6B] transition-colors"
            >
              {flow === "signIn" ? "Need an account? Sign up!" : "Already have one? Sign in!"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t-4 border-black">
            <button
              onClick={handleAnonymous}
              disabled={isLoading}
              className="w-full bg-black text-white p-4 font-black text-lg uppercase tracking-wider hover:bg-[#4ECDC4] transition-colors disabled:opacity-50"
            >
              🎭 Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Video post card component
function PostCard({
  post,
  isLiked,
  onLike,
  isOwner,
  onDelete
}: {
  post: {
    _id: Id<"posts">;
    username: string;
    prompt: string;
    videoUrl?: string;
    status: "generating" | "completed" | "failed";
    createdAt: number;
    likes: number;
  };
  isLiked: boolean;
  onLike: () => void;
  isOwner: boolean;
  onDelete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const colors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF", "#DDA0DD", "#98D8C8"];
  const randomColor = colors[Math.abs(post.prompt.length) % colors.length];

  return (
    <div className="bg-white border-6 border-black shadow-[8px_8px_0_0_#000] transform hover:-translate-y-1 hover:shadow-[12px_12px_0_0_#000] transition-all">
      {/* Header */}
      <div className="p-4 border-b-4 border-black flex items-center justify-between" style={{ backgroundColor: randomColor }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-white flex items-center justify-center font-black text-lg md:text-xl uppercase">
            {post.username.charAt(0)}
          </div>
          <div>
            <p className="font-black text-black uppercase text-sm md:text-base">@{post.username}</p>
            <p className="text-xs font-bold text-black/70">{formatTime(post.createdAt)}</p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={onDelete}
            className="p-2 bg-black text-white font-bold hover:bg-red-500 transition-colors"
            title="Delete post"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Video / Loading / Failed */}
      <div className="aspect-video bg-black relative overflow-hidden">
        {post.status === "generating" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
            <div className="relative">
              <div className="w-20 h-20 md:w-24 md:h-24 border-8 border-white border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl md:text-3xl">🎬</span>
              </div>
            </div>
            <p className="mt-4 text-white font-black text-base md:text-xl uppercase tracking-wider animate-pulse">
              Creating Magic...
            </p>
            <p className="mt-2 text-white/80 font-bold text-xs md:text-sm">
              This takes 1-2 minutes
            </p>
          </div>
        )}

        {post.status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500">
            <span className="text-5xl md:text-6xl mb-4">😢</span>
            <p className="text-white font-black text-lg md:text-xl uppercase">Generation Failed</p>
            <p className="text-white/80 font-bold mt-2 text-sm">Try a different prompt!</p>
          </div>
        )}

        {post.status === "completed" && post.videoUrl && (
          <div className="relative group cursor-pointer" onClick={togglePlay}>
            <video
              ref={videoRef}
              src={post.videoUrl}
              className="w-full h-full object-cover"
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                  <span className="text-3xl md:text-4xl ml-1">▶️</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="p-4 border-t-4 border-black bg-[#FFFDE7]">
        <p className="font-bold text-black text-sm md:text-base leading-relaxed">"{post.prompt}"</p>
      </div>

      {/* Actions */}
      <div className="p-4 border-t-4 border-black flex items-center gap-4 bg-gray-100">
        <button
          onClick={onLike}
          className={`flex items-center gap-2 font-black uppercase text-sm md:text-base transition-transform hover:scale-110 ${isLiked ? "text-red-500" : "text-black"}`}
        >
          <span className="text-xl md:text-2xl">{isLiked ? "❤️" : "🤍"}</span>
          <span>{post.likes}</span>
        </button>
        <button className="flex items-center gap-2 font-black uppercase text-sm md:text-base text-black hover:text-[#4ECDC4] transition-colors">
          <span className="text-xl md:text-2xl">💬</span>
        </button>
        <button className="flex items-center gap-2 font-black uppercase text-sm md:text-base text-black hover:text-[#4ECDC4] transition-colors ml-auto">
          <span className="text-xl md:text-2xl">🔗</span>
        </button>
      </div>
    </div>
  );
}

// Create post form
function CreatePost({ username }: { username: string }) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const createPost = useMutation(api.posts.create);
  const generateVideo = useAction(api.posts.generateVideo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const postId = await createPost({ prompt: prompt.trim(), username });
      setToast({ message: "Video generation started!", type: "success" });
      setPrompt("");

      // Start video generation in background
      generateVideo({ postId, prompt: prompt.trim() }).catch(() => {
        // Error handled in the action
      });
    } catch (err) {
      setToast({ message: "Failed to create post", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const suggestions = [
    "A friendly robot learning to dance",
    "Cute animals having a tea party",
    "A magical treehouse in the clouds",
    "Dinosaurs playing soccer",
    "A space adventure with stars",
  ];

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white border-8 border-black p-4 md:p-6 shadow-[8px_8px_0_0_#000]">
        <h2 className="text-xl md:text-2xl font-black uppercase mb-4 flex items-center gap-2">
          <span>🎬</span> Create Your Video
        </h2>

        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your Pixar-style video..."
            className="w-full p-4 border-4 border-black font-bold text-base md:text-lg placeholder:text-gray-400 focus:outline-none focus:border-[#4ECDC4] transition-colors resize-none h-24 md:h-32"
            maxLength={200}
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between mt-4 gap-4">
            <span className="text-sm font-bold text-gray-500">{prompt.length}/200</span>
            <button
              type="submit"
              disabled={!prompt.trim() || isSubmitting}
              className="w-full md:w-auto bg-[#4ECDC4] text-black px-6 md:px-8 py-3 md:py-4 border-4 border-black font-black text-base md:text-lg uppercase tracking-wider shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "CREATING..." : "✨ GENERATE VIDEO"}
            </button>
          </div>
        </form>

        {/* Suggestions */}
        <div className="mt-6 pt-4 border-t-4 border-dashed border-gray-300">
          <p className="text-xs md:text-sm font-bold text-gray-500 uppercase mb-3">💡 Need ideas?</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setPrompt(s)}
                className="bg-[#FFEB3B] px-3 py-1 border-2 border-black font-bold text-xs md:text-sm hover:bg-[#FF6B6B] hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// Main feed component
function Feed() {
  const { signOut } = useAuthActions();
  const posts = useQuery(api.posts.list);
  const userLikes = useQuery(api.posts.userLikes);
  const toggleLike = useMutation(api.posts.toggleLike);
  const deletePost = useMutation(api.posts.remove);
  const myPosts = useQuery(api.posts.myPosts);

  const [username] = useState(() => {
    const saved = localStorage.getItem("popgen-username");
    if (saved) return saved;
    const newName = `creator${Math.floor(Math.random() * 9999)}`;
    localStorage.setItem("popgen-username", newName);
    return newName;
  });

  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const handleDelete = async (postId: Id<"posts">) => {
    if (!confirm("Delete this video?")) return;
    try {
      await deletePost({ postId });
      setToast({ message: "Video deleted!", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to delete", type: "error" });
    }
  };

  const myPostIds = myPosts?.map((p: { _id: Id<"posts"> }) => p._id) ?? [];

  return (
    <div className="min-h-screen bg-[#FFEB3B]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-black text-white border-b-8 border-[#FF6B6B]">
        <div className="max-w-2xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">
            POP<span className="text-[#4ECDC4]">GEN</span>
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="font-bold text-xs md:text-sm bg-[#4ECDC4] text-black px-2 md:px-3 py-1 uppercase">
              @{username}
            </span>
            <button
              onClick={() => signOut()}
              className="bg-[#FF6B6B] px-3 md:px-4 py-2 font-black text-xs md:text-sm uppercase hover:bg-white hover:text-black transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8">
        {/* Create Post */}
        <div className="mb-6 md:mb-8">
          <CreatePost username={username} />
        </div>

        {/* Feed */}
        <div className="space-y-6 md:space-y-8">
          {posts === undefined ? (
            <div className="text-center py-12 md:py-20">
              <div className="inline-block w-12 h-12 md:w-16 md:h-16 border-8 border-black border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 font-black text-lg md:text-xl uppercase">Loading videos...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 md:py-20 bg-white border-8 border-black shadow-[8px_8px_0_0_#000]">
              <span className="text-5xl md:text-6xl">🎥</span>
              <p className="mt-4 font-black text-xl md:text-2xl uppercase">No videos yet!</p>
              <p className="mt-2 font-bold text-gray-600">Be the first to create one!</p>
            </div>
          ) : (
            posts.map((post: { _id: Id<"posts">; username: string; prompt: string; videoUrl?: string; status: "generating" | "completed" | "failed"; createdAt: number; likes: number }) => (
              <PostCard
                key={post._id}
                post={post}
                isLiked={userLikes?.includes(post._id) ?? false}
                onLike={() => toggleLike({ postId: post._id })}
                isOwner={myPostIds.includes(post._id)}
                onDelete={() => handleDelete(post._id)}
              />
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 mt-12 border-t-4 border-black/20">
        <p className="text-center text-xs text-black/40 font-medium">
          Requested by @web-user · Built by @clonkbot
        </p>
      </footer>
    </div>
  );
}

// Main App
export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFEB3B] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 md:w-20 md:h-20 border-8 border-black border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-6 font-black text-2xl md:text-3xl uppercase tracking-wider">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return <Feed />;
}
