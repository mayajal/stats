import * as XLSX from 'xlsx';
import type { DataRow, ColumnDefinition } from '@/types';

export async function getSheetNamesFromXLSX(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  return workbook.SheetNames;
}

export async function parseXLSXSheet(
  file: File,
  sheetName: string
): Promise<{ data: DataRow[], columns: ColumnDefinition[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in the workbook.`);
  }

  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });
  
  if (jsonData.length === 0) {
    return { data: [], columns: [] };
  }

  const headers = (jsonData[0] as string[]).map(String);
  const columns: ColumnDefinition[] = headers.map(header => ({
    id: header,
    name: header,
  }));

  const data: DataRow[] = jsonData.slice(1).map(rowArray => {
    const row: DataRow = {};
    const rowAsArray = rowArray as any[];
    headers.forEach((header, index) => {
      const value = rowAsArray[index];
       if (value instanceof Date) {
        row[header] = value.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
      } else {
        row[header] = value === undefined || value === null ? null : value;
      }
    });
    return row;
  }).filter(row => Object.values(row).some(v => v !== null)); // Filter out completely empty rows

  return { data, columns };
}
