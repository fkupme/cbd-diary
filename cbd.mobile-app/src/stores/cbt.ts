/**
 * CBT Store
 * Управление состоянием CBT записей с интеграцией API
 */

import { useSync } from '@/composables/useApiIntegration';
import type {
	CBTEntry,
	CBTThought,
	CreateCBTEntryRequest,
	UpdateCBTEntryRequest,
} from '@/services/api/types';
import { databaseService } from '@/services/DatabaseService';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useCBTStore = defineStore('cbt', () => {
	const sync = useSync();

	// Local state
	const localEntries = ref<CBTEntry[]>([]);
	const currentEntry = ref<CBTEntry | null>(null);
	const lastLoadTime = ref<string | null>(null);
	const filters = ref({
		dateFrom: null as string | null,
		dateTo: null as string | null,
		tags: [] as string[],
		moodRange: [1, 10] as [number, number],
		search: '',
	});

	// Getters
	const entries = computed(() => localEntries.value);
	const isLoading = ref(false);
	const isSaving = ref(false);
	const error = ref<string | null>(null);

	const filteredEntries = computed(() => {
		let filtered: CBTEntry[] = entries.value;
		if (filters.value.dateFrom) {
			filtered = filtered.filter(
				(entry: CBTEntry) =>
					new Date(entry.createdAt) >= new Date(filters.value.dateFrom!)
			);
		}
		if (filters.value.dateTo) {
			filtered = filtered.filter(
				(entry: CBTEntry) =>
					new Date(entry.createdAt) <= new Date(filters.value.dateTo!)
			);
		}
		if (filters.value.tags.length > 0) {
			filtered = filtered.filter((entry: CBTEntry) =>
				filters.value.tags.some((tag: string) => entry.tags.includes(tag))
			);
		}
		filtered = filtered.filter(
			(entry: CBTEntry) =>
				entry.moodScoreBefore >= filters.value.moodRange[0] &&
				entry.moodScoreBefore <= filters.value.moodRange[1]
		);
		if (filters.value.search) {
			const query = filters.value.search.toLowerCase();
			filtered = filtered.filter(
				(entry: CBTEntry) =>
					entry.situation.toLowerCase().includes(query) ||
					entry.reactions.toLowerCase().includes(query) ||
					entry.thoughts.some((thought: CBTThought) =>
						thought.thought.toLowerCase().includes(query)
					) ||
					entry.tags.some((tag: string) => tag.toLowerCase().includes(query))
			);
		}
		return filtered.sort(
			(a: CBTEntry, b: CBTEntry) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	});

	// Stats
	const totalEntries = computed(() => entries.value.length);
	const averageMoodBefore = computed(() => {
		if (entries.value.length === 0) return 0;
		const total = entries.value.reduce(
			(sum: number, entry: CBTEntry) => sum + entry.moodScoreBefore,
			0
		);
		return Number((total / entries.value.length).toFixed(1));
	});
	const averageMoodAfter = computed(() => {
		const entriesWithAfter = entries.value.filter(
			(entry: CBTEntry) =>
				entry.moodScoreAfter !== null && entry.moodScoreAfter !== undefined
		);
		if (entriesWithAfter.length === 0) return 0;
		const total = entriesWithAfter.reduce(
			(sum: number, entry: CBTEntry) => sum + (entry.moodScoreAfter || 0),
			0
		);
		return Number((total / entriesWithAfter.length).toFixed(1));
	});
	const moodImprovement = computed(() => {
		if (averageMoodBefore.value === 0) return 0;
		return Number(
			(
				((averageMoodAfter.value - averageMoodBefore.value) /
					averageMoodBefore.value) *
				100
			).toFixed(1)
		);
	});
	const mostUsedTags = computed(() => {
		const tagCounts: Record<string, number> = {};
		entries.value.forEach((entry: CBTEntry) => {
			entry.tags.forEach((tag: string) => {
				tagCounts[tag] = (tagCounts[tag] || 0) + 1;
			});
		});
		return Object.entries(tagCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([tag, count]) => ({ tag, count }));
	});
	const allTags = computed(() => {
		const tags = new Set<string>();
		entries.value.forEach((entry: CBTEntry) => {
			entry.tags.forEach((tag: string) => tags.add(tag));
		});
		return Array.from(tags).sort();
	});
	const recentEntries = computed(() => entries.value.slice(0, 5));

	// Actions
	const loadEntries = async (limit = 100) => {
		isLoading.value = true;
		error.value = null;
		try {
			const list = await databaseService.getCBTEntries(limit);
			localEntries.value = list;
			lastLoadTime.value = new Date().toISOString();
			saveToLocalStorage();
		} catch (err: any) {
			error.value = err.message || 'Ошибка загрузки записей';
			// fallback: из кэша
			loadFromLocalStorage();
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const createEntry = async (entryData: CreateCBTEntryRequest) => {
		isSaving.value = true;
		error.value = null;
		try {
			const created = await databaseService.createCBTEntry(entryData);
			localEntries.value.unshift(created);
			saveToLocalStorage();
			if (sync.isOnline.value) {
				sync.performSync();
			}
			return created;
		} catch (err: any) {
			error.value = err.message || 'Ошибка создания записи';
			throw err;
		} finally {
			isSaving.value = false;
		}
	};

	const updateEntry = async (id: string, entryData: UpdateCBTEntryRequest) => {
		isSaving.value = true;
		error.value = null;
		try {
			const updated = await databaseService.updateCBTEntry(id, entryData);
			const index = localEntries.value.findIndex((e: CBTEntry) => e.id === id);
			if (index !== -1) localEntries.value[index] = updated;
			saveToLocalStorage();
			if (sync.isOnline.value) {
				sync.performSync();
			}
			return updated;
		} catch (err: any) {
			error.value = err.message || 'Ошибка обновления записи';
			throw err;
		} finally {
			isSaving.value = false;
		}
	};

	const deleteEntry = async (id: string) => {
		error.value = null;
		try {
			await databaseService.deleteCBTEntry(id);
			localEntries.value = localEntries.value.filter(
				(e: CBTEntry) => e.id !== id
			);
			if (currentEntry.value?.id === id) currentEntry.value = null;
			saveToLocalStorage();
			if (sync.isOnline.value) {
				sync.performSync();
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка удаления записи';
			throw err;
		}
	};

	const updateMoodAfter = async (id: string, moodScore: number) => {
		try {
			return await updateEntry(id, { moodScoreAfter: moodScore });
		} catch (err) {
			throw err;
		}
	};

	const getRecentEntries = async (limit: number = 10) => {
		try {
			// из локальной БД
			if (entries.value.length === 0) {
				await loadEntries(limit);
			}
			return entries.value.slice(0, limit);
		} catch (err) {
			return entries.value.slice(0, limit);
		}
	};

	// Entry management
	const setCurrentEntry = (entry: CBTEntry | null) => {
		currentEntry.value = entry;
	};
	const getEntryById = (id: string): CBTEntry | undefined => {
		return entries.value.find((entry: CBTEntry) => entry.id === id);
	};

	// Совместимость: вернуть массив мыслей из записи, независимо от формата хранения
	const getEntryThoughts = (entry: CBTEntry): CBTThought[] => {
		const raw: any = (entry as any).thoughts;
		if (Array.isArray(raw)) return raw as CBTThought[];
		if (typeof raw === 'string') {
			try {
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? (parsed as CBTThought[]) : [];
			} catch {
				return [];
			}
		}
		return [];
	};

	// Filters
	const setFilters = (newFilters: Partial<typeof filters.value>) => {
		filters.value = { ...filters.value, ...newFilters };
	};
	const clearFilters = () => {
		filters.value = {
			dateFrom: null,
			dateTo: null,
			tags: [],
			moodRange: [1, 10],
			search: '',
		};
	};
	const setDateFilter = (dateFrom: string | null, dateTo: string | null) => {
		filters.value.dateFrom = dateFrom;
		filters.value.dateTo = dateTo;
	};
	const setTagsFilter = (tags: string[]) => {
		filters.value.tags = tags;
	};
	const setMoodRangeFilter = (range: [number, number]) => {
		filters.value.moodRange = range;
	};
	const setSearchFilter = (search: string) => {
		filters.value.search = search;
	};

	// Local cache
	const saveToLocalStorage = () => {
		try {
			const data = {
				entries: localEntries.value,
				lastLoadTime: lastLoadTime.value,
			};
			localStorage.setItem('cbt-entries-cache', JSON.stringify(data));
		} catch (err) {
			console.warn('Не удалось сохранить CBT записи в localStorage:', err);
		}
	};
	const loadFromLocalStorage = () => {
		try {
			const stored = localStorage.getItem('cbt-entries-cache');
			if (stored) {
				const data = JSON.parse(stored) as {
					entries: CBTEntry[];
					lastLoadTime: string | null;
				};
				localEntries.value = data.entries || [];
				lastLoadTime.value = data.lastLoadTime || null;
			}
		} catch (err) {
			console.warn('Не удалось загрузить CBT записи из localStorage:', err);
		}
	};
	const clearCache = () => {
		localEntries.value = [];
		currentEntry.value = null;
		lastLoadTime.value = null;
		try {
			localStorage.removeItem('cbt-entries-cache');
		} catch {}
	};

	// Init
	const initialize = async () => {
		try {
			loadFromLocalStorage();
			await loadEntries();
		} catch {
			// оффлайн — останемся на кэше
		}
	};

	const setEntryChatId = (entryId: string, chatId: string) => {
		const idx = localEntries.value.findIndex((e: CBTEntry) => e.id === entryId);
		if (idx !== -1) {
			(localEntries.value[idx] as any).chatId = chatId;
			saveToLocalStorage();
		}
	};

	return {
		// State
		entries,
		filteredEntries,
		currentEntry: computed(() => currentEntry.value),
		isLoading,
		isSaving,
		error,
		filters: computed(() => filters.value),
		lastLoadTime: computed(() => lastLoadTime.value),

		// Statistics
		totalEntries,
		averageMoodBefore,
		averageMoodAfter,
		moodImprovement,
		mostUsedTags,
		allTags,
		recentEntries,

		// Actions - CRUD
		loadEntries,
		createEntry,
		updateEntry,
		deleteEntry,
		updateMoodAfter,
		getRecentEntries,

		// Entry management
		setCurrentEntry,
		getEntryById,
		getEntryThoughts,

		// Filters
		setFilters,
		clearFilters,
		setDateFilter,
		setTagsFilter,
		setMoodRangeFilter,
		setSearchFilter,

		// Cache
		clearCache,
		initialize,
		setEntryChatId,
	};
});

export type CBTStore = ReturnType<typeof useCBTStore>;
