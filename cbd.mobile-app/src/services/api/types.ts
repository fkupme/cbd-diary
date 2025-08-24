/**
 * API Types
 * Типы для всех API запросов и ответов
 */

// ===============================
// Common API Types
// ===============================

export interface ApiResponse<T = any> {
	success: boolean;
	data: T;
	message?: string;
	meta?: {
		pagination?: PaginationMeta;
		total?: number;
		page?: number;
		limit?: number;
	};
}

export interface ApiError {
	success: false;
	error: {
		code: string;
		message: string;
		details?: any;
	};
	statusCode: number;
}

export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface PaginationParams {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

// ===============================
// Auth API Types
// ===============================

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	password: string;
	name?: string; // ожидается бэкендом
	username?: string; // обратная совместимость, будет смэплено в name
	preferredLanguage?: string; // опционально, по умолчанию 'ru'
}

export interface AuthResponse {
	user: User;
	accessToken: string;
	refreshToken: string;
}

export interface RefreshTokenRequest {
	refreshToken: string;
}

export interface RefreshTokenResponse {
	accessToken: string;
}

// ===============================
// User API Types
// ===============================

export interface User {
	id: string;
	email: string;
	username?: string;
	createdAt: string;
	updatedAt: string;
	profile?: UserProfile;
	pushEnabled?: boolean;
}

export interface UserProfile {
	firstName?: string;
	lastName?: string;
	avatar?: string;
	bio?: string;
	dateOfBirth?: string;
	timezone?: string;
}

export interface UpdateUserRequest {
	email?: string;
	username?: string;
	name?: string;
	preferredLanguage?: string;
	age?: number;
	gender?: string;
	goals?: string[];
	experienceLevel?: string;
	meditationFrequency?: string;
	stressLevel?: number;
	sleepQuality?: number;
	timezone?: string;
	// старый формат вложенного профиля для совместимости
	profile?: Partial<UserProfile>;
	pushEnabled?: boolean;
}

export interface ChangePasswordRequest {
	currentPassword: string;
	newPassword: string;
}

// ===============================
// Emotions API Types
// ===============================

