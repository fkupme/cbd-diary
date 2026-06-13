import { computed, ref } from 'vue';
import {
	intakeService,
	type AnswerPayload,
	type IntakeEvent,
	type IntakeMessage,
	type IntakeSession,
} from '../services/api/IntakeService';

/**
 * Клиентский конечный автомат потока «разложить по полочкам».
 * Держит сессию/события/сообщения; после каждого действия перечитывает
 * сессию с сервера (он — источник истины по ходам интервью).
 */
export function useIntake() {
	const sessionId = ref<string | null>(null);
	const session = ref<IntakeSession | null>(null);
	const events = ref<IntakeEvent[]>([]);
	const messages = ref<IntakeMessage[]>([]);
	const status = ref<string>('idle');
	const cursor = ref<{ eventId: string; field: string } | null>(null);
	const busy = ref(false);
	const error = ref<string | null>(null);

	const started = computed(() => messages.value.length > 0);
	const lastMessage = computed(
		() => messages.value[messages.value.length - 1] || null,
	);

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const s = String(reader.result || '');
				resolve(s.slice(s.indexOf(',') + 1));
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	async function refresh() {
		if (!sessionId.value) return;
		const data = await intakeService.getSession(sessionId.value);
		let msgs = data.messages;
		// Текстовый путь (setTranscript) не пишет USER-сообщение — синтезируем
		// пузырь расшифровки из session.transcript, если его ещё нет в ленте.
		if (
			data.session.transcript &&
			!msgs.some((m) => m.kind === 'transcript')
		) {
			msgs = [
				{
					id: 'local-transcript',
					sessionId: sessionId.value,
					role: 'USER',
					kind: 'transcript',
					content: data.session.transcript,
					payload: {},
					createdAt: data.session.createdAt,
				},
				...msgs,
			];
		}
		messages.value = msgs;
		events.value = data.events;
		session.value = data.session;
		status.value = data.session.status;
		cursor.value = (data.session.stateData as any)?.cursor ?? null;
	}

	async function runSegment() {
		if (!sessionId.value) return;
		await intakeService.segment(sessionId.value);
		await refresh();
	}

	async function beginAudio(blob: Blob, mimeType: string) {
		error.value = null;
		busy.value = true;
		try {
			const s = await intakeService.start();
			sessionId.value = s.id;
			const base64 = await blobToBase64(blob);
			const { transcript } = await intakeService.transcribe(
				s.id,
				base64,
				mimeType,
			);
			if (!transcript) {
				error.value = 'Не расслышал. Попробуй ещё раз или опиши словами.';
				return;
			}
			await runSegment();
		} catch (e: any) {
			error.value = e?.message || 'Что-то пошло не так';
		} finally {
			busy.value = false;
		}
	}

	async function beginText(text: string) {
		const t = text.trim();
		if (!t) return;
		error.value = null;
		busy.value = true;
		try {
			const s = await intakeService.start();
			sessionId.value = s.id;
			await intakeService.setTranscript(s.id, t);
			await runSegment();
		} catch (e: any) {
			error.value = e?.message || 'Что-то пошло не так';
		} finally {
			busy.value = false;
		}
	}

	async function selectEvents(ids: string[]) {
		if (!sessionId.value) return;
		busy.value = true;
		try {
			await intakeService.select(sessionId.value, ids);
			await refresh();
		} catch (e: any) {
			error.value = e?.message || 'Ошибка';
		} finally {
			busy.value = false;
		}
	}

	async function sendAnswer(payload: AnswerPayload) {
		if (!sessionId.value) return;
		busy.value = true;
		try {
			await intakeService.answer(sessionId.value, payload);
			await refresh();
		} catch (e: any) {
			error.value = e?.message || 'Ошибка';
		} finally {
			busy.value = false;
		}
	}

	async function commit() {
		if (!sessionId.value) return;
		busy.value = true;
		try {
			await intakeService.commit(sessionId.value);
			await refresh();
		} catch (e: any) {
			error.value = e?.message || 'Не удалось сохранить';
		} finally {
			busy.value = false;
		}
	}

	function reset() {
		sessionId.value = null;
		session.value = null;
		events.value = [];
		messages.value = [];
		status.value = 'idle';
		cursor.value = null;
		busy.value = false;
		error.value = null;
	}

	return {
		sessionId,
		session,
		events,
		messages,
		status,
		cursor,
		busy,
		error,
		started,
		lastMessage,
		beginAudio,
		beginText,
		selectEvents,
		sendAnswer,
		commit,
		refresh,
		reset,
	};
}
