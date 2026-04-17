import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { navigationRef } from '../navigation/navigationRef';
import { useAdventure } from '../hooks/useAdventure';
import { useProfile } from '../hooks/useProfile';
import { useNotice } from './TravisNotice';
import { GUEST_ID, notificationsService } from '../services/notifications';
import { NotificationIntent, NotificationPayload } from '../../shared/notifications';

function routeFromIntent(intent: NotificationIntent, payload: NotificationPayload) {
  if (!navigationRef.isReady()) return;

  switch (intent.screen) {
    case 'AdventureReveal':
      if (payload.adventureId) {
        navigationRef.navigate('AdventureReveal', {
          AdventureId: payload.adventureId,
        });
      } else {
        navigationRef.navigate('MainTabs', { screen: 'Home' });
      }
      break;
    case 'AdventureRequest':
      navigationRef.navigate('AdventureRequest');
      break;
    case 'MainTabs':
      navigationRef.navigate('MainTabs', intent.params);
      break;
  }
}

export const NotificationCoordinator = () => {
  const { currentAdventure } = useAdventure();
  const { profile, session } = useProfile();
  const { showNotice } = useNotice();
  const previousDropDateRef = useRef<string | null>(null);

  useEffect(() => {
    notificationsService.setForegroundNoticePresenter((notice) => {
      showNotice({
        title: notice.title,
        message: notice.message,
        type: notice.type,
        duration: 5000,
      });
    });

    notificationsService.setNotificationResponseHandler(routeFromIntent);
    const detach = notificationsService.attachListeners();
    return () => {
      notificationsService.setForegroundNoticePresenter(null);
      notificationsService.setNotificationResponseHandler(null);
      detach();
    };
  }, [showNotice]);

  useEffect(() => {
    const profileId = profile?.id ?? session?.user.id ?? GUEST_ID;
    const isGuest = !session?.user?.id || session.user.id === GUEST_ID;
    const notificationsEnabled = profile?.notifications_enabled ?? true;

    notificationsService.markAppForeground(profileId);
    notificationsService
      .syncAdventureNotifications(currentAdventure, {
        profileId,
        notificationsEnabled,
        isGuest,
        showNotice: (notice) =>
          showNotice({
            title: notice.title,
            message: notice.message,
            type: notice.type,
            duration: 5000,
          }),
      })
      .catch((error) => console.warn('Failed to sync adventure notifications', error));

    notificationsService
      .syncIdleNudge({
        profileId,
        currentAdventure,
        notificationsEnabled,
        isGuest,
      })
      .catch((error) => console.warn('Failed to sync idle nudge', error));

    if (
      currentAdventure?.drop_date &&
      previousDropDateRef.current &&
      previousDropDateRef.current !== currentAdventure.drop_date
    ) {
      notificationsService.showTimingUpdatedNotice((notice) =>
        showNotice({
          title: notice.title,
          message: notice.message,
          type: notice.type,
          duration: 4000,
        }),
      );
    }

    previousDropDateRef.current = currentAdventure?.drop_date ?? null;
  }, [currentAdventure, profile?.id, profile?.notifications_enabled, session?.user?.id, showNotice]);

  useEffect(() => {
    const profileId = profile?.id ?? session?.user.id ?? GUEST_ID;
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      notificationsService.handleAppStateChange(nextState, profileId).catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [profile?.id, session?.user?.id]);

  return null;
};
