export type NotificationEventType =
  | 'draft_ready'
  | 'draft_stale'
  | 'adventure_prep'
  | 'adventure_day_of'
  | 'adventure_overdue'
  | 'adventure_missed'
  | 'adventure_completed'
  | 'idle_nudge';

export type NotificationIntent =
  | { screen: 'MainTabs'; params: { screen: 'Home' | 'Journeys' | 'Passport' } };

export interface NotificationContent {
  title: string;
  body: string;
  intent: NotificationIntent;
}

export interface NotificationContext {
  adventureId?: string;
}

export interface NotificationPayload {
  type: NotificationEventType;
  adventureId?: string;
  intent: NotificationIntent;
}

export const NOTIFICATION_QUIET_HOURS = {
  startHour: 21,
  endHour: 8,
} as const;

export const NOTIFICATION_NOTICE_COPY = {
  permissionPrimer: {
    title: 'TRAVIS: LET ME TAP THE WINDOW',
    message:
      'Turn on notifications and I’ll handle the timing. You just show up when the open road starts calling.',
  },
  permissionDenied: {
    title: 'TRAVIS: I CAN’T NUDGE A LOCKED DOOR',
    message:
      'Notifications are off. You can still use the app, but the timing is on you until you re-enable them in Settings.',
  },
  timingUpdated: {
    title: 'TRAVIS: TIMING UPDATED',
    message: 'I moved the reminders. Same itinerary, better timing.',
  },
} as const;

export function buildNotificationContent(
  type: NotificationEventType,
  context: NotificationContext = {},
): NotificationContent {
  switch (type) {
    case 'draft_ready':
      return {
        title: 'TRAVIS: YOUR ITINERARY IS READY',
        body: 'I put together something better than another night on autopilot. Open it and pick your day.',
        intent: { screen: 'MainTabs', params: { screen: 'Journeys' } },
      };
    case 'draft_stale':
      return {
        title: 'TRAVIS: THAT ITINERARY IS WAITING',
        body: 'The open road is still sitting on the desk. Pick a day before this becomes another idea you almost did.',
        intent: { screen: 'MainTabs', params: { screen: 'Journeys' } },
      };
    case 'adventure_prep':
      return {
        title: 'TRAVIS: TOMORROW HAS A PLAN',
        body: 'Give your itinerary a quick look tonight. Future you will appreciate the head start.',
        intent: { screen: 'MainTabs', params: { screen: 'Journeys' } },
      };
    case 'adventure_day_of':
      return {
        title: 'TRAVIS: TODAY LOOKS GOOD',
        body: 'You’ve got an itinerary and a full day in front of you. Go make the passport earn a stamp.',
        intent: { screen: 'MainTabs', params: { screen: 'Journeys' } },
      };
    case 'adventure_overdue':
      return {
        title: 'TRAVIS: THE DAY’S NOT GONE YET',
        body: 'If the itinerary is still alive, there’s still time to salvage something story-worthy.',
        intent: { screen: 'MainTabs', params: { screen: 'Journeys' } },
      };
    case 'adventure_missed':
      return {
        title: 'TRAVIS: WE LET ONE SLIP',
        body: 'It happens. Shake it off and I’ll help you put something better on the desk next time.',
        intent: { screen: 'MainTabs', params: { screen: 'Journeys' } },
      };
    case 'adventure_completed':
      return {
        title: 'TRAVIS: THAT’S A STAMP',
        body: 'See? A little momentum looks good on you. Your passport just got more interesting.',
        intent: { screen: 'MainTabs', params: { screen: 'Passport' } },
      };
    case 'idle_nudge':
      return {
        title: 'TRAVIS: READY FOR ANOTHER ONE?',
        body: 'The desk is quiet and your passport could use fresh ink. Let me draft something worth leaving the house for.',
        intent: { screen: 'MainTabs', params: { screen: 'Home' } },
      };
  }
}

export function createNotificationPayload(
  type: NotificationEventType,
  context: NotificationContext = {},
): NotificationPayload {
  const { intent } = buildNotificationContent(type, context);
  return {
    type,
    adventureId: context.adventureId,
    intent,
  };
}

export function isWithinQuietHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= NOTIFICATION_QUIET_HOURS.startHour || hour < NOTIFICATION_QUIET_HOURS.endHour;
}

export function shiftOutOfQuietHours(date: Date): Date {
  const shifted = new Date(date);
  if (!isWithinQuietHours(shifted)) {
    return shifted;
  }

  if (shifted.getHours() >= NOTIFICATION_QUIET_HOURS.startHour) {
    shifted.setDate(shifted.getDate() + 1);
  }

  shifted.setHours(NOTIFICATION_QUIET_HOURS.endHour, 0, 0, 0);
  return shifted;
}