export interface EmotionCategory {
	id: number;
	name: string;
	name_key: string;
	description?: string;
	color: string;
	emoji?: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface Emotion {
	id: number;
	categoryId: number;
	name: string;
	name_key: string;
	description?: string;
	intensity?: number;
	emoji?: string;
	color?: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	category?: EmotionCategory;
}

export interface CreateEmotionCategoryRequest {
	name: string;
	name_key: string;
	description?: string;
	color: string;
	emoji?: string;
	sortOrder?: number;
}

export interface CreateEmotionRequest {
	categoryId: number;
	name: string;
	name_key: string;
	description?: string;
	intensity?: number;
	emoji?: string;
	color?: string;
	sortOrder?: number;
}

// ===============================
// CBT API Types
// ===============================

export interface CBTEntry {
	id: string;
	userId: string;
	situation: string;
	thoughts: CBTThought[];
	reactions: string;
	moodScoreBefore: number;
	moodScoreAfter?: number;
	tags: string[];
	isPublic: boolean;
	chatId?: string;
	serverId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface CBTThought {
	id: string;
	entryId: string;
	thought: string;
	isAutomatic: boolean;
	intensity: number;
	emotions: CBTEmotion[];
	cognitiveDistortions: CognitiveDistortion[];
	createdAt: string;
	updatedAt: string;
}

export interface CBTEmotion {
	id: string;
	thoughtId: string;
	emotionId: number;
	intensity: number;
	emotion?: Emotion;
}

export interface CognitiveDistortion {
	id: string;
	thoughtId: string;
	type: string;
	description?: string;
}

export interface CreateCBTEntryRequest {
	situation: string;
	thoughts: CreateCBTThoughtRequest[];
	reactions: string;
	moodScoreBefore: number;
	tags?: string[];
	isPublic?: boolean;
}

export interface CreateCBTThoughtRequest {
	thought: string;
	isAutomatic?: boolean;
	intensity: number;
	emotions: CreateCBTEmotionRequest[];
	cognitiveDistortions?: CreateCognitiveDistortionRequest[];
}

export interface CreateCBTEmotionRequest {
	emotionId: number;
	intensity: number;
}

export interface CreateCognitiveDistortionRequest {
	type: string;
	description?: string;
}

export interface UpdateCBTEntryRequest {
	situation?: string;
	reactions?: string;
	moodScoreBefore?: number;
	moodScoreAfter?: number;
	tags?: string[];
	isPublic?: boolean;
}

export interface UpdateMoodAfterRequest {
	moodScoreAfter: number;
}

// ===============================
// Analytics API Types
// ===============================

export interface UserStats {
	totalEntries: number;
	totalEmotions: number;
	averageMoodBefore: number;
	averageMoodAfter?: number;
	moodImprovement?: number;
	mostCommonEmotions: EmotionStat[];
	streakDays: number;
	lastEntryDate?: string;
}

export interface EmotionStat {
	emotion: Emotion;
	count: number;
	percentage: number;
	averageIntensity: number;
}

export interface MoodTrend {
	date: string;
	averageMoodBefore: number;
	averageMoodAfter?: number;
	entryCount: number;
}

export interface CognitiveInsight {
	distortionType: string;
	count: number;
	percentage: number;
	improvement?: number;
}

export interface ProgressReport {
	period: 'week' | 'month' | 'year';
	startDate: string;
	endDate: string;
	moodTrends: MoodTrend[];
	emotionStats: EmotionStat[];
	cognitiveInsights: CognitiveInsight[];
	summary: {
		averageImprovement: number;
		totalEntries: number;
		mostImprovedAreas: string[];
		recommendations: string[];
	};
}

// Новые типы для расширенной сводки аналитики
export interface CategoryDiversityDistributionItem {
	categoryId: number;
	categoryName: string;
	color?: string;
	count: number;
	percentage: number;
}

export interface CategoryDiversity {
	uniqueCategories: number;
	shannon: number;
	simpson: number;
	evenness: number;
	distribution: CategoryDiversityDistributionItem[];
}

export interface EntriesTimelinePoint {
	date: string; // YYYY-MM-DD
	entriesCount: number;
}

export interface AiSessionsByDayPoint {
	date: string;
	sessions: number;
	successes: number;
}

export interface AiSessionsMetrics {
	totalSessions: number;
	endedSessions: number;
	successRate: number;
	averageLengthMinutes: number;
	averageAiMessages: number;
	byDay: AiSessionsByDayPoint[];
}

export interface AnalyticsSummary {
	userStats: any; // серверный UserStatsResponseDto; для упрощения оставим any
	emotionAnalytics: any[];
	moodTrends: any;
	cognitiveInsights: any;
	progressReport: any;
	categoryDiversity: CategoryDiversity;
	entriesTimeline: EntriesTimelinePoint[];
	aiSessions: AiSessionsMetrics;
	generatedAt?: string;
	dataQuality?: { score: number; issues: string[]; recommendations: string[] };
}

// ===============================
// Sync API Types
// ===============================

export type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncDataDto {
	operationType: OperationType;
	tableName: string;
	recordId: string;
	dataSnapshot: any;
	createdAt?: string;
}

export interface SyncUserDataRequest {
	lastSyncAt?: string;
	operations: SyncDataDto[];
	schemaVersion?: string;
}

export interface SyncUserDataResponse {
	success: boolean;
	serverOperations: SyncDataDto[];
	conflicts: SyncConflict[];
	newSyncTimestamp: string;
	stats: {
		processedOperations: number;
		appliedOperations: number;
		conflictCount: number;
		errorCount: number;
	};
}

export interface SyncConflict {
	id: string;
	type: 'entry';
	localVersion: CBTEntry;
	serverVersion: CBTEntry;
	conflictFields: string[];
}

export interface ResolveConflictsRequest {
	resolutions: ConflictResolution[];
}

export interface ConflictResolution {
	conflictId: string;
	resolution: 'local' | 'server' | 'merge';
	mergedData?: Partial<CBTEntry>;
}

export interface SyncStatus {
	isOnline: boolean;
	lastSyncTimestamp?: string;
	pendingChanges: number;
	syncInProgress: boolean;
	errors: string[];
}

export interface SyncHealth {
	status: 'healthy' | 'degraded' | 'down';
	uptime: number;
	responseTime: number;
	errorRate: number;
}

// ===============================
// Request Options Types
// ===============================

export interface RequestOptions {
	timeout?: number;
	retries?: number;
	headers?: Record<string, string>;
	params?: Record<string, any>;
}

export interface AuthenticatedRequestOptions extends RequestOptions {
	requireAuth?: boolean;
}

// ===============================
// Chat API Types
// ===============================

export interface Chat {
	id: string;
	userId: string;
	cbtEntryId: string;
	createdAt: string;
	updatedAt: string;
}

export type ChatMessageRole = 'USER' | 'AI' | 'SYSTEM';

export interface ChatMessage {
	id: string;
	chatId: string;
	role: ChatMessageRole;
	content: string;
	createdAt: string;
}
