import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ItineraryStop } from '../types/adventure';

interface StopCardProps {
  stop: ItineraryStop;
  onPress?: () => void;
  renderRightAction?: () => React.ReactNode;
}

/**
 * StopCard — The editorial-style stop card.
 * Features the 'Ink Bleed' aesthetic with deep shadows and high-contrast typography.
 */
const StopCardComponent: React.FC<StopCardProps> = ({ stop, onPress, renderRightAction }) => {
  return (
    <TouchableOpacity 
      style={styles.stopCard} 
      activeOpacity={onPress ? 0.85 : 1} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.imageContainer}>
        {stop.image_url ? (
          <Image source={{ uri: stop.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={theme.colors.textSecondary} />
          </View>
        )}
      </View>
      
      <View style={styles.cardDetails}>
        <View style={styles.cardHeader}>
          <Text style={styles.stopName} numberOfLines={1}>
            {stop.name}
          </Text>
          {renderRightAction && (
            <View style={styles.actionWrap}>
              {renderRightAction()}
            </View>
          )}
        </View>

        {stop.why_travis_picked_this && (
          <Text style={styles.insightText} numberOfLines={2}>
            "{stop.why_travis_picked_this}"
          </Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.categoryText}>
            {(stop.category || 'SPOT').toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const StopCard = React.memo(StopCardComponent);

const styles = StyleSheet.create({
  stopCard: { 
    flexDirection: 'row', 
    backgroundColor: theme.colors.surface, 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.03)',
    ...theme.shadows.float,
  },
  imageContainer: {
    width: 90,
    height: 90,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: { 
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  cardDetails: { 
    flex: 1, 
    paddingLeft: 16, 
    justifyContent: 'space-between',
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
  },
  stopName: { 
    flex: 1,
    color: theme.colors.textPrimary, 
    fontFamily: theme.typography.fonts.black,
    fontSize: 18, 
    letterSpacing: -0.5,
  },
  actionWrap: {
    marginLeft: 8,
  },
  insightText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  footer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  categoryText: { 
    color: theme.colors.textSecondary, 
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9, 
    letterSpacing: 1.5,
  },
});
