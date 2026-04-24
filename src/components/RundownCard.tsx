import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { PlaceDetails, placesService } from '../services/places';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RundownCardProps {
  details: PlaceDetails;
}

const toPriceGlyph = (priceLevel?: string): string | null => {
  if (!priceLevel) return null;
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE':
      return 'Free';
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return '$';
  }
};

export const RundownCard: React.FC<RundownCardProps> = ({ details }) => {
  const priceGlyph = toPriceGlyph(details.priceLevel);

  return (
    <View style={styles.container}>
      {/* Photos Carousel */}
      <ScrollView 
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        style={styles.photoCarousel}
      >
        {details.photos.length > 0 ? (
          details.photos.slice(0, 5).map((photo) => (
            <Image 
              key={photo.name}
              source={{ uri: placesService.getPhotoUri(photo.name, 1000) }}
              style={styles.photo}
            />
          ))
        ) : (
          <View style={[styles.photo, styles.placeholderPhoto]}>
            <Ionicons name="image-outline" size={60} color={theme.colors.textSecondary} />
          </View>
        )}
      </ScrollView>

      {/* Basic Info Row */}
      <View style={styles.infoRow}>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={18} color="#FFC107" />
          <Text style={styles.ratingText}>{details.rating || 'N/A'}</Text>
          <Text style={styles.reviewCount}>({details.userRatingCount || 0})</Text>
        </View>
        {priceGlyph && (
          <Text style={styles.priceLevel}>
            {priceGlyph}
          </Text>
        )}
      </View>

      {/* Editorial Summary */}
      {details.editorialSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHY IT'S WORTH A STOP</Text>
          <Text style={styles.summaryText}>{details.editorialSummary}</Text>
        </View>
      )}

      {/* Reviews Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHAT PEOPLE ARE SAYING</Text>
        {details.reviews.slice(0, 3).map((review, index) => (
          <View key={index} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.authorName}>{review.authorName}</Text>
              <View style={styles.reviewStars}>
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Ionicons key={i} name="star" size={12} color="#FFC107" />
                ))}
              </View>
            </View>
            <Text style={styles.reviewText} numberOfLines={3}>{review.text}</Text>
            <Text style={styles.reviewTime}>{review.relativePublishTime}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  photoCarousel: {
    height: 300,
    width: SCREEN_WIDTH,
  },
  photo: {
    width: SCREEN_WIDTH,
    height: 300,
    resizeMode: 'cover',
  },
  placeholderPhoto: {
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  reviewCount: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginLeft: 4,
  },
  priceLevel: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  summaryText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  reviewCard: {
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
    borderRadius: theme.roundness.md,
    marginBottom: theme.spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  reviewTime: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 8,
    textAlign: 'right',
  },
});
