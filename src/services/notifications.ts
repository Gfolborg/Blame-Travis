import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationsService = {
  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B71C1C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      console.warn('Must use physical device for Push Notifications');
    }

    return token;
  },

  async scheduleCommitmentNudge(adventureId: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "TRAVIS: YOUR PLAN IS READY",
        body: "I put together something good. Take a look and pick the day before you talk yourself out of it.",
        data: { adventureId, type: 'commitment' },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3600, // 1 hour later
      },
    });
  },

  async scheduleAdventureReminders(adventureId: string, dropDate: string) {
    const dropTime = new Date(dropDate).getTime();
    
    // 1. Preparation (24 hours before)
    const prepTrigger = dropTime - 86400000;
    if (prepTrigger > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "TRAVIS: TOMORROW'S THE DAY",
          body: "You've got plans tomorrow. Give the rundown a quick look and make sure future you is ready.",
          data: { adventureId, type: 'prep' },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: new Date(prepTrigger),
        } as any,
      });
    }

    // 2. Day-of (Morning at 9 AM)
    const dayOf = new Date(dropDate);
    dayOf.setHours(9, 0, 0, 0);
    if (dayOf.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "TRAVIS: TODAY LOOKS GOOD",
          body: "Today's your adventure day. Go make it a good one.",
          data: { adventureId, type: 'dayOf' },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: dayOf,
        } as any,
      });
    }
  },

  async cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async scheduleIdleNudge() {
    // Schedule a repeating nudge every 3 days if idle
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "TRAVIS: WANT TO DO SOMETHING FUN?",
        body: "Your week could use a little more personality. Let me put something together.",
        data: { type: 'idle' },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 86400 * 3, // 3 days
        repeats: true,
      },
    });
  }
};
