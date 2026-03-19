"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const PAGE_SIZE = 10;
const POST_IMAGE_BUCKET = "post-images";

type Viewer = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

type PostRecord = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "member";
};

type LikeRecord = {
  post_id: string;
  user_id: string;
};

type FeedComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
};

type FeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: "admin" | "member";
  content: string;
  imageUrl: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  comments: FeedComment[];
};


function toInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase())
    .join("");
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getProfile(
  profileMap: Map<string, ProfileRecord>,
  userId: string,
): {
  name: string;
  avatarUrl: string | null;
  role: "admin" | "member";
} {
  const profile = profileMap.get(userId);
  return {
    name: profile?.full_name || "Community member",
    avatarUrl: profile?.avatar_url || null,
    role: profile?.role === "admin" ? "admin" : "member",
  };
}

export function FeedPage() {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [composerImage, setComposerImage] = useState<File | null>(null);
  const [fileResetKey, setFileResetKey] = useState(0);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  function redirectToLogin() {
    const nextPath = pathname || "/feed";
    router.push(`/login?redirectedFrom=${encodeURIComponent(nextPath)}`);
  }

  const hydratePosts = useCallback(
    async (postRows: PostRecord[], viewerId: string | null) => {
      if (!postRows.length) {
        return [] as FeedPost[];
      }

      const postIds = postRows.map((post) => post.id);
      const authorIds = new Set(postRows.map((post) => post.author_id));

      const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
        supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
        supabase
          .from("post_comments")
          .select("id, post_id, author_id, content, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true }),
      ]);

      if (likesError) throw likesError;
      if (commentsError) throw commentsError;

      (comments || []).forEach((comment) => authorIds.add(comment.author_id));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", Array.from(authorIds));

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

      const likesByPost = new Map<string, LikeRecord[]>();
      (likes || []).forEach((like) => {
        const current = likesByPost.get(like.post_id) || [];
        current.push(like);
        likesByPost.set(like.post_id, current);
      });

      const commentsByPost = new Map<string, FeedComment[]>();
      (comments || []).forEach((comment) => {
        const profile = getProfile(profileMap, comment.author_id);
        const current = commentsByPost.get(comment.post_id) || [];
        current.push({
          id: comment.id,
          postId: comment.post_id,
          authorId: comment.author_id,
          authorName: profile.name,
          authorAvatarUrl: profile.avatarUrl,
          content: comment.content,
          createdAt: comment.created_at,
        });
        commentsByPost.set(comment.post_id, current);
      });

      return postRows.map((post) => {
        const profile = getProfile(profileMap, post.author_id);
        const postLikes = likesByPost.get(post.id) || [];
        return {
          id: post.id,
          authorId: post.author_id,
          authorName: profile.name,
          authorAvatarUrl: profile.avatarUrl,
          authorRole: profile.role,
          content: post.content,
          imageUrl: post.image_url,
          createdAt: post.created_at,
          likeCount: postLikes.length,
          likedByMe: viewerId ? postLikes.some((like) => like.user_id === viewerId) : false,
          comments: commentsByPost.get(post.id) || [],
        };
      });
    },
    [supabase],
  );

  const loadPosts = useCallback(
    async (nextOffset: number, viewerId: string | null) => {
      const { data, error: postsError } = await supabase
        .from("posts")
        .select("id, author_id, content, image_url, created_at")
        .order("created_at", { ascending: false })
        .range(nextOffset, nextOffset + PAGE_SIZE - 1);

      if (postsError) throw postsError;

      const hydrated = await hydratePosts((data || []) as PostRecord[], viewerId);
      return {
        posts: hydrated,
        hasMore: (data || []).length === PAGE_SIZE,
      };
    },
    [hydratePosts, supabase],
  );

  useEffect(() => {
    let isMounted = true;
    async function bootstrap() {
      setIsInitialLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted) return;

      let nextViewer: Viewer | null = null;
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (!isMounted) return;
        if (profileError) {
          setError(profileError.message);
        } else {
          nextViewer = {
            id: user.id,
            fullName: profile?.full_name || user.user_metadata.full_name || user.email || "Member",
            avatarUrl: profile?.avatar_url || null,
          };
        }
      }
      setViewer(nextViewer);

      try {
        const result = await loadPosts(0, nextViewer?.id || null);
        if (!isMounted) return;
        setPosts(result.posts);
        setHasMore(result.hasMore);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load feed posts.");
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    }
    bootstrap();
    return () => { isMounted = false; };
  }, [loadPosts, supabase]);

  useEffect(() => {
    if (!viewer) return;
    const channel = supabase
      .channel(`post-notifications-${viewer.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const inserted = payload.new as PostRecord;
        if (!inserted?.id || inserted.author_id === viewer.id) return;
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, viewer]);

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await loadPosts(posts.length, viewer?.id || null);
      setPosts((current) => [...current, ...result.posts]);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more posts.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handlePublishPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer) { redirectToLogin(); return; }
    if (isPublishing) return;

    const trimmedContent = composerText.trim();
    if (!trimmedContent) { setError("Write something for your post."); return; }

    setIsPublishing(true);
    setError(null);

    let imageUrl: string | null = null;
    if (composerImage) {
      const safeFileName = sanitizeFileName(composerImage.name);
      const objectPath = `${viewer.id}/${Date.now()}-${safeFileName}`;
      const { error: uploadError } = await supabase.storage.from(POST_IMAGE_BUCKET).upload(objectPath, composerImage, { upsert: false });
      if (uploadError) {
        setIsPublishing(false);
        setError(`Image upload failed: ${uploadError.message}`);
        return;
      }
      const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(objectPath);
      imageUrl = data.publicUrl;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("posts")
      .insert({ author_id: viewer.id, content: trimmedContent, image_url: imageUrl })
      .select("id, author_id, content, image_url, created_at")
      .single();

    if (insertError || !inserted) {
      setIsPublishing(false);
      setError(insertError?.message || "Could not publish your post.");
      return;
    }

    try {
      const [post] = await hydratePosts([inserted as PostRecord], viewer.id);
      if (post) setPosts((current) => [post, ...current]);
      setComposerText("");
      setComposerImage(null);
      setFileResetKey((value) => value + 1);
    } catch (hydrateError) {
      setError(hydrateError instanceof Error ? hydrateError.message : "Post created but failed to refresh feed.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleToggleLike(postId: string) {
    if (!viewer) { redirectToLogin(); return; }
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return;

    const wasLiked = post.likedByMe;
    setPosts((current) => current.map((entry) => entry.id === postId ? {
      ...entry,
      likedByMe: !wasLiked,
      likeCount: wasLiked ? Math.max(0, entry.likeCount - 1) : entry.likeCount + 1,
    } : entry));

    const request = wasLiked
      ? supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", viewer.id)
      : supabase.from("post_likes").insert({ post_id: postId, user_id: viewer.id });

    const { error: likeError } = await request;
    if (!likeError) return;

    setPosts((current) => current.map((entry) => entry.id === postId ? {
      ...entry,
      likedByMe: wasLiked,
      likeCount: wasLiked ? entry.likeCount + 1 : Math.max(0, entry.likeCount - 1),
    } : entry));
    setError(likeError.message);
  }

  async function handleAddComment(postId: string) {
    if (!viewer) { redirectToLogin(); return; }
    const draft = commentDrafts[postId]?.trim();
    if (!draft) return;

    setError(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticComment: FeedComment = {
      id: tempId, postId, authorId: viewer.id, authorName: viewer.fullName, authorAvatarUrl: viewer.avatarUrl, content: draft, createdAt: new Date().toISOString(),
    };

    setPosts((current) => current.map((entry) => entry.id === postId ? { ...entry, comments: [...entry.comments, optimisticComment] } : entry));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));

    const { data, error: commentError } = await supabase.from("post_comments").insert({ post_id: postId, author_id: viewer.id, content: draft }).select("id, created_at").single();

    if (commentError || !data) {
      setPosts((current) => current.map((entry) => entry.id === postId ? { ...entry, comments: entry.comments.filter((c) => c.id !== tempId) } : entry));
      setError(commentError?.message || "Could not add comment.");
      return;
    }

    setPosts((current) => current.map((entry) => entry.id === postId ? {
      ...entry,
      comments: entry.comments.map((c) => c.id === tempId ? { ...c, id: data.id, createdAt: data.created_at } : c),
    } : entry));
  }

  async function handleDeletePost(postId: string) {
    if (!viewer) return;
    if (!window.confirm("Delete this post?")) return;

    const previousPosts = posts;
    setPosts((current) => current.filter((entry) => entry.id !== postId));
    setError(null);

    const { error: deleteError } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", viewer.id);
    if (!deleteError) return;
    setPosts(previousPosts);
    setError(deleteError.message);
  }

  if (isInitialLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-b border-border pb-8">
            <div className="flex gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-surface-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-surface-elevated rounded" />
                <div className="h-3 w-24 bg-surface-elevated rounded" />
              </div>
            </div>
            <div className="h-20 w-full bg-surface-elevated rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Composer */}
      {viewer ? (
        <form onSubmit={handlePublishPost} className="border-b border-border pb-8">
          <div className="flex gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-light/10 text-sm font-bold text-accent-light">
              {toInitials(viewer.fullName)}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="What's on your mind?"
                rows={3}
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
              />
              
              {composerImage && (
                <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border">
                   <p className="absolute inset-0 grid place-items-center bg-surface/80 text-xs font-medium text-foreground">
                     Image selected: {composerImage.name}
                   </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="cursor-pointer text-muted transition-colors hover:text-accent">
                  <input
                    key={fileResetKey}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setComposerImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </label>
                <button
                  type="submit"
                  disabled={isPublishing || !composerText.trim()}
                  className="rounded-full bg-accent px-6 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPublishing ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
           <p className="text-sm text-muted mb-4">Sign in to share updates with the community.</p>
           <button
             onClick={redirectToLogin}
             className="rounded-full border border-border bg-surface-elevated px-6 py-2 text-sm font-semibold text-foreground hover:bg-border"
           >
             Login
           </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Feed Posts */}
      <div className="divide-y divide-border">
        {posts.map((post) => {
          const isExpanded = expandedPosts[post.id] ?? false;
          const isOwnPost = viewer?.id === post.authorId;

          return (
            <article key={post.id} className="py-8 first:pt-0">
              <header className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {post.authorAvatarUrl ? (
                    <Image src={post.authorAvatarUrl} alt={post.authorName} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-surface-elevated text-xs font-bold text-muted">
                      {toInitials(post.authorName)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{post.authorName}</p>
                      {post.authorRole === "admin" && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{formatDate(post.createdAt)}</p>
                  </div>
                </div>
                {isOwnPost && (
                  <button onClick={() => handleDeletePost(post.id)} className="text-muted hover:text-red-500 transition-colors">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </header>

              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                {post.imageUrl && (
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border">
                    <Image src={post.imageUrl} alt="Post image" fill className="object-cover" />
                  </div>
                )}

                <div className="flex items-center gap-6 pt-2">
                  <button
                    onClick={() => handleToggleLike(post.id)}
                    className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                      post.likedByMe ? "text-accent" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-5 w-5 ${post.likedByMe ? "fill-current" : "fill-none"}`}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                    <span>{post.likeCount}</span>
                  </button>

                  <button
                    onClick={() => setExpandedPosts(prev => ({ ...prev, [post.id]: !isExpanded }))}
                    className="flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>{post.comments.length}</span>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-6 space-y-4 rounded-xl bg-surface-elevated/50 p-4">
                  <div className="space-y-4">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-elevated text-[8px] font-bold text-muted">
                          {toInitials(comment.authorName)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold text-foreground">{comment.authorName}</p>
                            <p className="text-[10px] text-muted">{formatDate(comment.createdAt)}</p>
                          </div>
                          <p className="text-xs text-foreground/80">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {viewer ? (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ""}
                        onChange={(e) => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                        placeholder="Add a comment..."
                        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={!commentDrafts[post.id]?.trim()}
                        className="text-xs font-bold text-accent disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted text-center py-2">Sign in to comment</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="text-xs font-bold uppercase tracking-widest text-muted hover:text-foreground transition-colors"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
