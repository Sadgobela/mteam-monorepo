import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, useColorScheme, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { MARK_ARM_DIRECTIONS, MARK_ARMS, WORDMARK_PATH } from "@mteam/shared";
import { palettes } from "@/lib/theme";

const MARK_BOX = "0 0 319.89 319.89";
const WORD_BOX = { x: 393.73, y: 95.11, width: 594.74, height: 132.86 };
const CYCLE_MS = 2200;
/** How far an arrow travels, as a share of the mark: 54 of its 320 units, as in the approved prototype. */
const TRAVEL = 54 / 319.89;
// One cycle starts assembled, so the loader carries on from the splash screen: rest, part, gather again.
const PART_AT = 0.46;
const GONE_AT = 0.7;
const STEPS = 12;
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** How far apart the arrows are over one cycle, 0 assembled to 1 apart. Sampled, since Animated eases a whole range at once. */
export function spreadCurve(): { inputRange: number[]; outputRange: number[] } {
  const inputRange = [0, PART_AT];
  const outputRange = [0, 0];
  for (let step = 1; step <= STEPS; step++) {
    inputRange.push(PART_AT + ((GONE_AT - PART_AT) * step) / STEPS);
    outputRange.push(easeIn(step / STEPS));
  }
  for (let step = 1; step <= STEPS; step++) {
    inputRange.push(GONE_AT + ((1 - GONE_AT) * step) / STEPS);
    outputRange.push(1 - easeOut(step / STEPS));
  }
  return { inputRange, outputRange };
}

/**
 * The app's loader, as on the site: the logo's four arrows gather into the mark, rest, and part again (design
 * "assemble"). With reduced motion turned on in the phone's settings it is the still mark.
 */
export function MarkLoader({ size = 48, color, label }: { size?: number; color: string; label?: string }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let live = true;
    let loop: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: CYCLE_MS, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    });
    return () => {
      live = false;
      loop?.stop();
    };
  }, [progress]);

  const spread = progress.interpolate(spreadCurve());
  const scale = progress.interpolate({ inputRange: [0, 0.04, 0.1, 1], outputRange: [1, 1.04, 1, 1] });
  const opacity = spread.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
        {MARK_ARMS.map((arm, index) => {
          const [dx, dy] = MARK_ARM_DIRECTIONS[index];
          const shift = (axis: number) => spread.interpolate({ inputRange: [0, 1], outputRange: [0, axis * TRAVEL * size] });
          return (
            <Animated.View key={index} testID="mark-arm" style={[StyleSheet.absoluteFill, { opacity, transform: [{ translateX: shift(dx) }, { translateY: shift(dy) }] }]}>
              <Svg width={size} height={size} viewBox={MARK_BOX}>
                <Path d={arm} fill={color} />
              </Svg>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

/** The word "MTeam" from the logo, `width` wide. */
export function Wordmark({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={(width * WORD_BOX.height) / WORD_BOX.width} viewBox={`${WORD_BOX.x} ${WORD_BOX.y} ${WORD_BOX.width} ${WORD_BOX.height}`} accessibilityLabel="MTeam">
      <Path d={WORDMARK_PATH} fill={color} />
    </Svg>
  );
}

/**
 * What the app shows over everything while it starts: the splash screen's mark and word in the same place, now moving,
 * until the saved session has been checked. Then it fades away.
 */
export function BootScreen({ done }: { done: boolean }) {
  const dark = useColorScheme() === "dark";
  const [opacity] = useState(() => new Animated.Value(1));
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (done) Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setGone(true));
  }, [done, opacity]);

  if (gone) return null;
  return (
    <Animated.View testID="boot" pointerEvents={done ? "none" : "auto"} style={[StyleSheet.absoluteFill, styles.boot, { opacity, backgroundColor: dark ? palettes.dark.bg : palettes.light.brand }]}>
      <MarkLoader size={64} color="#ffffff" />
      <Wordmark width={84} color="#ffffff" />
    </Animated.View>
  );
}

// The splash image (assets/splash-mark.png) is the same picture: a 64 dp mark, a 26 dp gap, the 84 dp word.
const styles = StyleSheet.create({ boot: { alignItems: "center", justifyContent: "center", gap: 26, zIndex: 20 } });
