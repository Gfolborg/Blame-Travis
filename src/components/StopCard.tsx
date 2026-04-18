import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ItineraryStop } from '../types/adventure';

interface StopCardProps {
  stop: ItineraryStop;
  onPress?: () => void;
  renderRightAction?: () => React.ReactNode;
}

const StopCardComponent: React.FC<StopCardProps> = ({ stop, onPress, renderRightAction }) => {
  return (
    <TouchableOpacity 
      style={styles.stopCard} 
      activeOpacity={onPress ? 0.8 : 1} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.imagePlaceholder}>
        <Ionicons name="image-outline" size={32} color={theme.colors.textSecondary} />
      </View>
      <View style={styles.cardDetails}>
        <View style={styles.cardHeader}>
          <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
          {renderRightAction && renderRightAction()}
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{(stop.category || 'SPOT').toUpperCase()}</Text>
        </View>
        {stop.why_travis_picked_this && (
          <Text style={styles.insightText} numberOfLines={2}>
            "{stop.why_travis_picked_this}"
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const StopCard = React.memo(StopCardComponent);

const styles = StyleSheet.create({
  stopCard: { 
    flexDirection: 'row', 
    backgroundColor: theme.colors.surface, 
    borderRadius: 20, 
    padding: theme.spacing.md, 
    marginBottom: theme.spacing.md, 
    elevation: 2, 
    borderWidth: 1, 
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  imagePlaceholder: { 
    width: 80, 
    height: 80, 
    backgroundColor: theme.colors.surfaceElevated, 
    borderRadius: 15, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  cardDetails: { 
    flex: 1, 
    paddingLeft: theme.spacing.md, 
    justifyContent: 'center' 
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  stopName: { 
    color: theme.colors.textPrimary, 
    fontSize: 18, 
    fontWeight: '800', 
    flex: 1 
  },
  categoryBadge: { 
    backgroundColor: 'rgba(183, 28, 28, 0.1)', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 6 
  },
  categoryText: { 
    color: theme.colors.primary, 
    fontSize: 10, 
    fontWeight: '800' 
  },
  insightText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
});
