import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Flag,
  Flame,
  Hash,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { helzerxApi } from '../api/helzerx';
import { usePanel } from '../context/PanelContext';
import type { CommunityPost, PostReportEntry, PublicUserView } from '../types/helzerx';
import { formatRelativeTime } from '../utils/format';

const CATEGORIES = ['All', 'General', 'Tutorials', 'Showcase', 'Feature Requests', 'Help'] as const;
const EMOJIS = ['🚀', '🔥', '❤️', '🎉'];

export function CommunityPage() {
  const { helzerxData, notify, refreshHelzerx } = usePanel();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [reports, setReports] = useState<PostReportEntry[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'trending' | 'bookmarked'>('latest');
  const [viewMode, setViewMode] = useState<'feed' | 'guidelines' | 'moderation'>('feed');

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [postCat, setPostCat] = useState<CommunityPost['category']>('General');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [profileModal, setProfileModal] = useState<PublicUserView | null>(null);

  const currentUserId = helzerxData?.userId || '1';
  const isAdmin = Boolean(helzerxData?.isAdmin);

  const loadCommunity = useCallback(async () => {
    try {
      const res = await helzerxApi.getCommunity();
      setPosts(res.posts);
      setReports(res.reports);
      setFollowing(res.following);
    } catch (err: any) {
      notify('Failed to load community', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await helzerxApi.createPost({ title, category: postCat, body, pinned: isAdmin && pinned });
      setTitle('');
      setBody('');
      setPinned(false);
      setComposing(false);
      notify('Post published', '+30 XP awarded!', 'success');
      await Promise.all([loadCommunity(), refreshHelzerx()]);
    } catch (err: any) {
      notify('Could not publish post', err.message, 'error');
    }
  };

  const handleReact = async (postId: string, payload: { type?: 'like' | 'dislike'; emoji?: string }) => {
    try {
      await helzerxApi.reactPost(postId, payload);
      loadCommunity();
    } catch (err: any) {
      notify('Action failed', err.message, 'error');
    }
  };

  const handleBookmark = async (postId: string) => {
    try {
      await helzerxApi.bookmarkPost(postId);
      loadCommunity();
    } catch (err: any) {
      notify('Bookmark failed', err.message, 'error');
    }
  };

  const handleComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    try {
      await helzerxApi.commentPost(postId, text);
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      loadCommunity();
    } catch (err: any) {
      notify('Comment failed', err.message, 'error');
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPostId || !reportReason.trim()) return;
    try {
      await helzerxApi.reportPost(reportingPostId, reportReason);
      notify('Report submitted to moderators', undefined, 'info');
      setReportingPostId(null);
      setReportReason('');
      loadCommunity();
    } catch (err: any) {
      notify('Report failed', err.message, 'error');
    }
  };

  const handleFollow = async (username: string) => {
    try {
      const res = await helzerxApi.toggleFollowUser(username);
      setFollowing(res.following);
    } catch (err: any) {
      notify('Follow failed', err.message, 'error');
    }
  };

  const openPublicProfile = async (username: string) => {
    try {
      const res = await helzerxApi.getPublicProfile(username);
      setProfileModal(res);
    } catch (err: any) {
      notify('Profile unavailable', err.message, 'info');
    }
  };

  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      p.hashtags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = posts.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (sortBy === 'bookmarked' && !p.bookmarks.includes(currentUserId)) return false;
      if (!q) return true;
      return `${p.title} ${p.body} ${p.authorUsername} ${p.hashtags.join(' ')}`.toLowerCase().includes(q);
    });
    if (sortBy === 'trending') {
      return [...list].sort(
        (a, b) =>
          b.likes.length + b.comments.length * 2 - (a.likes.length + a.comments.length * 2)
      );
    }
    return list;
  }, [posts, category, sortBy, search, currentUserId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
        <div className="h-56 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="mx-heading-3d text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">
            Community Forum
          </h1>
          <p className="text-xs sm:text-sm text-[#777777] dark:text-zinc-400 mt-0.5">
            Share server tutorials, showcase builds, #hashtags, @mentions, and connect with members
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="mx-well-3d inline-flex p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                viewMode === 'feed' ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
              }`}
            >
              Discussions
            </button>
            <button
              type="button"
              onClick={() => setViewMode('guidelines')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                viewMode === 'guidelines' ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
              }`}
            >
              Guidelines
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setViewMode('moderation')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                  viewMode === 'moderation' ? 'mx-btn-3d-primary' : 'text-[#525252] dark:text-zinc-400'
                }`}
              >
                Moderation ({reports.filter((r) => r.status === 'open').length})
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setViewMode('feed');
              setComposing((c) => !c);
            }}
            className="mx-btn-3d-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Post
          </button>
        </div>
      </div>

      {viewMode === 'guidelines' && (
        <section className="mx-card-3d p-6 rounded-2xl space-y-3 text-xs leading-relaxed text-[#525252] dark:text-zinc-300">
          <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
            HelzerX Community Guidelines
          </h2>
          <p>1. Keep discussions constructive, respectful, and helpful to other server owners and developers.</p>
          <p>2. Never share private API keys, passwords, database credentials, or personal IP addresses in public posts.</p>
          <p>3. Use accurate categories and #hashtags so other creators can find guides and optimization tips easily.</p>
          <p>4. Report spam or abusive content using the Report button on any post for instant moderator review.</p>
        </section>
      )}

      {viewMode === 'moderation' && isAdmin && (
        <section className="mx-card-3d p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white">
              Moderation Queue
            </h2>
          </div>
          {reports.length === 0 ? (
            <div className="text-xs text-[#777777] py-4">No reported posts in queue.</div>
          ) : (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {reports.map((rep) => (
                <div key={rep.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-[#171717] dark:text-white">
                      {rep.postTitle}{' '}
                      <span className="font-mono text-[10px] uppercase text-[#8B5CF6]">[{rep.status}]</span>
                    </div>
                    <div className="text-[#777777] dark:text-zinc-400">
                      Reported by @{rep.reporterUsername}: &ldquo;{rep.reason}&rdquo;
                    </div>
                  </div>
                  {rep.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => helzerxApi.resolveReport(rep.id, 'dismiss').then(loadCommunity)}
                        className="mx-btn-3d px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => helzerxApi.resolveReport(rep.id, 'remove_post').then(loadCommunity)}
                        className="mx-btn-3d-danger px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Remove Post
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {viewMode === 'feed' && (
        <>
          {composing && (
            <form onSubmit={handleCreatePost} className="mx-card-3d p-5 rounded-2xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Discussion title"
                  className="mx-input-3d sm:col-span-2 px-3 py-2 rounded-xl"
                />
                <select
                  value={postCat}
                  onChange={(e) => setPostCat(e.target.value as CommunityPost['category'])}
                  className="mx-input-3d px-3 py-2 rounded-xl"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <textarea
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your post... Use #hashtags and @username mentions!"
                className="mx-input-3d w-full px-3 py-2 rounded-xl text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {isAdmin ? (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="rounded accent-[#8B5CF6]" />
                    Pin announcement to top
                  </label>
                ) : <span />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setComposing(false)} className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="mx-btn-3d-primary px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer">
                    Publish Post
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Filter & Trending Tags */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-8 space-y-4">
              <div className="mx-card-3d p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer ${
                        category === c ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-44">
                    <Search className="w-3.5 h-3.5 text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search posts or #tag"
                      className="mx-input-3d w-full pl-8 pr-2.5 py-1.5 rounded-xl text-xs"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="mx-input-3d px-2.5 py-1.5 rounded-xl text-xs"
                  >
                    <option value="latest">Latest</option>
                    <option value="trending">Trending</option>
                    <option value="bookmarked">Saved</option>
                  </select>
                </div>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="mx-card-3d p-8 rounded-2xl text-center text-xs text-[#777777]">
                  No community posts match your current filters.
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const liked = post.likes.includes(currentUserId);
                  const disliked = post.dislikes.includes(currentUserId);
                  const bookmarked = post.bookmarks.includes(currentUserId);
                  const isFollowingAuthor = following.includes(post.authorUsername);
                  return (
                    <article key={post.id} className="mx-card-3d p-5 rounded-2xl space-y-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#777777] dark:text-zinc-400">
                            {post.pinned && (
                              <span className="inline-flex items-center gap-1 text-[#8B5CF6] font-semibold">
                                <Pin className="w-3 h-3" /> Pinned
                              </span>
                            )}
                            <span className="mx-well-3d px-2 py-0.5 rounded-lg font-medium">{post.category}</span>
                            <button
                              type="button"
                              onClick={() => openPublicProfile(post.authorUsername)}
                              className="font-semibold text-[#171717] dark:text-zinc-200 hover:text-[#8B5CF6] cursor-pointer"
                            >
                              {post.authorDisplayName} (@{post.authorUsername})
                            </button>
                            <span className="font-mono text-[10px] text-[#06B6D4]">[{post.authorTier}]</span>
                            <span>{formatRelativeTime(post.createdAt)}</span>
                          </div>
                          <h2 className="mx-heading-3d text-base font-bold text-[#171717] dark:text-white mt-1.5">
                            {post.title}
                          </h2>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {post.authorUsername !== helzerxData?.username && (
                            <button
                              type="button"
                              onClick={() => handleFollow(post.authorUsername)}
                              className="mx-btn-3d inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] cursor-pointer"
                            >
                              {isFollowingAuthor ? <UserCheck className="w-3 h-3 text-emerald-500" /> : <UserPlus className="w-3 h-3" />}
                              {isFollowingAuthor ? 'Following' : 'Follow'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleBookmark(post.id)}
                            title="Bookmark Post"
                            className="mx-btn-3d p-1.5 rounded-xl cursor-pointer"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'text-amber-500 fill-amber-500' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportingPostId(post.id)}
                            title="Report Post"
                            className="mx-btn-3d p-1.5 rounded-xl cursor-pointer"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                          {(post.userId === currentUserId || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => helzerxApi.deletePost(post.id).then(loadCommunity)}
                              title="Delete Post"
                              className="mx-btn-3d p-1.5 rounded-xl text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-[#3B3B3B] dark:text-zinc-200 whitespace-pre-wrap">
                        {post.body}
                      </p>

                      {post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.hashtags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setSearch(tag)}
                              className="mx-well-3d px-2 py-0.5 rounded-lg text-[11px] font-mono text-[#8B5CF6] cursor-pointer"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
                        <button
                          type="button"
                          onClick={() => handleReact(post.id, { type: 'like' })}
                          className={`px-2.5 py-1 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer ${
                            liked ? 'mx-btn-3d-primary' : 'mx-btn-3d'
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" /> {post.likes.length}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReact(post.id, { type: 'dislike' })}
                          className={`px-2.5 py-1 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer ${
                            disliked ? 'mx-btn-3d-danger' : 'mx-btn-3d'
                          }`}
                        >
                          <ThumbsDown className="w-3 h-3" /> {post.dislikes.length}
                        </button>
                        {EMOJIS.map((em) => {
                          const cnt = (post.reactions[em] || []).length;
                          return (
                            <button
                              key={em}
                              type="button"
                              onClick={() => handleReact(post.id, { emoji: em })}
                              className="mx-btn-3d px-2 py-1 rounded-xl text-xs cursor-pointer"
                            >
                              {em} {cnt > 0 ? cnt : ''}
                            </button>
                          );
                        })}
                        <span className="ml-auto text-[11px] text-[#777777] inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> {post.comments.length} comments
                        </span>
                      </div>

                      {/* Comments */}
                      <div className="space-y-2">
                        {post.comments.map((c) => (
                          <div key={c.id} className="mx-well-3d px-3 py-2 rounded-xl text-xs">
                            <span className="font-semibold text-[#171717] dark:text-white">{c.authorDisplayName}</span>{' '}
                            <span className="text-[10px] text-[#777777]">{formatRelativeTime(c.createdAt)}</span>
                            <p className="mt-0.5 text-[#3B3B3B] dark:text-zinc-300">{c.body}</p>
                          </div>
                        ))}
                        <form onSubmit={(e) => handleComment(e, post.id)} className="flex gap-2">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ''}
                            onChange={(e) => setCommentDrafts((p) => ({ ...p, [post.id]: e.target.value }))}
                            placeholder="Write a comment (+10 XP)..."
                            className="mx-input-3d flex-1 px-3 py-1.5 rounded-xl text-xs"
                          />
                          <button type="submit" className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer">
                            <Send className="w-3 h-3" /> Post
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Sidebar: Trending & Community Activity */}
            <aside className="xl:col-span-4 space-y-4">
              <div className="mx-card-3d p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Trending Hashtags
                </div>
                {trendingTags.length === 0 ? (
                  <div className="text-xs text-[#777777]">Use #tags in posts to trend here.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {trendingTags.map(([tag, count]) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSearch(tag)}
                        className="mx-btn-3d px-2.5 py-1 rounded-xl text-xs font-mono inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Hash className="w-3 h-3 text-[#8B5CF6]" />
                        {tag} <span className="text-[#777777]">({count})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mx-card-3d p-5 rounded-2xl space-y-3">
                <div className="text-sm font-bold text-[#171717] dark:text-white">Following ({following.length})</div>
                {following.length === 0 ? (
                  <div className="text-xs text-[#777777]">Click Follow on any creator to track them here.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {following.map((uname) => (
                      <button
                        key={uname}
                        type="button"
                        onClick={() => openPublicProfile(uname)}
                        className="mx-well-3d px-2.5 py-1 rounded-xl text-xs font-medium hover:text-[#8B5CF6] cursor-pointer"
                      >
                        @{uname}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Report Modal */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form onSubmit={handleReport} className="mx-card-3d w-full max-w-md p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold">Report Post to Moderators</h3>
            <textarea
              rows={3}
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Explain the issue (spam, abuse, leaked secrets)..."
              className="mx-input-3d w-full px-3 py-2 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReportingPostId(null)} className="mx-btn-3d px-3 py-1.5 rounded-xl text-xs cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="mx-btn-3d-danger px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer">
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Public Profile Modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" onClick={() => setProfileModal(null)}>
          <div className="mx-card-3d w-full max-w-lg p-6 rounded-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="mx-heading-3d text-lg font-bold text-[#171717] dark:text-white">
                  {profileModal.profile.displayName || profileModal.profile.username}
                </h3>
                <div className="text-xs font-mono text-[#777777]">
                  @{profileModal.profile.username} · Level {profileModal.loyalty.level} · {profileModal.loyalty.tier}
                </div>
              </div>
              <button type="button" onClick={() => setProfileModal(null)} className="mx-btn-3d p-1.5 rounded-xl cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {profileModal.profile.bio && (
              <p className="text-xs text-[#3B3B3B] dark:text-zinc-300">{profileModal.profile.bio}</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="mx-well-3d p-2.5 rounded-xl">
                <div className="text-[#777777]">Total XP</div>
                <div className="font-bold mt-0.5">{profileModal.loyalty.xp}</div>
              </div>
              <div className="mx-well-3d p-2.5 rounded-xl">
                <div className="text-[#777777]">Streak</div>
                <div className="font-bold mt-0.5">{profileModal.loyalty.streakDays}d</div>
              </div>
              <div className="mx-well-3d p-2.5 rounded-xl">
                <div className="text-[#777777]">Badges</div>
                <div className="font-bold mt-0.5">{profileModal.loyalty.badges.length}</div>
              </div>
            </div>
            {profileModal.recentPosts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold">Recent Community Posts</div>
                {profileModal.recentPosts.map((rp) => (
                  <div key={rp.id} className="mx-well-3d px-3 py-2 rounded-xl text-xs flex justify-between">
                    <span className="truncate">{rp.title}</span>
                    <span className="text-[10px] text-[#777777]">{rp.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
