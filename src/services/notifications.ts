import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Platform } from 'react-native';

import {
  buildNotificationContent,
  createNotificationPayload,
  NOTIFICATION_NOTICE_COPY,
  NotificationContent,
  NotificationEventType,
  NotificationIntent,
  NotificationPayload,
  shiftOutOfQuietHours,
} from '../../shared/notifications';
import { Adventure } from '../types/adventure';
import { supabase } from './supabase';

const INSTALL_ID_KEY = 'notifications.install_id';
const LOCAL_SCHEDULE_KEY = 'notifications.local_schedule_map';
const LAST_IDLE_KEY = 'notifications.last_idle_at';
const LAST_ADVENTURE_KEY = 'notifications.last_adventure_id';
const GUEST_ID = '00000000-0000-0000-0000-000000000000';
const REMOTE_PUSH_ENABLED = false;

type LocalScheduleMap = Record<string, string[]>;
type PermissionStatus = 'granted' | 'denied' | 'undetermined';
type NoticePresenter = (notice: {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}) => void;
type NotificationResponseHandler = (_intent: NotificationIntent, _payload: NotificationPayload) => void;

let foregroundNoticePresenter: NoticePresenter | null = null;
let responseHandler: NotificationResponseHandler | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

async function getInstallId() {
  const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (existing) return existing;

  const next = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(INSTALL_ID_KEY, next);
  return next;
}

async function getScheduleMap(): Promise<LocalScheduleMap> {
  const raw = await AsyncStorage.getItem(LOCAL_SCHEDULE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as LocalScheduleMap;
  } catch {
    return {};
  }
}

async function setScheduleMap(map: LocalScheduleMap) {
  await AsyncStorage.setItem(LOCAL_SCHEDULE_KEY, JSON.stringify(map));
}

async function cancelScheduleGroup(groupKey: string) {
  const map = await getScheduleMap();
  const identifiers = map[groupKey] ?? [];
  if (identifiers.length > 0) {
    await Promise.all(
      identifiers.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
    );
  }
  delete map[groupKey];
  await setScheduleMap(map);
}

async function replaceScheduleGroup(groupKey: string, identifiers: string[]) {
  const map = await getScheduleMap();
  const existing = map[groupKey] ?? [];
  if (existing.length > 0) {
    await Promise.all(
      existing.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
    );
  }
  map[groupKey] = identifiers;
  await setScheduleMap(map);
}

function toDateTrigger(date: Date): Notifications.DateTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
  };
}

function getLocalSchedulePlan(adventure: Adventure): Array<{ type: NotificationEventType; when: Date }> {
  const now = Date.now();
  const dropDate = new Date(adventure.drop_date);
  const draftCreated = new Date(adventure.created_at);
  const items: Array<{ type: NotificationEventType; when: Date }> = [];

  if (adventure.status === 'draft') {
    const readyAt = shiftOutOfQuietHours(new Date(draftCreated.getTime() + 90 * 60 * 1000));
    if (readyAt.getTime() > now) {
      items.push({ type: 'draft_ready', when: readyAt });
    }

    const staleAt = shiftOutOfQuietHours(
      new Date(
        draftCreated.getFullYear(),
        draftCreated.getMonth(),
        draftCreated.getDate() + 1,
        10,
        0,
        0,
        0,
      ),
    );
    if (staleAt.getTime() > now) {
      items.push({ type: 'draft_stale', when: staleAt });
    }
  }

  if (adventure.status === 'active') {
    const prepAt = shiftOutOfQuietHours(
      new Date(dropDate.getFullYear(), dropDate.getMonth(), dropDate.getDate() - 1, 18, 0, 0, 0),
    );
    const dayOfAt = shiftOutOfQuietHours(
      new Date(dropDate.getFullYear(), dropDate.getMonth(), dropDate.getDate(), 9, 0, 0, 0),
    );
    const overdueAt = shiftOutOfQuietHours(
      new Date(dropDate.getFullYear(), dropDate.getMonth(), dropDate.getDate(), 18, 0, 0, 0),
    );

    [prepAt, dayOfAt, overdueAt].forEach((date, index) => {
      if (date.getTime() <= now) return;
      items.push({
        type: index === 0 ? 'adventure_prep' : index === 1 ? 'adventure_day_of' : 'adventure_overdue',
        when: date,
      });
    });
  }

  return items;
}

