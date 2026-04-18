import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { AdventureDay } from '../types/adventure';

interface DayShellCardProps {
  day: AdventureDay;
}

const DayShellCardComponent: React.FC<DayShellCardProps> = ({ day }) => {
  const isFailed = day.status === 'failed';
  const isHydrating = day.status === 'hydrating';

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={isFailed ? 'warning-outline' : isHydrating ? 'sync-outline' : 'map-outline'}
          size={28}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{day.theme_title}</Text>
        <Text style={styles.body}>
          {day.error_message ||
            day.teaser ||
            "Travis has this day sketched. Full stops unlock automatically when this day enters your rolling 3-day window."}
        </Text>
      </View>
    </View>
  );
};

export const DayShellCard = React.memo(DayShellCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingLeft: theme.spacing.md,
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
