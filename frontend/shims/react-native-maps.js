/**
 * Web stub for react-native-maps.
 * react-native-maps is native-only; this prevents Metro from crashing on web builds.
 */
import React from 'react';
import { View } from 'react-native';

const Noop = () => null;
const NoopView = ({ children, style }) => React.createElement(View, { style }, children);

const MapView = NoopView;
MapView.Animated = NoopView;

export default MapView;
export const Marker         = Noop;
export const Callout        = Noop;
export const CalloutSubview = Noop;
export const Polyline       = Noop;
export const Polygon        = Noop;
export const Circle         = Noop;
export const Overlay        = Noop;
export const Heatmap        = Noop;
export const PROVIDER_GOOGLE  = 'google';
export const PROVIDER_DEFAULT = null;
export const MAP_TYPES = {};
export const AnimatedRegion = class AnimatedRegion {};