async function scheduleLocalNotification(type: NotificationEventType, when: Date, adventureId?: string) {
  const content = buildNotificationContent(type, { adventureId });
  return Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: createNotificationPayload(type, { adventureId }) as unknown as Record<string, unknown>,
    },
    trigger: toDateTrigger(when),
  });
}

async function upsertDeviceRecord(input: {
  profileId: string;
  permissionStatus: PermissionStatus;
  expoPushToken?: string | null;
}) {
  const installId = await getInstallId();
  const payload = {
    install_id: installId,
    profile_id: input.profileId,
    expo_push_token: input.expoPushToken ?? null,
    platform: Platform.OS,
    permission_status: input.permissionStatus,
    app_version: Constants.expoConfig?.version ?? '0.0.0',
    last_seen_at: new Date().toISOString(),
    disabled_at: input.permissionStatus === 'granted' ? null : new Date().toISOString(),
  };

  const { error } = await supabase.from('notification_devices').upsert(payload, {
    onConflict: 'install_id',
  });

  if (error) {
    console.warn('Failed to upsert notification device', error.message);
  }
}

async function getPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function requestPermissionWithPrompt(showNotice?: NoticePresenter): Promise<PermissionStatus> {
  const existingStatus = await getPermissionStatus();
  if (existingStatus === 'granted') {
    return existingStatus;
  }

  showNotice?.({
    title: NOTIFICATION_NOTICE_COPY.permissionPrimer.title,
    message: NOTIFICATION_NOTICE_COPY.permissionPrimer.message,
    type: 'info',
  });

  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

function readPayload(data: unknown): NotificationPayload | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Partial<NotificationPayload>;
  if (!payload.type || !payload.intent) return null;
  return payload as NotificationPayload;
}

async function markNotificationOpened(payload: NotificationPayload) {
  if (!payload.adventureId) return;

  const dedupeKey = `${payload.type}:${payload.adventureId}`;
  await supabase
    .from('notification_deliveries')
    .update({ opened_at: new Date().toISOString(), status: 'opened' })
    .eq('dedupe_key', dedupeKey);
}

