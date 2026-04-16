import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { TravisSignal } from './TravisSignal';

const { width } = Dimensions.get('window');

interface NoticeAction {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface NoticeOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  actions?: NoticeAction[];
  duration?: number; // ms, only for simple alerts
}

interface NoticeContextType {
  showNotice: (options: NoticeOptions) => void;
  hideNotice: () => void;
}

const NoticeContext = createContext<NoticeContextType | undefined>(undefined);

export const NoticeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentNotice, setCurrentNotice] = useState<NoticeOptions | null>(null);
  const translateY = useSharedValue(-200);
  const backdropOpacity = useSharedValue(0);

  const hideNotice = useCallback(() => {
    translateY.value = withSpring(-300, { damping: 20 }, () => {
      runOnJS(setCurrentNotice)(null);
    });
    backdropOpacity.value = withTiming(0);
  }, []);

  const showNotice = useCallback((options: NoticeOptions) => {
    setCurrentNotice(options);
    translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
    backdropOpacity.value = withTiming(1);

    // Auto-hide if no actions provided
    if (!options.actions || options.actions.length === 0) {
      setTimeout(() => {
        hideNotice();
      }, options.duration || 4000);
    }
  }, [hideNotice]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <NoticeContext.Provider value={{ showNotice, hideNotice }}>
      {children}
      
      {currentNotice && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Subtle Backdrop for focus if actions are present */}
          {currentNotice.actions && currentNotice.actions.length > 0 && (
            <Animated.View style={[styles.backdrop, backdropStyle]} onTouchStart={hideNotice} />
          )}

          <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
            <Animated.View style={[styles.noticeContainer, animatedStyle]}>
              <View style={styles.content}>
                <View style={styles.header}>
                  <TravisSignal 
                    status={currentNotice.type === 'error' || currentNotice.type === 'warning' ? 'thinking' : 'tracking'} 
                    size={40} 
                  />
                  <View style={styles.textContainer}>
                    <Text style={styles.title}>{currentNotice.title}</Text>
                    <Text style={styles.message}>{currentNotice.message}</Text>
                  </View>
                </View>

                {currentNotice.actions && currentNotice.actions.length > 0 && (
                  <View style={styles.actionRow}>
                    {currentNotice.actions.map((action, i) => (
                      <TouchableOpacity 
                        key={i} 
                        style={[
                          styles.actionButton, 
                          action.style === 'destructive' && styles.actionDestructive,
                          action.style === 'cancel' && styles.actionCancel
                        ]}
                        onPress={() => {
                          action.onPress();
                          hideNotice();
                        }}
                      >
                        <Text style={[
                          styles.actionText,
                          action.style === 'destructive' && styles.actionTextDestructive,
                          action.style === 'cancel' && styles.actionTextCancel
                        ]}>
                          {action.text.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              
              {!currentNotice.actions && (
                <TouchableOpacity style={styles.closeHandle} onPress={hideNotice}>
                  <View style={styles.handleBar} />
                </TouchableOpacity>
              )}
            </Animated.View>
          </SafeAreaView>
        </View>
      )}
    </NoticeContext.Provider>
  );
};

export const useNotice = () => {
  const context = useContext(NoticeContext);
  if (!context) throw new Error('useNotice must be used within a NoticeProvider');
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 28, 30, 0.4)', // Muted Ink
  },
  safeArea: {
    flex: 1,
  },
  noticeContainer: {
    marginHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 20 : 0,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.colors.textPrimary, // Ink Black border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.primary, // Vintage Red
    letterSpacing: 1,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 44,
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionDestructive: {
    backgroundColor: theme.colors.primary,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionTextCancel: {
    color: theme.colors.textSecondary,
  },
  actionTextDestructive: {
    color: '#FFFFFF',
  },
  closeHandle: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
  },
});
