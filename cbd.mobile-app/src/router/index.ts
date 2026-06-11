import { apiClient, authService } from '@/services/api';
import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

// Импорты страниц
import AddEntry from '../pages/AddEntry.vue';
import Analytics from '../pages/Analytics.vue';
import Diary from '../pages/Diary.vue';
import Home from '../pages/Home.vue';
import Login from '../pages/Login.vue';
import Settings from '../pages/Settings.vue';
import UserProfile from '../pages/UserProfile.vue';

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		redirect: '/home',
	},
	{
		path: '/login',
		name: 'Login',
		component: Login,
		meta: {
			requiresAuth: false,
			hideTabBar: true,
		},
	},
	{
		path: '/profile',
		name: 'UserProfile',
		component: UserProfile,
		meta: {
			requiresAuth: true,
			hideTabBar: true,
		},
	},
	{
		path: '/home',
		name: 'Home',
		component: Home,
		meta: {
			requiresAuth: true,
			hideTabBar: false,
		},
	},
	{
		path: '/diary',
		name: 'Diary',
		component: Diary,
		meta: {
			requiresAuth: true,
			hideTabBar: false,
		},
	},
	{
		path: '/analytics',
		name: 'Analytics',
		component: Analytics,
		meta: {
			requiresAuth: true,
			hideTabBar: false,
		},
	},
	{
		path: '/settings',
		name: 'Settings',
		component: Settings,
		meta: {
			requiresAuth: true,
			hideTabBar: false,
		},
	},
	{
		path: '/capture',
		name: 'Capture',
		component: () => import('../pages/VoiceCapture.vue'),
		meta: {
			requiresAuth: true,
			hideTabBar: true,
		},
	},
	{
		path: '/add-entry',
		name: 'AddEntry',
		component: AddEntry,
		meta: {
			requiresAuth: true,
			hideTabBar: true,
		},
	},
	{
		path: '/logs',
		name: 'Logs',
		component: () => import('../pages/Logs.vue'),
		meta: {
			requiresAuth: false,
			hideTabBar: true,
		},
	},
	{
		path: '/chat/:chatId',
		name: 'Chat',
		component: () => import('../pages/Chat.vue'),
		meta: { requiresAuth: true, hideTabBar: true },
		props: true,
	},
	{
		path: '/chat/entry/:entryId',
		name: 'ChatByEntry',
		component: () => import('../pages/Chat.vue'),
		meta: { requiresAuth: true, hideTabBar: true },
		props: true,
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

// Guard для проверки авторизации
router.beforeEach(async (to, _from, next) => {
	// Дожидаемся загрузки токенов из безопасного хранилища
	try {
		await apiClient.ready();
	} catch {}
	const requiresAuth = to.meta.requiresAuth;

	if (requiresAuth) {
		try {
			// Требуем именно веб-авторизацию (API токены)
			if (authService.isAuthenticated()) {
				return next();
			}
			return next('/login');
		} catch (error) {
			console.error('Auth check failed:', error);
			return next('/login');
		}
	} else {
		next();
	}
});

export default router;
