import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './axios';
import type { Report, ReportReason, Ban, ModLogEntry, PaginatedResponse } from '@/types/api';

export interface CreateReportPayload {
  reason: ReportReason;
  additionalInfo?: string;
  postId?: string;
  threadId?: string;
}

/**
 * Submit a report for a post or thread. Anonymous — no auth required
 * (api-core: POST /moderation/reports).
 */
export function useCreateReport() {
  return useMutation({
    mutationFn: async (payload: CreateReportPayload) => {
      const { data } = await api.post('/moderation/reports', payload);
      return data;
    },
  });
}

export function useReports(status?: string) {
  return useQuery<PaginatedResponse<Report>>({
    queryKey: ['reports', status],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Report>>('/mod/reports', {
        params: status ? { status } : undefined,
      });
      return data;
    },
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      action,
    }: {
      reportId: string;
      action: 'resolve' | 'dismiss';
    }) => {
      const { data } = await api.patch(`/mod/reports/${reportId}`, { action });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useBans() {
  return useQuery<PaginatedResponse<Ban>>({
    queryKey: ['bans'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Ban>>('/mod/bans');
      return data;
    },
  });
}

export function useCreateBan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ban: {
      ip: string;
      boardId: string;
      reason: string;
      duration: number;
    }) => {
      const { data } = await api.post('/mod/bans', ban);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bans'] });
    },
  });
}

export function useModLog() {
  return useQuery<PaginatedResponse<ModLogEntry>>({
    queryKey: ['modLog'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ModLogEntry>>(
        '/mod/log'
      );
      return data;
    },
  });
}
