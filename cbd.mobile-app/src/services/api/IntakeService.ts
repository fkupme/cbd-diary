import { apiClient } from './client';
import { API_CONFIG } from './config';
import type { ApiResponse } from './types';

export type IntakeMessageKind =
	| 'transcript'
	| 'text'
	| 'buttons'
	| 'emotion'
	| 'intensity'
	| 'card';
export type IntakeRole = 'USER' | 'AI' | 'SYSTEM';

export interface IntakeSession {
	id: string;
	userId: string;
	status: string;
	transcript: string;
	stateData?: any;
	createdAt: string;
	updatedAt: string;
}

export interface IntakeEvent {
	id: string;
	sessionId: string;
	orderIndex: number;
	title: string;
	status: string;
	draft: any;
	createdEntryId?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface IntakeMessage {
	id: string;
	sessionId: string;
	role: IntakeRole;
	kind: IntakeMessageKind;
	content: string;
	payload: any;
	createdAt: string;
}

export interface AnswerPayload {
	text?: string;
	emotionIds?: number[];
	intensity?: number;
	skip?: boolean;
}

export interface CommittedEntry {
	eventId: string;
	entryId: string;
	title: string;
}

/**
 * Клиент потока intake. Зеркалит REST-эндпоинты бэкенда `/intake/...`.
 * Состояние держит композабл useIntake, тут только транспорт.
 */
class IntakeApiService {
	private unwrap<T>(res: ApiResponse<T>): T {
		if (!res.success) {
			throw new Error((res as any).error?.message || 'Intake error');
		}
		return res.data as unknown as T;
	}

	async start(): Promise<IntakeSession> {
		return this.unwrap(
			await apiClient.request('POST', API_CONFIG.ENDPOINTS.INTAKE.SESSIONS),
		);
	}

	async getSession(
		id: string,
	): Promise<{
		session: IntakeSession;
		events: IntakeEvent[];
		messages: IntakeMessage[];
	}> {
		return this.unwrap(
			await apiClient.request('GET', API_CONFIG.ENDPOINTS.INTAKE.SESSION(id)),
		);
	}

	async transcribe(
		id: string,
		audioBase64: string,
		mimeType: string,
	): Promise<{ transcript: string }> {
		return this.unwrap(
			await apiClient.request(
				'POST',
				API_CONFIG.ENDPOINTS.INTAKE.TRANSCRIBE(id),
				{ audioBase64, mimeType },
			),
		);
	}

	async setTranscript(
		id: string,
		transcript: string,
	): Promise<{ transcript: string }> {
		return this.unwrap(
			await apiClient.request(
				'POST',
				API_CONFIG.ENDPOINTS.INTAKE.TRANSCRIPT(id),
				{ transcript },
			),
		);
	}

	async segment(
		id: string,
	): Promise<{ events: IntakeEvent[]; message: IntakeMessage }> {
		return this.unwrap(
			await apiClient.request('POST', API_CONFIG.ENDPOINTS.INTAKE.SEGMENT(id)),
		);
	}

	async select(
		id: string,
		selectedIds: string[],
	): Promise<{ selected: IntakeEvent[]; messages: IntakeMessage[] }> {
		return this.unwrap(
			await apiClient.request('POST', API_CONFIG.ENDPOINTS.INTAKE.SELECT(id), {
				selectedIds,
			}),
		);
	}

	async answer(
		id: string,
		payload: AnswerPayload,
	): Promise<{ messages: IntakeMessage[]; cursor: any; status: string }> {
		return this.unwrap(
			await apiClient.request(
				'POST',
				API_CONFIG.ENDPOINTS.INTAKE.ANSWER(id),
				payload,
			),
		);
	}

	async commit(
		id: string,
	): Promise<{ created: CommittedEntry[]; message: IntakeMessage }> {
		return this.unwrap(
			await apiClient.request('POST', API_CONFIG.ENDPOINTS.INTAKE.COMMIT(id)),
		);
	}
}

export const intakeService = new IntakeApiService();
