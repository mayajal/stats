import type { DataRow, ColumnDefinition } from '@/types';

export function parseCSV(csvText: string): { data: DataRow[], columns: ColumnDefinition[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    return { data: [], columns: [] };
  }

  const headers = lines[0].split(',').map(header => header.trim());
  const columns: ColumnDefinition[] = headers.map(header => ({
    id: header,
    name: header,
  }));

  const data: DataRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: DataRow = {};
    headers.forEach((header, index) => {
      const value = values[index] ? values[index].trim() : '';
      // Attempt to convert to number if possible
      const numValue = Number(value);
      row[header] = isNaN(numValue) || value === '' ? value : numValue;
    });
    data.push(row);
  }

  return { data, columns };
}
