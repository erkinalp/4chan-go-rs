export interface Board {
  id: string;
  shortName: string;
  title: string;
  description: string;
  category: string;
  isNSFW: boolean;
  threadCount: number;
  postCount: number;
  imageLimit: number;
  bumpLimit: number;
  cooldown: number;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  threadId: string;
  boardId: string;
  postNumber: number;
  name: string;
  tripcode?: string;
  email?: string;
  subject?: string;
  message: string;
  ip?: string;
  file?: FileAttachment;
  isSpoilered: boolean;
  isSticky: boolean;
  isClosed: boolean;
  createdAt: string;
}

export interface FileAttachment {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  fileUrl: string;
  md5Hash: string;
}

export interface Thread {
  id: string;
  boardId: string;
  subject?: string;
  isSticky: boolean;
  isClosed: boolean;
  isPinned: boolean;
  replyCount: number;
  imageCount: number;
  bumpedAt: string;
  createdAt: string;
  op: Post;
  lastReplies?: Post[];
}

export interface Report {
  id: string;
  boardId: string;
  threadId: string;
  postId: string;
  reason: string;
  category: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Ban {
  id: string;
  ip: string;
  boardId: string;
  reason: string;
  expires: string;
  status: 'active' | 'expired' | 'lifted';
  createdAt: string;
  createdBy: string;
}

export interface ModLogEntry {
  id: string;
  action: string;
  boardId: string;
  postId?: string;
  threadId?: string;
  reason?: string;
  performedBy: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  version: string;
  services: Record<string, { status: string; latency: number }>;
}
