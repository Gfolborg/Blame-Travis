import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

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
  showNotice: (_options: NoticeOptions) => void;
  hideNotice: () => void;
}

const NoticeContext = createContext<NoticeContextType | undefined>(undefined);

export const NoticeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentNotice, setCurrentNotice] = useState<NoticeOptions | null>(null);
  const translateY = useSharedValue(36);
  const containerOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasActions = Boolean(currentNotice?.actions && currentNotice.actions.length > 0);

  const hideNotice = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    translateY.value = withTiming(24, { duration: 150 });
    containerOpacity.value = withTiming(0, { duration: 130 }, () => {
      runOnJS(setCurrentNotice)(null);
    });
    backdropOpacity.value = withTiming(0, { duration: 120 });
  }, [backdropOpacity, containerOpacity, translateY, setCurrentNotice]);

  const showNotice = useCallback((options: NoticeOptions) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setCurrentNotice(options);
    translateY.value = 24;
    containerOpacity.value = 0;
    backdropOpacity.value = 0;
    translateY.value = withTiming(0, { duration: 170 });
    containerOpacity.value = withTiming(1, { duration: 170 });
    backdropOpacity.value = withTiming(options.actions?.length ? 1 : 0, { duration: 150 });

    // Auto-hide if no actions provided
    if (!options.actions || options.actions.length === 0) {
      dismissTimerRef.current = setTimeout(() => {
        hideNotice();
      }, options.duration || 1800);
    }
  }, [hideNotice, backdropOpacity, containerOpacity, translateY, setCurrentNotice]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: containerOpacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * 0.28,
  }));

  const toneColor = useMemo(() => {
    if (currentNotice?.type === 'error') return '#C62828';
    if (currentNotice?.type === 'warning') return '#C97A00';
    if (currentNotice?.type === 'success') return '#2E7D32';
    return theme.colors.textSecondary;
  }, [currentNotice?.type]);

  return (
    <NoticeContext.Provider value={{ showNotice, hideNotice }}>
      {children}
      
      {currentNotice && (
        <View style={styles.overlay} pointerEvents="box-none">
          {hasActions && (
            <Animated.View style={[styles.backdrop, backdropStyle]} onTouchStart={hideNotice} />
          )}

          <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
            <Animated.View
              style={[
                hasActions ? styles.sheetContainer : styles.toastContainer,
                animatedStyle,
              ]}
            >
              {hasActions ? (
                <View style={styles.sheetContent}>
                  <Text style={styles.sheetTitle}>{currentNotice.title}</Text>
                  <Text style={styles.sheetMessage}>{currentNotice.message}</Text>
                  <View style={styles.actionRow}>
                    {currentNotice.actions?.map((action, i) => (
                      <TouchableOpacity
                        key={`${action.text}-${i}`}
                        style={[
                          styles.actionButton,
                          action.style === 'destructive' && styles.actionDestructive,
                          action.style === 'cancel' && styles.actionCancel,
                        ]}
                        onPress={() => {
                          action.onPress();
                          hideNotice();
                        }}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            action.style === 'destructive' && styles.actionTextDestructive,
                            action.style === 'cancel' && styles.actionTextCancel,
                          ]}
                        >
                          {action.text.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.toastContent}
                  onPress={hideNotice}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`${currentNotice.title}. ${currentNotice.message}`}
                >
                  <View style={[styles.toastDot, { backgroundColor: toneColor }]} />
                  <View style={styles.toastTextWrap}>
                    <Text style={styles.toastTitle} numberOfLines={1}>
                      {currentNotice.title}
                    </Text>
                    <Text style={styles.toastMessage} numberOfLines={2}>
                      {currentNotice.message}
                    </Text>
                  </View>
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
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  sheetContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
  },
  toastContainer: {
    alignSelf: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(22, 22, 24, 0.94)',
    borderRadius: 16,
    maxWidth: '92%',
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  sheetContent: {
    padding: 16,
  },
  toastContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  toastMessage: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    lineHeight: 16,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  sheetMessage: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 40,
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 10,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  actionTextCancel: {
    color: theme.colors.textSecondary,
  },
  actionTextDestructive: {
    color: '#FFFFFF',
  },
});
