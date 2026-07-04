/**
 * components/DateTimeField.tsx
 * Sélecteur date + heure réutilisable — évite les champs texte libres
 * (source du bug "invalid input syntax for type timestamp" quand
 * l'utilisateur tape un format inattendu).
 * Web : <input type="datetime-local"> natif. Natif : @react-native-community/datetimepicker.
 * `value`/`onChange` manipulent toujours une string ISO 8601 (ou '').
 */
import React, { memo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AURA } from '@/constants/aura-theme';

const PRIMARY = AURA.primary;
const C = { text: AURA.text, textSub: AURA.textSub, textMuted: AURA.textMuted, border: AURA.border, surfaceAlt: AURA.surfaceAlt };

export const fmtDateTime = (iso: string) => iso
  ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '';

interface DateTimeFieldProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}

const DateTimeField = memo(({ value, onChange, placeholder = 'Sélectionner…' }: DateTimeFieldProps) => {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    const toLocalInputValue = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return (
      <View style={s.wrap}>
        {React.createElement('input', {
          type: 'datetime-local',
          value: toLocalInputValue(value),
          onChange: (e: any) => {
            const v = e.target.value as string;
            onChange(v ? new Date(v).toISOString() : '');
          },
          style: {
            border: 'none', outline: 'none', background: 'transparent',
            color: C.text, fontSize: 14, paddingTop: 14, paddingBottom: 14,
            width: '100%', fontFamily: 'inherit', colorScheme: 'dark',
          },
        })}
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[s.wrap, { paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
        onPress={() => setShowPicker(true)} activeOpacity={0.78}>
        <Text style={{ color: value ? C.text : C.textMuted, fontSize: 14 }}>
          {value ? fmtDateTime(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={C.textSub}/>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowPicker(false);
            if (event.type !== 'dismissed' && selectedDate) onChange(selectedDate.toISOString());
          }}
        />
      )}
    </View>
  );
});

export default DateTimeField;

const s = StyleSheet.create({
  wrap: { backgroundColor: C.surfaceAlt, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
});
