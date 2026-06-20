/**
 * lib/notifications.web.ts
 *
 * Web stub — expo-notifications is not available on web.
 * Metro / Expo bundler auto-selects this file on web builds
 * instead of notifications.ts, preventing the LegacyEventEmitter crash.
 */

export async function requestNotificationPermission(): Promise<boolean> { return false; }
export async function getExpoPushToken(): Promise<string | null>        { return null; }
export async function savePushToken(_uid: string, _token: string)       { /* no-op */ }
export async function setupNotifications(_userId?: string)              { return null; }
export async function notifyNow(_title: string, _body: string, _data?: object) { /* no-op */ }
export async function notifyAt(_title: string, _body: string, _date: Date, _data?: object) { return null; }
export async function cancelNotification(_id: string)                   { /* no-op */ }

export const notifyNewApplication    = (_staffName: string, _role: string, _eventTitle: string) => Promise.resolve();
export const notifyMissionSoon       = (_eventTitle: string, _date: Date)                        => Promise.resolve(null);
export const notifyApplicationAccepted = (_role: string, _eventTitle: string)                    => Promise.resolve();
export const notifyNewMission        = (_role: string, _location: string, _rate: number)         => Promise.resolve();
