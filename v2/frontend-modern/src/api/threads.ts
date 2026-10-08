import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './axios';
import type { Thread, PaginatedResponse } from '@/types/api';

export function useThreads(boardId: string, page = 1) {
  return useQuery<PaginatedResponse<Thread>>({
    queryKey: ['threads', boardId, page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Thread>>(
        `/boards/${boardId}/threads`,
        { params: { page } }
      );
      return data;
    },
    enabled: !!boardId,
  });
}

export function useThread(threadId: string) {
  return useQuery<Thread>({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const { data } = await api.get<Thread>(`/threads/${threadId}`);
      return data;
    },
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      boardId,
      formData,
    }: {
      boardId: string;
      formData: FormData;
    }) => {
      const { data } = await api.post<Thread>(
        `/boards/${boardId}/threads`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['threads', variables.boardId] });
    },
  });
}