export const notificationsService = {
  async ensureAndroidChannel() {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#B71C1C',
    });
  },

  setForegroundNoticePresenter(presenter: NoticePresenter | null) {
    foregroundNoticePresenter = presenter;
  },

  setNotificationResponseHandler(handler: NotificationResponseHandler | null) {
    responseHandler = handler;
  },

  attachListeners() {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const payload = readPayload(notification.request.content.data);
      if (!payload || !foregroundNoticePresenter) return;

      const content: NotificationContent = buildNotificationContent(payload.type, {
        adventureId: payload.adventureId,
      });
      foregroundNoticePresenter({
        title: content.title,
        message: content.body,
        type: 'info',
      });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const payload = readPayload(response.notification.request.content.data);
      if (!payload || !responseHandler) return;
      await markNotificationOpened(payload);
      responseHandler(payload.intent, payload);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  },

  async registerDevice(profileId: string, options?: { showNotice?: NoticePresenter; shouldPrompt?: boolean }) {
    await this.ensureAndroidChannel();

    let permissionStatus = await getPermissionStatus();
    if (options?.shouldPrompt !== false && permissionStatus !== 'granted') {
      permissionStatus = await requestPermissionWithPrompt(options?.showNotice);
    }

    if (permissionStatus !== 'granted') {
      options?.showNotice?.({
        title: NOTIFICATION_NOTICE_COPY.permissionDenied.title,
        message: NOTIFICATION_NOTICE_COPY.permissionDenied.message,
        type: 'warning',
      });
      await upsertDeviceRecord({ profileId, permissionStatus, expoPushToken: null });
      return null;
    }

    if (!REMOTE_PUSH_ENABLED) {
      await upsertDeviceRecord({ profileId, permissionStatus, expoPushToken: null });
      return null;
    }

    if (!Device.isDevice) {
      await upsertDeviceRecord({ profileId, permissionStatus, expoPushToken: null });
      return null;
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;

    await upsertDeviceRecord({ profileId, permissionStatus, expoPushToken: token });
    return token;
  },

  async disableNotifications(profileId: string) {
    const installId = await getInstallId();
    await supabase
      .from('notification_devices')
      .update({
        disabled_at: new Date().toISOString(),
        permission_status: 'denied',
        last_seen_at: new Date().toISOString(),
      })
      .eq('install_id', installId)
      .eq('profile_id', profileId);

    const map = await getScheduleMap();
    await Promise.all(
      Object.keys(map).map((groupKey) => cancelScheduleGroup(groupKey)),
    );
    await AsyncStorage.removeItem(LAST_IDLE_KEY);
  },

  async markAppForeground(profileId?: string) {
    if (!profileId) return;

    const installId = await getInstallId();
    await supabase
      .from('notification_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('install_id', installId)
      .eq('profile_id', profileId);
  },

  async syncAdventureNotifications(adventure: Adventure | null, options: {
    profileId: string;
    notificationsEnabled: boolean;
    isGuest: boolean;
    showNotice?: NoticePresenter;
  }) {
    if (!options.isGuest) {
      if (options.notificationsEnabled && REMOTE_PUSH_ENABLED) {
        await this.registerDevice(options.profileId, { showNotice: options.showNotice, shouldPrompt: false });
      }
      return;
    }

    const previousAdventureId = await AsyncStorage.getItem(LAST_ADVENTURE_KEY);
    if (previousAdventureId && previousAdventureId !== adventure?.id) {
      await cancelScheduleGroup(`adventure:${previousAdventureId}`);
    }

    if (!options.notificationsEnabled || !adventure) {
      if (previousAdventureId) {
        await cancelScheduleGroup(`adventure:${previousAdventureId}`);
      }
      await AsyncStorage.removeItem(LAST_ADVENTURE_KEY);
      return;
    }

    const permissionStatus = await getPermissionStatus();
    if (permissionStatus !== 'granted') {
      await this.registerDevice(options.profileId, { showNotice: options.showNotice, shouldPrompt: true });
      if ((await getPermissionStatus()) !== 'granted') {
        return;
      }
    } else if (REMOTE_PUSH_ENABLED) {
      await this.registerDevice(options.profileId, { showNotice: options.showNotice, shouldPrompt: false });
    }

    if ((await getPermissionStatus()) !== 'granted') {
      return;
    }

    const identifiers = await Promise.all(
      getLocalSchedulePlan(adventure).map((item) =>
        scheduleLocalNotification(item.type, item.when, adventure.id),
      ),
    );
    await replaceScheduleGroup(`adventure:${adventure.id}`, identifiers);
    await AsyncStorage.setItem(LAST_ADVENTURE_KEY, adventure.id);
  },

  async syncIdleNudge(options: {
    profileId: string;
    currentAdventure: Adventure | null;
    notificationsEnabled: boolean;
    isGuest: boolean;
  }) {
    if (!options.isGuest) return;

    if (!options.notificationsEnabled || options.currentAdventure) {
      await cancelScheduleGroup('idle');
      await AsyncStorage.removeItem(LAST_IDLE_KEY);
      return;
    }

    const lastIdle = await AsyncStorage.getItem(LAST_IDLE_KEY);
    const now = new Date();
    const nextEligible = lastIdle ? new Date(lastIdle) : null;
    if (nextEligible && now.getTime() - nextEligible.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    const trigger = shiftOutOfQuietHours(
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0),
    );
    if (trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
      trigger.setHours(11, 0, 0, 0);
    }

    const identifier = await scheduleLocalNotification('idle_nudge', trigger);
    await replaceScheduleGroup('idle', [identifier]);
    await AsyncStorage.setItem(LAST_IDLE_KEY, now.toISOString());
  },

  async handleAppStateChange(nextState: AppStateStatus, profileId?: string) {
    if (nextState === 'active') {
      await this.markAppForeground(profileId);
    }
  },

  async showTimingUpdatedNotice(showNotice?: NoticePresenter) {
    showNotice?.({
      title: NOTIFICATION_NOTICE_COPY.timingUpdated.title,
      message: NOTIFICATION_NOTICE_COPY.timingUpdated.message,
      type: 'success',
    });
  },
};

export { AppState, GUEST_ID };
