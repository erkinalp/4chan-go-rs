import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './axios';
import type { Post } from '@/types/api';

export function usePosts(threadId: string) {
  return useQuery<Post[]>({
    queryKey: ['posts', threadId],
    queryFn: async () => {
      const { data } = await api.get<Post[]>(`/threads/${threadId}/posts`);
      return data;
    },
    enabled: !!threadId,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      formData,
    }: {
      threadId: string;
      formData: FormData;
    }) => {
      const { data } = await api.post<Post>(
        `/threads/${threadId}/posts`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['thread', variables.threadId] });
    },
  });
}
