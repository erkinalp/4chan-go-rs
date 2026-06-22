import { useQuery } from '@tanstack/react-query';
import api from './axios';
import type { Board } from '@/types/api';

export function useBoards() {
  return useQuery<Board[]>({
    queryKey: ['boards'],
    queryFn: async () => {
      const { data } = await api.get<Board[]>('/boards');
      return data;
    },
  });
}

export function useBoard(id: string) {
  return useQuery<Board>({
    queryKey: ['board', id],
    queryFn: async () => {
      const { data } = await api.get<Board>(`/boards/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
