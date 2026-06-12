/**
 * @cbd/platform — платформенно-зависимый слой CBD Diary.
 *
 * Здесь живёт «разное»: то, что по-разному работает (или существует только)
 * в нативной Tauri-сборке против обычного браузера/PWA. Общий UI, страницы и
 * сторы остаются в приложении и платформенных деталей не знают.
 *
 *  - detect : определение рантайма (Tauri vs web), standalone, iOS, поддержка push
 *  - pwa    : перехват промпта установки + регистрация service worker
 *  - push   : web push поверх Firebase Cloud Messaging
 *
 * REST-адаптер локальной БД для web живёт в приложении (services/web), т.к.
 * он завязан на бизнес-слой REST-клиента (services/api).
 */

export * from './detect';
export * from './pwa';
export * from './push';
