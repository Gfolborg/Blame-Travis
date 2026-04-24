import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';

/**
 * EditorialSkeleton — High-end placeholder for the Story Cards.
 * Features a soft pulse animation to match the magazine aesthetic.
 */
export const EditorialSkeleton = () => {
  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0.3 }}
        animate={{ opacity: 0.6 }}
        transition={{
          type: 'timing',
          duration: 1500,
          loop: true,
          repeatReverse: true,
        }}
        style={styles.card}
      >
        <View style={styles.content}>
          <View style={styles.lineSmall} />
          <View style={styles.lineLarge} />
          <View style={styles.footer}>
            <View style={styles.circle} />
            <View style={styles.lineMedium} />
          </View>
        </View>
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    marginTop: 24,
  },
  card: {
    width: '100%',
    height: 480,
    borderRadius: 24,
    backgroundColor: '#E5E5E5',
    justifyContent: 'flex-end',
    padding: 32,
  },
  content: {
    gap: 12,
  },
  lineSmall: {
    width: 80,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  },
  lineLarge: {
    width: '100%',
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  circle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  lineMedium: {
    width: 60,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  }
});
