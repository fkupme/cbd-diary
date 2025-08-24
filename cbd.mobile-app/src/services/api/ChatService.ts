import { apiClient } from './client';
import { API_CONFIG } from './config';
import type { ApiResponse, Chat, ChatMessage } from './types';

export class ChatService {
	private static instance: ChatService;

	static getInstance(): ChatService {
		if (!ChatService.instance) {
			ChatService.instance = new ChatService();
		}
		return ChatService.instance;
	}

	async getOrCreateByEntry(entryId: string): Promise<Chat> {
		const res = await apiClient.request<ApiResponse<Chat>>(
			'POST',
			API_CONFIG.ENDPOINTS.CHAT.BY_ENTRY(entryId)
		);
		if (!res.success)
			throw new Error((res as any).error?.message || 'Chat error');
		return res.data as unknown as Chat;
	}

	async getByEntry(entryId: string): Promise<Chat | null> {
		const res = await apiClient.request<ApiResponse<Chat | null>>(
			'GET',
			API_CONFIG.ENDPOINTS.CHAT.BY_ENTRY(entryId)
		);
		if (!res.success)
			throw new Error((res as any).error?.message || 'Chat error');
		return res.data as unknown as Chat | null;
	}

	async listMessages(chatId: string): Promise<ChatMessage[]> {
		const res = await apiClient.request<ApiResponse<ChatMessage[]>>(
			'GET',
			API_CONFIG.ENDPOINTS.CHAT.MESSAGES(chatId)
		);
		if (!res.success)
			throw new Error((res as any).error?.message || 'Chat error');
		return res.data as unknown as ChatMessage[];
	}

	async sendMessage(chatId: string, content: string): Promise<ChatMessage> {
		const res = await apiClient.request<ApiResponse<ChatMessage>>(
			'POST',
			API_CONFIG.ENDPOINTS.CHAT.MESSAGES(chatId),
			{ content, role: 'USER' }
		);
		if (!res.success)
			throw new Error((res as any).error?.message || 'Chat error');
		return res.data as unknown as ChatMessage;
	}

	async finalize(
		chatId: string,
		summary: any
	): Promise<{ finalized: boolean; outcome: string | null; endedAt: string }> {
		const res = await apiClient.request<ApiResponse<any>>(
			'POST',
			API_CONFIG.ENDPOINTS.CHAT.FINALIZE(chatId),
			summary
		);
		if (!res.success)
			throw new Error((res as any).error?.message || 'Chat finalize error');
		return res.data as any;
	}
}

export const chatService = ChatService.getInstance();
