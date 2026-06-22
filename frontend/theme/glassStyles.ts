import { StyleSheet } from 'react-native';
import * as C from './colors';

export const glass = StyleSheet.create({
  base: {
    backgroundColor: C.GLASS_BG,
    borderWidth: 1,
    borderColor: C.GLASS_BORDER,
    borderRadius: 16,
  },
  strong: {
    backgroundColor: C.GLASS_BG_STRONG,
    borderWidth: 1,
    borderColor: C.GLASS_BORDER_STRONG,
    borderRadius: 16,
  },
  primary: {
    backgroundColor: C.GLASS_PRIMARY,
    borderWidth: 1,
    borderColor: C.GLASS_PRIMARY_BORDER,
    borderRadius: 16,
  },
  card: {
    backgroundColor: C.GLASS_BG,
    borderWidth: 1,
    borderColor: C.GLASS_BORDER,
    borderRadius: 20,
    padding: 16,
  },
  pill: {
    backgroundColor: C.GLASS_BG_STRONG,
    borderWidth: 1,
    borderColor: C.GLASS_BORDER,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
