import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');
type NotificationChannelKey = 'general' | 'trip' | 'reminder';

const CHANNELS: Record<NotificationChannelKey, { id: string; name: string; description: string }> = {
  general: {
    id: 'travelorai-general',
    name: 'TravelorAI General',
    description: 'Asosiy yangilik va tavsiyalar',
  },
  trip: {
    id: 'travelorai-trip',
    name: 'TravelorAI Trip Progress',
    description: 'Trip bo`yicha eslatma va progress',
  },
  reminder: {
    id: 'travelorai-reminder',
    name: 'TravelorAI Reminders',
    description: 'Kunlik reja va refleksiya eslatmalari',
  },
};

export interface NotificationSupportInfo {
  supported: boolean;
  reason?: string;
}

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

export function getNotificationSupportInfo(): NotificationSupportInfo {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      reason: 'Bildirishnomalar web versiyada hozircha yoqilmagan.',
    };
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return {
      supported: false,
      reason: "Expo Go Android push notifications ni to'liq qo'llamaydi. Development build ishlating.",
    };
  }

  return { supported: true };
}

async function ensureAndroidChannels(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Promise.all(
    Object.values(CHANNELS).map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 80, 220],
        lightColor: '#1A6B3C',
        sound: 'default',
      })
    )
  );
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  const support = getNotificationSupportInfo();
  if (!support.supported) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then(async (Notifications) => {
        if (!notificationHandlerConfigured) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
          notificationHandlerConfigured = true;
        }

        await ensureAndroidChannels(Notifications);
        return Notifications;
      })
      .catch(() => null);
  }

  return notificationsModulePromise;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function sendLocalNotification(
  title: string,
  body: string,
  channel: NotificationChannelKey = 'general'
): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS[channel].id } : {}),
    },
    trigger: null,
  });
}

export async function scheduleDailyTip(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync('daily-tip').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-tip',
    content: {
      title: 'TravelorAI maslahat',
      body: "Bugun yangi joy kashf etish uchun Explore bo'limini oching!",
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.general.id } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}

export async function scheduleEveningReflectionReminder(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync('evening-reflection').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'evening-reflection',
    content: {
      title: 'Safar bo`yicha mulohaza',
      body: "Bugungi borgan joylaringizni belgilang va qisqa fikr yozib qo'ying.",
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.reminder.id } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 30,
    },
  });
}

export async function scheduleTripProgressReminder(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync('trip-progress').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'trip-progress',
    content: {
      title: 'Trip progress eslatmasi',
      body: "Trip bo'limidan marshrutni ochib, bajarilgan stoplarni belgilab boring.",
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.trip.id } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 13,
      minute: 0,
    },
  });
}

export async function scheduleProfessionalNotifications(): Promise<void> {
  await Promise.all([scheduleDailyTip(), scheduleTripProgressReminder(), scheduleEveningReflectionReminder()]);
}

export async function cancelDailyTip(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync('daily-tip').catch(() => {});
}

export async function cancelProfessionalNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Promise.all([
    Notifications.cancelScheduledNotificationAsync('daily-tip').catch(() => {}),
    Notifications.cancelScheduledNotificationAsync('trip-progress').catch(() => {}),
    Notifications.cancelScheduledNotificationAsync('evening-reflection').catch(() => {}),
  ]);
}
