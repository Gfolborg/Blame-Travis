import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

const JourneysScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>YOUR JOURNEYS</Text>
      <Text style={styles.subtitle}>Your journey history and upcoming tasks.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    textAlign: 'center',
  },
});

export default JourneysScreen;
