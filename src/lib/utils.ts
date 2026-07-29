export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(dateStr: string | null, timeStr: string | null): string {
  if (!dateStr) return '-';
  const date = formatDate(dateStr);
  if (!timeStr) return date;
  const time = timeStr.slice(0, 5);
  return `${date} às ${time}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const POSITIONS = [
  'Goleiro',
  'Zagueiro',
  'Lateral Direito',
  'Lateral Esquerdo',
  'Volante',
  'Meia',
  'Meia Atacante',
  'Ponta Direita',
  'Ponta Esquerda',
  'Segundo Atacante',
  'Centroavante',
];

export const MATCH_TYPES = [
  'Amistoso',
  'Campeonato',
  'Copa',
  'Torneio',
  'Jogo-treino',
  'Outro',
];
