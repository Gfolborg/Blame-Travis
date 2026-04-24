import React from 'react';
import { View, StyleSheet } from 'react-native';
import { User, Search, AlertCircle } from 'lucide-react-native';
import { theme } from '../theme';

export type TravisStatus = 'idle' | 'thinking' | 'alert' | 'tracking';

interface TravisSignalProps {
  status?: TravisStatus;
  size?: number;
  editorial?: boolean; // Toggles the luxury magazine aesthetic
}

/**
 * TravisSignal — The visual anchor for Travis.
 * Represents his presence and current 'mental' state using a character silhouette placeholder.
 */
export const TravisSignal: React.FC<TravisSignalProps> = ({ 
  status = 'idle', 
  size = 40,
  editorial = true
}) => {
  const getStatusColor = () => {
    if (editorial) return theme.colors.textPrimary; // Pure Midnight Ink for editorial mode
    
    switch (status) {
      case 'alert':
        return theme.colors.error;
      case 'tracking':
        return theme.colors.success;
      case 'thinking':
        return theme.colors.primary;
      case 'idle':
      default:
        return theme.colors.textPrimary;
    }
  };

  const getIcon = () => {
    if (status === 'thinking' || status === 'tracking') return <Search size={size * 0.55} color={theme.colors.surface} strokeWidth={1.5} />;
    if (status === 'alert') return <AlertCircle size={size * 0.55} color={theme.colors.surface} strokeWidth={1.5} />;
    return <User size={size * 0.6} color={theme.colors.surface} strokeWidth={1.5} />;
  };

  const isAnimated = status === 'thinking' || status === 'tracking';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.silhouetteBg,
          editorial && styles.editorialShadow, // Softer shadow for editorial mode
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: getStatusColor(),
            transform: [{ rotate: status === 'thinking' ? '-3deg' : '0deg' }, { scale: isAnimated ? 1.03 : 1 }],
          },
        ]}
      >
        {getIcon()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteBg: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  editorialShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  }
});
